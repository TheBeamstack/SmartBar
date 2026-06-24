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
import type { ZoneGeometry } from "../types/layout";
import type { RectLayoutResult, TensionFace } from "../layout/rect";
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
}

export interface ProfileContext {
  element: string;
  geometry: { b: number; h: number; H?: number; L?: number };
  cover: number;
  exposure: string;
  fire?: string;
  dg: number;
  material: MaterialContext;
  layout: RectLayoutResult;
  longitudinal: SolvedLongZone[];
  transverse: SolvedTransZone[];
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
  return validateColumn({
    geometry: { b: ctx.geometry.b, h: ctx.geometry.h, H: ctx.geometry.H ?? 0 },
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
    },
    code: ctx.code,
  });
}

// ---------------------------------------------------------------------------
// BAEL_BEAM — beam flexural + shear + curtailment (spec §7.4 beam, §7.5, §7.7).
// ---------------------------------------------------------------------------
const END_SUPPORT_FRACTION = 0.25; // β·As,span carried past the support (§7.7, EC2 §9.2.1.4)

export function validateBeamProfile(ctx: ProfileContext): ValidationItem[] {
  const { geometry, code, layout } = ctx;
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
      const aswProv = aswProvidedPerMetre(tz.nLegs, tz.diameter, tz.spacing);
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
            ? `Asw fourni ${round(aswProv)} mm²/m < requis ${round(tz.aswReqPerM)} mm²/m (${tz.nLegs} brins)`
            : `Asw fourni ${round(aswProv)} mm²/m (${tz.nLegs} brins)`,
          aswStatus === "FAIL"
            ? `Provided Asw ${round(aswProv)} mm²/m < required ${round(tz.aswReqPerM)} mm²/m (${tz.nLegs} legs)`
            : `Provided Asw ${round(aswProv)} mm²/m (${tz.nLegs} legs)`,
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

  return out;
}

/** The profile registry. Adding an element = register a profile + ship manifests (no engine edit). */
export const VALIDATION_PROFILES: Record<string, ProfileValidator> = {
  BAEL_COLUMN: validateColumnProfile,
  BAEL_BEAM: validateBeamProfile,
};

export function getValidationProfile(id: string): ProfileValidator {
  const p = VALIDATION_PROFILES[id];
  if (!p) throw new Error(`unknown validation profile "${id}" (registered: ${Object.keys(VALIDATION_PROFILES).join(", ")})`);
  return p;
}
