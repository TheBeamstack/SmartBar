/**
 * Validation-profile registry (spec §7; closes P1 decision D-P1-4).
 *
 * A *profile* is a named validator function (`BAEL_COLUMN`, `BAEL_BEAM`, …). The generic
 * `solveElement` (pipeline/element.ts) reads `validationProfile` from the element/scheme
 * manifest and dispatches through this registry — so adding the beam (or any element) is a
 * new profile + manifests, NOT an `if (elementType === …)` branch in the engine (golden rule
 * §0.1; plan P3). Each profile consumes the SAME resolved layout/geometry and returns the
 * frozen tiered `ValidationItem[]`.
 *
 * Pure + deterministic; pack-agnostic (all limits via `code.*`).
 */
import type { MaterialContext, ValidationStatus } from "../types/codepack";
import type { ZoneGeometry, SectionKind, TransverseRegion } from "../types/layout";
import type { RectLayoutResult, TensionFace } from "../layout/rect";
import type { CircularLayoutResult } from "../layout/circular";
import { CIRCULAR_MIN_BARS } from "../layout/circular";
import {
  type ValidationItem,
  type ExtendedCodePack,
  item,
  round,
  mm2,
  barArea,
  clearSpacing,
  aswProvidedPerMetre,
  validateColumn,
} from "./index";
import {
  slabDistributionMin,
  twowayCornerTorsionMissing,
  stairReentrantCornerPullout,
} from "./predicates";

/** A longitudinal zone after layout + geometry resolution. */
export interface SolvedLongZone {
  zone: string;
  groupId: string;
  diameter: number;
  /** bars whose resolved faceTag falls in this zone's faces. */
  providedCount: number;
  asReq: number;
  asProv: number;
  /** computed effective depth for this flexural zone ([REF-SYS-611]). */
  geometry: ZoneGeometry;
  tensionFace: TensionFace;
  faces: TensionFace[];
  /** fraction of this zone's bars carried past the support (§7.7 end-support anchorage). */
  continuedToSupport?: number;
  /** circular sections: the pitch-circle zone gets the min-bars/ratio/arc-spacing checks. */
  primary?: boolean;
}

/** A slab flexural zone (per metre of width), spec §6.1 "Slabs/mats" / §7.4. */
export interface SolvedSlabZone {
  zone: string;
  groupId: string;
  diameter: number;
  /** bar spacing / pitch (mm). */
  spacing: number;
  /** required steel per metre (mm²/m). */
  asReqPerM: number;
  /** provided steel per metre (mm²/m). */
  asProvPerM: number;
  /** computed effective depth for this mat (mm). */
  d: number;
  /** which mat: MAIN drives distribution-min; SECONDARY uses the relaxed spacing limit. */
  role: "MAIN" | "SECONDARY" | "TOP";
}

/** Slab-specific context (E-SLB-01 / E-SLB-02 / E-SLB-03 joist / E-STR-01 stair). */
export interface SlabContext {
  thickness: number;
  zones: SolvedSlabZone[];
  /** restrained discontinuous corner present (two-way) → corner-torsion predicate. */
  restrainedCorner?: boolean;
  /** provided corner-torsion steel (mm²); 0/absent → WARN when restrained. */
  cornerTorsionProvided?: number;
}

/** Stair-specific context (E-STR-01), spec §7.13 stair_reentrant_corner_pullout. */
export interface StairContext {
  /** flight↔landing re-entrant (concave) corner present (a landing return exists). */
  reentrantCorner: boolean;
  /** the main (bottom-tension) bar is continuous AROUND the corner (vs split + anchored). */
  mainBarWrapsCorner: boolean;
  /** group id of the main bottom bar (for the predicate). */
  mainGroupId: string;
}

/** A transverse (tie/stirrup) zone. */
export interface SolvedTransZone {
  zone: string;
  groupId: string;
  diameter: number;
  spacing: number;
  nLegs: number;
  aswReqPerM: number;
  userMandrel?: number;
  /**
   * v1.0.4 A2 ([REF-SYS-757], D-V102-5): per-region spacing along the member. When present, the
   * provided Asw/m is checked on the **governing (widest) region** — the sparsest stretch gives the
   * least steel — instead of the single representative `spacing`. Absent → the uniform `spacing`.
   */
  regions?: TransverseRegion[];
}

/** The governing (widest) transverse spacing (mm): the sparsest region drives the minimum Asw/m. */
export function governingAswSpacing(tz: SolvedTransZone): number {
  return tz.regions && tz.regions.length > 0
    ? Math.max(...tz.regions.map((r) => r.spacing))
    : tz.spacing;
}

/**
 * v1.0.4 B2 — one element support (a beam's V1/V2) as fed to the validator: the provided bottom-bar
 * anchorage length into the support + its bearing width, for the per-support §7.7 anchorage check.
 */
export interface SupportInput {
  /** support identity (e.g. "left" / "right" = V1 / V2). */
  id: string;
  /** provided bottom-bar anchorage length into this support (mm). */
  anchorage: number;
  /** support bearing width (mm). */
  width: number;
}

export interface ProfileContext {
  element: string;
  /** section family (RECT default; CIRCULAR / SLAB added in P4a). */
  section?: SectionKind;
  geometry: { b?: number; h?: number; H?: number; L?: number; D?: number; Lx?: number; Ly?: number; t?: number };
  cover: number;
  exposure: string;
  fire?: string;
  dg: number;
  material: MaterialContext;
  /** rectangular layout (RECT profiles). */
  layout?: RectLayoutResult;
  /** circular pitch-circle layout (CIRCULAR profiles). */
  circular?: CircularLayoutResult;
  /** slab mats (SLAB / JOIST_SLAB / STAIR profiles). */
  slab?: SlabContext;
  /** stair re-entrant-corner context (STAIR profile). */
  stair?: StairContext;
  longitudinal: SolvedLongZone[];
  transverse: SolvedTransZone[];
  /** v1.0.4 B2 — element supports (beam V1/V2) for the per-support anchorage check; absent → none. */
  supports?: SupportInput[];
  /**
   * v1.0.4 (A2 completeness) — the REAL placed bar count / underfilled faces over the addressable
   * channel (removals excluded), so min_bars / face_min reflect removals. Absent → the validator
   * uses the nominal layout counts (grouped docs, byte-identical).
   */
  placedCount?: number;
  placedUnderfilledFaces?: TensionFace[];
  /** largest longitudinal ø present (tie-ø rule). */
  phiLMax: number;
  code: ExtendedCodePack;
}

export type ProfileValidator = (ctx: ProfileContext) => ValidationItem[];

// ---------------------------------------------------------------------------
// BAEL_COLUMN — reuses the proven P1 column validator (single source of truth).
// ---------------------------------------------------------------------------
export function validateColumnProfile(ctx: ProfileContext): ValidationItem[] {
  const lz = ctx.longitudinal[0];
  const tz = ctx.transverse[0];
  if (!lz || !tz) throw new Error("BAEL_COLUMN: expects one longitudinal + one transverse zone");
  if (!ctx.layout) throw new Error("BAEL_COLUMN: expects a rectangular layout");
  return validateColumn({
    geometry: { b: ctx.geometry.b ?? 0, h: ctx.geometry.h ?? 0, H: ctx.geometry.H ?? 0 },
    cover: ctx.cover,
    exposure: ctx.exposure,
    ...(ctx.fire !== undefined ? { fire: ctx.fire } : {}),
    dg: ctx.dg,
    material: ctx.material,
    layout: ctx.layout,
    zones: [lz.geometry],
    inputs: {
      longGroupId: lz.groupId,
      phiL: lz.diameter,
      phiLMax: ctx.phiLMax,
      asReq: lz.asReq,
      tieGroupId: tz.groupId,
      phiT: tz.diameter,
      tieSpacing: tz.spacing,
      nLegs: tz.nLegs,
      aswReqPerM: tz.aswReqPerM,
      ...(tz.userMandrel !== undefined ? { userTieMandrel: tz.userMandrel } : {}),
      // A2: exact As over the placed set (grouped path → identical to N·barArea, byte-identical).
      asProvExact: lz.asProv,
      // A2: Asw checked on the governing (widest) tie region (uniform set → tieSpacing, identical).
      aswSpacing: governingAswSpacing(tz),
      // A2 completeness: real placed bar count + underfilled faces (removals). Absent → layout counts.
      ...(ctx.placedCount !== undefined ? { placedCount: ctx.placedCount } : {}),
      ...(ctx.placedUnderfilledFaces !== undefined ? { placedUnderfilledFaces: ctx.placedUnderfilledFaces } : {}),
    },
    code: ctx.code,
  });
}

// ---------------------------------------------------------------------------
// BAEL_BEAM — beam flexural + shear + curtailment (spec §7.4 beam, §7.5, §7.7).
// ---------------------------------------------------------------------------
const END_SUPPORT_FRACTION = 0.25; // β·As,span carried past the support (§7.7, EC2 §9.2.1.4)

export function validateBeamProfile(ctx: ProfileContext): ValidationItem[] {
  const { code } = ctx;
  const geometry = { b: ctx.geometry.b ?? 0, h: ctx.geometry.h ?? 0 };
  const layout = ctx.layout;
  if (!layout) throw new Error("BAEL_BEAM: expects a rectangular layout");
  const ref = code.codeRef ?? code.id;
  const out: ValidationItem[] = [];
  const Ac = geometry.b * geometry.h;
  const bands = code.warnBands ?? { spacing: 0.05, anchorage: 0.05, cover: 0.1 };
  const sMin = Math.max(ctx.phiLMax, ctx.dg + 5, 20);

  // --- per longitudinal zone: provided area + non-fragilité (As,min) + clear spacing ---
  for (const lz of ctx.longitudinal) {
    const ok = lz.asProv >= lz.asReq;
    out.push(
      item(
        `provided_area:${lz.zone}`,
        ok ? "PASS" : "FAIL",
        round(lz.asProv),
        round(lz.asReq),
        ref,
        ok
          ? `Acier fourni ${mm2(lz.asProv)} ≥ requis ${mm2(lz.asReq)} (${lz.zone})`
          : `Acier fourni ${mm2(lz.asProv)} < requis ${mm2(lz.asReq)} (${lz.zone})`,
        ok
          ? `Provided steel ${mm2(lz.asProv)} ≥ required ${mm2(lz.asReq)} (${lz.zone})`
          : `Provided steel ${mm2(lz.asProv)} < required ${mm2(lz.asReq)} (${lz.zone})`,
        [lz.groupId],
      ),
    );

    // non-fragilité / ratio limits — beam As,min uses the COMPUTED d (§6.1, §7.4)
    const asMin = code.AsMin({
      Ac,
      b: geometry.b,
      d: lz.geometry.d,
      material: ctx.material,
      member: "BEAM",
    });
    const asMax = code.AsMax({ Ac, material: ctx.material, member: "BEAM" });
    const ratioStatus: ValidationStatus =
      lz.asProv < asMin || lz.asProv > asMax ? "FAIL" : "PASS";
    out.push(
      item(
        `ratio_limits:${lz.zone}`,
        ratioStatus,
        round(lz.asProv),
        `[${round(asMin)}, ${round(asMax)}]`,
        ref,
        ratioStatus === "PASS"
          ? `Ratio d'acier dans [${mm2(asMin)}, ${mm2(asMax)}] (${lz.zone}, d=${round(lz.geometry.d)} mm)`
          : `Ratio d'acier hors limites [${mm2(asMin)}, ${mm2(asMax)}] (${lz.zone})`,
        ratioStatus === "PASS"
          ? `Steel ratio within [${mm2(asMin)}, ${mm2(asMax)}] (${lz.zone}, d=${round(lz.geometry.d)} mm)`
          : `Steel ratio outside [${mm2(asMin)}, ${mm2(asMax)}] (${lz.zone})`,
        [lz.groupId],
      ),
    );

    // clear spacing on this zone's principal face(s) (§7.2)
    for (const face of lz.faces) {
      const horizontal = face === "TOP" || face === "BOTTOM";
      const n = layout.faceCounts[face as "TOP" | "BOTTOM" | "LEFT" | "RIGHT"];
      if (n < 2) continue;
      const edge = horizontal ? layout.core.width : layout.core.height;
      const s = clearSpacing(edge, n, lz.diameter);
      const status: ValidationStatus =
        s < sMin ? "FAIL" : s < sMin * (1 + bands.spacing) ? "WARN" : "PASS";
      out.push(
        item(
          `clear_spacing:${lz.zone}:${face}`,
          status,
          round(s),
          round(sMin),
          ref,
          status === "FAIL"
            ? `Espacement libre ${round(s)} mm < min ${round(sMin)} mm (face ${face})`
            : `Espacement libre ${round(s)} mm (min ${round(sMin)} mm, face ${face})`,
          status === "FAIL"
            ? `Clear spacing ${round(s)} mm < min ${round(sMin)} mm (face ${face})`
            : `Clear spacing ${round(s)} mm (min ${round(sMin)} mm, face ${face})`,
          [lz.groupId],
        ),
      );
    }
  }

  // --- cover (durability + fire), once for the section ---
  const reqCover = code.cover({
    diameter: ctx.phiLMax,
    phiT: ctx.transverse[0]?.diameter ?? 0,
    exposure: ctx.exposure,
    ...(ctx.fire !== undefined ? { fire: ctx.fire } : {}),
    material: ctx.material,
  });
  const coverStatus: ValidationStatus = ctx.cover < reqCover ? "FAIL" : "PASS";
  out.push(
    item(
      "cover",
      coverStatus,
      round(ctx.cover),
      round(reqCover),
      ref,
      coverStatus === "FAIL"
        ? `Enrobage ${round(ctx.cover)} mm < requis ${round(reqCover)} mm`
        : `Enrobage ${round(ctx.cover)} mm (requis ${round(reqCover)} mm)`,
      coverStatus === "FAIL"
        ? `Cover ${round(ctx.cover)} mm < required ${round(reqCover)} mm`
        : `Cover ${round(ctx.cover)} mm (required ${round(reqCover)} mm)`,
      ctx.longitudinal.map((z) => z.groupId),
    ),
  );

  // effective depth governing shear = the span (sagging) zone's computed d
  const flexZone =
    ctx.longitudinal.find((z) => z.tensionFace === "BOTTOM") ?? ctx.longitudinal[0];
  const dShear = flexZone?.geometry.d ?? 0.9 * geometry.h;

  // --- stirrups: max spacing s ≤ 0.75·d, tie ø, leg-counted Asw (§7.5) ---
  for (const tz of ctx.transverse) {
    const sMax = 0.75 * dShear;
    const status: ValidationStatus =
      tz.spacing > sMax ? "FAIL" : tz.spacing > sMax * (1 - bands.spacing) ? "WARN" : "PASS";
    out.push(
      item(
        `stirrup_spacing:${tz.zone}`,
        status,
        round(tz.spacing),
        round(sMax),
        ref,
        status === "FAIL"
          ? `Espacement cadres ${round(tz.spacing)} mm > max 0.75·d = ${round(sMax)} mm`
          : `Espacement cadres ${round(tz.spacing)} mm (max 0.75·d = ${round(sMax)} mm)`,
        status === "FAIL"
          ? `Stirrup spacing ${round(tz.spacing)} mm > max 0.75·d = ${round(sMax)} mm`
          : `Stirrup spacing ${round(tz.spacing)} mm (max 0.75·d = ${round(sMax)} mm)`,
        [tz.groupId],
      ),
    );

    const tieMin = code.tieDiameterMin ? code.tieDiameterMin(ctx.phiLMax) : Math.max(6, ctx.phiLMax / 3);
    out.push(
      item(
        `tie_diameter:${tz.zone}`,
        tz.diameter >= tieMin ? "PASS" : "FAIL",
        tz.diameter,
        round(tieMin),
        ref,
        tz.diameter >= tieMin
          ? `Ø cadre ${tz.diameter} mm ≥ min ${round(tieMin)} mm`
          : `Ø cadre ${tz.diameter} mm < min ${round(tieMin)} mm`,
        tz.diameter >= tieMin
          ? `Stirrup ø ${tz.diameter} mm ≥ min ${round(tieMin)} mm`
          : `Stirrup ø ${tz.diameter} mm < min ${round(tieMin)} mm`,
        [tz.groupId],
      ),
    );

    if (tz.aswReqPerM > 0) {
      // A2: the sparsest (widest) region governs the minimum Asw/m (uniform set → tz.spacing).
      const aswSpacing = governingAswSpacing(tz);
      const aswProv = aswProvidedPerMetre(tz.nLegs, tz.diameter, aswSpacing);
      const regionNote = tz.regions && tz.regions.length > 1 ? ` @ région ${round(aswSpacing)} mm` : "";
      const aswStatus: ValidationStatus =
        aswProv < tz.aswReqPerM
          ? "FAIL"
          : aswProv < tz.aswReqPerM * (1 + bands.spacing)
          ? "WARN"
          : "PASS";
      out.push(
        item(
          `asw_leg_count:${tz.zone}`,
          aswStatus,
          round(aswProv),
          round(tz.aswReqPerM),
          ref,
          aswStatus === "FAIL"
            ? `Asw fourni ${round(aswProv)} mm²/m < requis ${round(tz.aswReqPerM)} mm²/m (${tz.nLegs} brins${regionNote})`
            : `Asw fourni ${round(aswProv)} mm²/m (${tz.nLegs} brins${regionNote})`,
          aswStatus === "FAIL"
            ? `Provided Asw ${round(aswProv)} mm²/m < required ${round(tz.aswReqPerM)} mm²/m (${tz.nLegs} legs${regionNote})`
            : `Provided Asw ${round(aswProv)} mm²/m (${tz.nLegs} legs${regionNote})`,
          [tz.groupId],
        ),
      );
    }
  }

  // --- end-support bottom-bar anchorage: ≥ 0.25·As,span past the support (§7.7) ---
  if (flexZone) {
    const continued = (flexZone.continuedToSupport ?? 1) * flexZone.asProv;
    const need = END_SUPPORT_FRACTION * flexZone.asProv;
    const ok = continued >= need;
    out.push(
      item(
        "end_support_anchorage",
        ok ? "PASS" : "WARN",
        round(continued),
        round(need),
        ref,
        ok
          ? `Ancrage sur appui ${mm2(continued)} ≥ ${END_SUPPORT_FRACTION}·As,travée (${mm2(need)})`
          : `Ancrage sur appui ${mm2(continued)} < ${END_SUPPORT_FRACTION}·As,travée (${mm2(need)}) — prolonger des barres`,
        ok
          ? `End-support anchorage ${mm2(continued)} ≥ ${END_SUPPORT_FRACTION}·As,span (${mm2(need)})`
          : `End-support anchorage ${mm2(continued)} < ${END_SUPPORT_FRACTION}·As,span (${mm2(need)}) — carry bars past support`,
        [flexZone.groupId],
      ),
    );
  }

  // --- v1.0.4 B2 (§7.7): per-support bottom-bar anchorage LENGTH. Each support (V1/V2) is checked
  // independently: the provided anchorage into the support must reach the required design anchorage
  // for the span (tension) bars — a *hooked* l_bd (an end-support bottom bar is anchored with a
  // standard hook), reduced by As,req/As,prov. Asymmetric supports → two distinct verdicts; a
  // symmetric beam gives two identical PASSes (the default hooked anchorage clears the requirement). ---
  if (flexZone && ctx.supports && ctx.supports.length > 0) {
    const asRatio = flexZone.asProv > 0 ? Math.min(1, flexZone.asReq / flexZone.asProv) : 1;
    const needA = code.lbd({
      diameter: flexZone.diameter,
      material: ctx.material,
      goodBond: true,
      hooked: true,
      asReqOverProv: asRatio,
    });
    for (const sup of ctx.supports) {
      const ok = sup.anchorage >= needA;
      out.push(
        item(
          `support_anchorage:${sup.id}`,
          ok ? "PASS" : "WARN",
          round(sup.anchorage),
          round(needA),
          ref,
          ok
            ? `Ancrage barres inf. sur appui ${sup.id} ${round(sup.anchorage)} mm ≥ l_bd ${round(needA)} mm`
            : `Ancrage barres inf. sur appui ${sup.id} ${round(sup.anchorage)} mm < l_bd ${round(needA)} mm — prolonger / crocheter`,
          ok
            ? `Bottom-bar anchorage at support ${sup.id} ${round(sup.anchorage)} mm ≥ l_bd ${round(needA)} mm`
            : `Bottom-bar anchorage at support ${sup.id} ${round(sup.anchorage)} mm < l_bd ${round(needA)} mm — extend / hook`,
          [flexZone.groupId],
        ),
      );
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// CIRCULAR_COLUMN — circular spiral column (E-COL-02) + drilled-shaft pile (E-FND-01).
// Pack-agnostic: all limits via code.* (the BAEL/EC2 swap is a data swap, §7.11). Handles any
// number of longitudinal zones (e.g. pile As_longitudinal + As_dowels); the PRIMARY pitch-circle
// zone gets the min-bars (≥6), ratio, and arc clear-spacing checks (§6.1, §7.4).
// ---------------------------------------------------------------------------
export function validateCircularColumnProfile(ctx: ProfileContext): ValidationItem[] {
  const circ = ctx.circular;
  if (!circ) throw new Error("CIRCULAR_COLUMN: expects a circular layout");
  const { code } = ctx;
  const ref = code.codeRef ?? code.id;
  const out: ValidationItem[] = [];
  const Ac = (Math.PI * circ.D * circ.D) / 4;
  const bands = code.warnBands ?? { spacing: 0.05, anchorage: 0.05, cover: 0.1 };

  // provided area for every longitudinal zone (primary pitch-circle bars + dowels/starters)
  for (const lz of ctx.longitudinal) {
    const ok = lz.asProv >= lz.asReq;
    out.push(
      item(
        `provided_area:${lz.zone}`,
        ok ? "PASS" : "FAIL",
        round(lz.asProv),
        round(lz.asReq),
        ref,
        ok
          ? `Acier fourni ${mm2(lz.asProv)} ≥ requis ${mm2(lz.asReq)} (${lz.zone})`
          : `Acier fourni ${mm2(lz.asProv)} < requis ${mm2(lz.asReq)} (${lz.zone})`,
        ok
          ? `Provided steel ${mm2(lz.asProv)} ≥ required ${mm2(lz.asReq)} (${lz.zone})`
          : `Provided steel ${mm2(lz.asProv)} < required ${mm2(lz.asReq)} (${lz.zone})`,
        [lz.groupId],
      ),
    );
  }

  const primary = ctx.longitudinal.find((z) => z.primary) ?? ctx.longitudinal[0];
  if (primary) {
    // min bars — circular minimum is 6 (§6.1, §7.4)
    const N = circ.count;
    const minOk = N >= CIRCULAR_MIN_BARS && !circ.underfilled;
    out.push(
      item(
        "min_bars",
        minOk ? "PASS" : "FAIL",
        N,
        CIRCULAR_MIN_BARS,
        ref,
        minOk
          ? `Nombre de barres ${N} ≥ ${CIRCULAR_MIN_BARS} (poteau circulaire)`
          : `Nombre de barres ${N} < ${CIRCULAR_MIN_BARS} (minimum poteau circulaire)`,
        minOk
          ? `Bar count ${N} ≥ ${CIRCULAR_MIN_BARS} (circular column)`
          : `Bar count ${N} < ${CIRCULAR_MIN_BARS} (circular column minimum)`,
        [primary.groupId],
      ),
    );

    // ratio limits
    const asMin = code.AsMin({ Ac, material: ctx.material, member: "COLUMN" });
    const asMax = code.AsMax({ Ac, material: ctx.material, member: "COLUMN" });
    const ratioStatus: ValidationStatus =
      primary.asProv < asMin || primary.asProv > asMax ? "FAIL" : "PASS";
    out.push(
      item(
        "ratio_limits",
        ratioStatus,
        round(primary.asProv),
        `[${round(asMin)}, ${round(asMax)}]`,
        ref,
        ratioStatus === "PASS"
          ? `Ratio d'acier dans [${mm2(asMin)}, ${mm2(asMax)}]`
          : `Ratio d'acier hors limites [${mm2(asMin)}, ${mm2(asMax)}]`,
        ratioStatus === "PASS"
          ? `Steel ratio within [${mm2(asMin)}, ${mm2(asMax)}]`
          : `Steel ratio outside [${mm2(asMin)}, ${mm2(asMax)}]`,
        [primary.groupId],
      ),
    );

    // arc clear spacing on the pitch circle (§6.1, §7.2)
    const sMin = Math.max(primary.diameter, ctx.dg + 5, 20);
    const s = circ.sArc;
    const spStatus: ValidationStatus =
      s < sMin ? "FAIL" : s < sMin * (1 + bands.spacing) ? "WARN" : "PASS";
    out.push(
      item(
        "clear_spacing",
        spStatus,
        round(s),
        round(sMin),
        ref,
        spStatus === "FAIL"
          ? `Espacement libre sur cercle ${round(s)} mm < min ${round(sMin)} mm`
          : `Espacement libre sur cercle ${round(s)} mm (min ${round(sMin)} mm)`,
        spStatus === "FAIL"
          ? `Pitch-circle clear spacing ${round(s)} mm < min ${round(sMin)} mm`
          : `Pitch-circle clear spacing ${round(s)} mm (min ${round(sMin)} mm)`,
        [primary.groupId],
      ),
    );
  }

  // cover (durability + fire; pile passes CAST_AGAINST_EARTH) — once for the section
  const reqCover = code.cover({
    diameter: ctx.phiLMax,
    phiT: ctx.transverse[0]?.diameter ?? 0,
    exposure: ctx.exposure,
    ...(ctx.fire !== undefined ? { fire: ctx.fire } : {}),
    material: ctx.material,
  });
  const coverStatus: ValidationStatus = ctx.cover < reqCover ? "FAIL" : "PASS";
  out.push(
    item(
      "cover",
      coverStatus,
      round(ctx.cover),
      round(reqCover),
      ref,
      coverStatus === "FAIL"
        ? `Enrobage ${round(ctx.cover)} mm < requis ${round(reqCover)} mm`
        : `Enrobage ${round(ctx.cover)} mm (requis ${round(reqCover)} mm)`,
      coverStatus === "FAIL"
        ? `Cover ${round(ctx.cover)} mm < required ${round(reqCover)} mm`
        : `Cover ${round(ctx.cover)} mm (required ${round(reqCover)} mm)`,
      ctx.longitudinal.map((z) => z.groupId),
    ),
  );

  // spiral / hoop confinement: spacing (pitch) ≤ code max, tie ø, leg-counted Asw (§7.5)
  for (const tz of ctx.transverse) {
    const sMax = code.tieSpacingMax({ bMin: circ.D, phiLMin: primary?.diameter ?? ctx.phiLMax });
    const status: ValidationStatus =
      tz.spacing > sMax ? "FAIL" : tz.spacing > sMax * (1 - bands.spacing) ? "WARN" : "PASS";
    out.push(
      item(
        `spiral_spacing:${tz.zone}`,
        status,
        round(tz.spacing),
        round(sMax),
        ref,
        status === "FAIL"
          ? `Pas de spirale ${round(tz.spacing)} mm > max ${round(sMax)} mm`
          : `Pas de spirale ${round(tz.spacing)} mm (max ${round(sMax)} mm)`,
        status === "FAIL"
          ? `Spiral pitch ${round(tz.spacing)} mm > max ${round(sMax)} mm`
          : `Spiral pitch ${round(tz.spacing)} mm (max ${round(sMax)} mm)`,
        [tz.groupId],
      ),
    );

    const tieMin = code.tieDiameterMin ? code.tieDiameterMin(ctx.phiLMax) : Math.max(6, ctx.phiLMax / 3);
    out.push(
      item(
        `tie_diameter:${tz.zone}`,
        tz.diameter >= tieMin ? "PASS" : "FAIL",
        tz.diameter,
        round(tieMin),
        ref,
        tz.diameter >= tieMin
          ? `Ø spirale ${tz.diameter} mm ≥ min ${round(tieMin)} mm`
          : `Ø spirale ${tz.diameter} mm < min ${round(tieMin)} mm`,
        tz.diameter >= tieMin
          ? `Spiral ø ${tz.diameter} mm ≥ min ${round(tieMin)} mm`
          : `Spiral ø ${tz.diameter} mm < min ${round(tieMin)} mm`,
        [tz.groupId],
      ),
    );

    if (tz.aswReqPerM > 0) {
      const aswProv = aswProvidedPerMetre(tz.nLegs, tz.diameter, governingAswSpacing(tz)); // A2: governing region
      const aswStatus: ValidationStatus =
        aswProv < tz.aswReqPerM ? "FAIL" : aswProv < tz.aswReqPerM * (1 + bands.spacing) ? "WARN" : "PASS";
      out.push(
        item(
          `asw_leg_count:${tz.zone}`,
          aswStatus,
          round(aswProv),
          round(tz.aswReqPerM),
          ref,
          aswStatus === "FAIL"
            ? `Asw fourni ${round(aswProv)} mm²/m < requis ${round(tz.aswReqPerM)} mm²/m`
            : `Asw fourni ${round(aswProv)} mm²/m`,
          aswStatus === "FAIL"
            ? `Provided Asw ${round(aswProv)} mm²/m < required ${round(tz.aswReqPerM)} mm²/m`
            : `Provided Asw ${round(aswProv)} mm²/m`,
          [tz.groupId],
        ),
      );
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Slab profiles (E-SLB-01 one-way, E-SLB-02 two-way), spec §7.4, §7.13.
// Shared core: per-zone provided area (per metre) + As,min + max bar spacing; the one-way profile
// adds slab_distribution_min, the two-way profile adds twoway_corner_torsion_missing.
// ---------------------------------------------------------------------------
function slabZoneChecks(ctx: ProfileContext): ValidationItem[] {
  const slab = ctx.slab;
  if (!slab) throw new Error("SLAB profile: expects a slab context");
  const { code } = ctx;
  const ref = code.codeRef ?? code.id;
  const out: ValidationItem[] = [];
  const bands = code.warnBands ?? { spacing: 0.05, anchorage: 0.05, cover: 0.1 };

  for (const z of slab.zones) {
    // provided steel per metre (§7.1)
    const ok = z.asProvPerM >= z.asReqPerM;
    out.push(
      item(
        `provided_area:${z.zone}`,
        ok ? "PASS" : "FAIL",
        round(z.asProvPerM),
        round(z.asReqPerM),
        ref,
        ok
          ? `Acier fourni ${mm2(z.asProvPerM)}/m ≥ requis ${mm2(z.asReqPerM)}/m (${z.zone})`
          : `Acier fourni ${mm2(z.asProvPerM)}/m < requis ${mm2(z.asReqPerM)}/m (${z.zone})`,
        ok
          ? `Provided steel ${mm2(z.asProvPerM)}/m ≥ required ${mm2(z.asReqPerM)}/m (${z.zone})`
          : `Provided steel ${mm2(z.asProvPerM)}/m < required ${mm2(z.asReqPerM)}/m (${z.zone})`,
        [z.groupId],
      ),
    );

    // non-fragilité As,min over a 1 m strip (§7.4), uses computed d
    const asMin = code.AsMin({ Ac: 1000 * slab.thickness, b: 1000, d: z.d, material: ctx.material, member: "SLAB" });
    const ratioStatus: ValidationStatus = z.asProvPerM < asMin ? "FAIL" : "PASS";
    out.push(
      item(
        `ratio_limits:${z.zone}`,
        ratioStatus,
        round(z.asProvPerM),
        round(asMin),
        ref,
        ratioStatus === "PASS"
          ? `As ≥ As,min ${mm2(asMin)}/m (${z.zone}, d=${round(z.d)} mm)`
          : `As ${mm2(z.asProvPerM)}/m < As,min ${mm2(asMin)}/m (${z.zone})`,
        ratioStatus === "PASS"
          ? `As ≥ As,min ${mm2(asMin)}/m (${z.zone}, d=${round(z.d)} mm)`
          : `As ${mm2(z.asProvPerM)}/m < As,min ${mm2(asMin)}/m (${z.zone})`,
        [z.groupId],
      ),
    );

    // max bar spacing (§7.4) — secondary mats use the relaxed limit
    const secondary = z.role === "SECONDARY";
    const sMax = code.slabSpacingMax ? code.slabSpacingMax(slab.thickness, secondary) : Math.min(3 * slab.thickness, 400);
    const spStatus: ValidationStatus =
      z.spacing > sMax ? "FAIL" : z.spacing > sMax * (1 - bands.spacing) ? "WARN" : "PASS";
    out.push(
      item(
        `bar_spacing:${z.zone}`,
        spStatus,
        round(z.spacing),
        round(sMax),
        ref,
        spStatus === "FAIL"
          ? `Espacement barres ${round(z.spacing)} mm > max ${round(sMax)} mm (${z.zone})`
          : `Espacement barres ${round(z.spacing)} mm (max ${round(sMax)} mm, ${z.zone})`,
        spStatus === "FAIL"
          ? `Bar spacing ${round(z.spacing)} mm > max ${round(sMax)} mm (${z.zone})`
          : `Bar spacing ${round(z.spacing)} mm (max ${round(sMax)} mm, ${z.zone})`,
        [z.groupId],
      ),
    );
  }

  // cover (durability + fire) once
  const reqCover = code.cover({
    diameter: ctx.phiLMax,
    phiT: 0,
    exposure: ctx.exposure,
    ...(ctx.fire !== undefined ? { fire: ctx.fire } : {}),
    material: ctx.material,
  });
  const coverStatus: ValidationStatus = ctx.cover < reqCover ? "FAIL" : "PASS";
  out.push(
    item(
      "cover",
      coverStatus,
      round(ctx.cover),
      round(reqCover),
      ref,
      coverStatus === "FAIL"
        ? `Enrobage ${round(ctx.cover)} mm < requis ${round(reqCover)} mm`
        : `Enrobage ${round(ctx.cover)} mm (requis ${round(reqCover)} mm)`,
      coverStatus === "FAIL"
        ? `Cover ${round(ctx.cover)} mm < required ${round(reqCover)} mm`
        : `Cover ${round(ctx.cover)} mm (required ${round(reqCover)} mm)`,
      slab.zones.map((z) => z.groupId),
    ),
  );

  return out;
}

export function validateSlabOneWayProfile(ctx: ProfileContext): ValidationItem[] {
  const slab = ctx.slab;
  if (!slab) throw new Error("SLAB_ONEWAY: expects a slab context");
  const { code } = ctx;
  const ref = code.codeRef ?? code.id;
  const out = slabZoneChecks(ctx);

  // slab_distribution_min (§7.13): As_dist ≥ fraction·As_main
  const main = slab.zones.find((z) => z.role === "MAIN");
  const dist = slab.zones.find((z) => z.role === "SECONDARY");
  if (main && dist) {
    const fraction = code.distMinFraction ?? 0.2;
    out.push(slabDistributionMin(main.asProvPerM, dist.asProvPerM, fraction, ref, [dist.groupId, main.groupId]));
  }
  return out;
}

export function validateSlabTwoWayProfile(ctx: ProfileContext): ValidationItem[] {
  const slab = ctx.slab;
  if (!slab) throw new Error("SLAB_TWOWAY: expects a slab context");
  const { code } = ctx;
  const ref = code.codeRef ?? code.id;
  const out = slabZoneChecks(ctx);

  // twoway_corner_torsion_missing (§7.13): restrained corner + empty torsion zone → WARN
  out.push(
    twowayCornerTorsionMissing(
      slab.restrainedCorner === true,
      slab.cornerTorsionProvided ?? 0,
      ref,
      slab.zones.map((z) => z.groupId),
    ),
  );
  return out;
}

// ---------------------------------------------------------------------------
// JOIST_SLAB — hollow-block joist slab (E-SLB-03), spec §3.1, §7.4, §7.13.
// A slab-family section: joist bottom (MAIN) + joist top support (TOP) + topping mesh (SECONDARY).
// Reuses the slab per-metre checks; the topping mesh provides the distribution minimum.
// ---------------------------------------------------------------------------
export function validateJoistSlabProfile(ctx: ProfileContext): ValidationItem[] {
  const slab = ctx.slab;
  if (!slab) throw new Error("JOIST_SLAB: expects a slab context");
  const { code } = ctx;
  const ref = code.codeRef ?? code.id;
  const out = slabZoneChecks(ctx);

  // topping mesh (SECONDARY) ≥ fraction·joist-bottom (MAIN) — distribution minimum (§7.13)
  const main = slab.zones.find((z) => z.role === "MAIN");
  const topping = slab.zones.find((z) => z.role === "SECONDARY");
  if (main && topping) {
    const fraction = code.distMinFraction ?? 0.2;
    out.push(slabDistributionMin(main.asProvPerM, topping.asProvPerM, fraction, ref, [topping.groupId, main.groupId]));
  }
  return out;
}

// ---------------------------------------------------------------------------
// STAIR — straight-flight stair (E-STR-01), spec §3.1, §7.4, §7.13.
// Slab-family flexure on the inclined waist (main bottom + distribution + top support over the
// landing) PLUS the re-entrant-corner pull-out predicate at the flight↔landing kink.
// ---------------------------------------------------------------------------
export function validateStairProfile(ctx: ProfileContext): ValidationItem[] {
  const slab = ctx.slab;
  const stair = ctx.stair;
  if (!slab) throw new Error("STAIR: expects a slab (waist) context");
  if (!stair) throw new Error("STAIR: expects a stair context");
  const { code } = ctx;
  const ref = code.codeRef ?? code.id;
  const out = slabZoneChecks(ctx);

  // distribution minimum on the waist (As_dist ≥ fraction·As_main)
  const main = slab.zones.find((z) => z.role === "MAIN");
  const dist = slab.zones.find((z) => z.role === "SECONDARY");
  if (main && dist) {
    const fraction = code.distMinFraction ?? 0.2;
    out.push(slabDistributionMin(main.asProvPerM, dist.asProvPerM, fraction, ref, [dist.groupId, main.groupId]));
  }

  // the construction-aware check: a tension bar wrapped around the re-entrant corner (§7.13)
  out.push(
    stairReentrantCornerPullout(stair.reentrantCorner, stair.mainBarWrapsCorner, ref, [stair.mainGroupId]),
  );
  return out;
}

/** The profile registry. Adding an element = register a profile + ship manifests (no engine edit). */
export const VALIDATION_PROFILES: Record<string, ProfileValidator> = {
  // NOTE: profile validators are PACK-AGNOSTIC (all limits via code.*). The "BAEL_" prefix on the
  // P1/P3 entries is legacy naming — they validate identically under the EC2 pack (pack swap =
  // data swap, tests/pack_swap.spec.ts). New P4a families use neutral element-family names.
  BAEL_COLUMN: validateColumnProfile,
  BAEL_BEAM: validateBeamProfile,
  CIRCULAR_COLUMN: validateCircularColumnProfile,
  SLAB_ONEWAY: validateSlabOneWayProfile,
  SLAB_TWOWAY: validateSlabTwoWayProfile,
  // P4b — hardest geometries (hollow-block joist slab + straight-flight stair)
  JOIST_SLAB: validateJoistSlabProfile,
  STAIR: validateStairProfile,
};

export function getValidationProfile(id: string): ProfileValidator {
  const p = VALIDATION_PROFILES[id];
  if (!p) throw new Error(`unknown validation profile "${id}" (registered: ${Object.keys(VALIDATION_PROFILES).join(", ")})`);
  return p;
}
