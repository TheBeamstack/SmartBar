/**
 * Validation engine + construction-logic validity layer (spec §7, §0.1, §7.12).
 *
 * Each rule returns the frozen RuleResult contract (§7) plus a validity TIER assigned by
 * the layer above the rules (§0.1): FAIL→tier-1 🔴 (blocks export), WARN→tier-2 🟠 (exports
 * with "à vérifier"), PASS→tier-3 🟢. Severity (FAIL vs WARN) follows the normative policy
 * §7.12; per-rule WARN tolerance bands come from the active pack (G-TOL, provisional).
 *
 * Code-pack agnostic: all limits come through `code.*`. No `if (codePack === …)` branches.
 * Pure + deterministic.
 */
import type {
  CodePack,
  RuleResult,
  ValidationStatus,
  MaterialContext,
} from "../types/codepack";
import type { RectLayoutResult } from "../layout/rect";
import type { ZoneGeometry, FaceTag } from "../types/layout";

/** Optional pack surface the engine reads when present (still fully pack-agnostic). */
export interface CodePackExtras {
  _provisional?: boolean;
  codeRef?: string;
  warnBands?: { spacing: number; anchorage: number; cover: number };
  minShearStress_MPa?: number;
  tieDiameterMin?(phiLMax: number): number;
  lsStraight?(diameter: number, material: MaterialContext): number;
  /** max slab bar spacing (mm), §7.4 (principal vs secondary/distribution). P4a. */
  slabSpacingMax?(h: number, secondary: boolean): number;
  /** min distribution/secondary steel as a fraction of main steel, §7.4 (default 0.20). P4a. */
  distMinFraction?: number;
}
export type ExtendedCodePack = CodePack & CodePackExtras;

export type Tier = 1 | 2 | 3;
export const TIER_SYMBOL: Record<Tier, "🔴" | "🟠" | "🟢"> = { 1: "🔴", 2: "🟠", 3: "🟢" };

export interface ValidationItem extends RuleResult {
  /** rule id (stable key, e.g. "provided_area"). */
  rule: string;
  tier: Tier;
  symbol: "🔴" | "🟠" | "🟢";
}

export function tierFor(status: ValidationStatus): Tier {
  return status === "FAIL" ? 1 : status === "WARN" ? 2 : 3;
}

/** Roll up per-rule statuses into the deterministic element status (§7.9). */
export function rollupStatus(items: ValidationItem[]): ValidationStatus {
  if (items.some((i) => i.status === "FAIL")) return "FAIL";
  if (items.some((i) => i.status === "WARN")) return "WARN";
  return "PASS";
}

const PI = Math.PI;
export const barArea = (phi: number): number => (PI * phi * phi) / 4;

/** Leg-counted provided transverse area per metre (§7.5, normative). */
export function aswProvidedPerMetre(nLegs: number, phiT: number, spacing: number): number {
  if (spacing <= 0) return 0;
  return (nLegs * barArea(phiT) * 1000) / spacing;
}

/** Generalized clear spacing on a face of `n` equal bars between corners (§7.2). */
export function clearSpacing(coreEdge: number, n: number, phiL: number): number {
  if (n <= 1) return coreEdge;
  // coreEdge is the centre-to-centre span between the two corner bars on that face
  return (coreEdge - (n - 1) * phiL) / (n - 1);
}

/** Build a tiered ValidationItem (shared by all validation profiles, §7/§0.1). */
export function item(
  rule: string,
  status: ValidationStatus,
  value: number | string | null,
  limit: number | string | null,
  codeRef: string,
  message_fr: string,
  message_en: string,
  affectedGroupIds: string[],
): ValidationItem {
  const tier = tierFor(status);
  return {
    rule,
    status,
    value,
    limit,
    codeRef,
    message_fr,
    message_en,
    affectedGroupIds,
    tier,
    symbol: TIER_SYMBOL[tier],
  };
}

export interface ColumnZoneInputs {
  /** longitudinal group: As_total zone. */
  longGroupId: string;
  phiL: number;
  /** largest longitudinal ø present (for tie-ø rule). */
  phiLMax: number;
  asReq: number; // mm²
  /** transverse group: confinement. */
  tieGroupId: string;
  phiT: number;
  tieSpacing: number; // mm
  /** legs crossing the confinement plane (CADRE_RECT=2 + cross-ties). */
  nLegs: number;
  aswReqPerM: number; // mm²/m
  /**
   * v1.0.4 A2: governing (widest-region) spacing for the Asw check, when the tie set has per-region
   * spacing (D-V102-5). Absent → `tieSpacing` (uniform set, byte-identical). The `tie_spacing` max
   * check still uses `tieSpacing` (the representative), only Asw provision uses the governing region.
   */
  aswSpacing?: number;
  /**
   * v1.0.4 B3 ([REF-SYS-756c], §5.4): extra provided Asw/m from an anchored confinement add-on (an
   * interior DIAMANT tie) crossing the shear plane, credited at its derived orientation factor. Added
   * to the leg-counted provision. Absent → 0 (byte-identical).
   */
  aswProvExtraPerM?: number;
  /** optional user-set tie bend mandrel ø (mm); checked vs code min + enclosed-bar clearance. */
  userTieMandrel?: number;
  /**
   * v1.0.4 A2: exact provided steel area (mm²) = Σ(π/4)·Øᵢ² over the REAL placed set (overrides +
   * removed + assigned extras), replacing the count×area shortcut for `provided_area`/`ratio_limits`.
   * Absent → the grouped `N·barArea(phiL)` path (byte-identical to pre-A2).
   */
  asProvExact?: number;
  /**
   * v1.0.4 (A2 completeness): REAL placed longitudinal bar count over the addressable channel
   * (removals excluded, extras included). Drives `min_bars` so removing bars below the code minimum
   * FAILs (and blocks export). Absent → the nominal `layout.count` (grouped docs, byte-identical).
   */
  placedCount?: number;
  /**
   * v1.0.4 (A2 completeness): faces left with < 2 bars after removals, replacing
   * `layout.underfilledFaces` for `face_min_bars`. Absent → the layout value (byte-identical).
   */
  placedUnderfilledFaces?: FaceTag[];
}

export interface ColumnValidationContext {
  geometry: { b: number; h: number; H: number };
  cover: number;
  exposure: string;
  fire?: string;
  dg: number;
  material: MaterialContext;
  layout: RectLayoutResult;
  zones: ZoneGeometry[];
  inputs: ColumnZoneInputs;
  code: ExtendedCodePack;
}

/**
 * Validate a rectangular tied column (E-COL-01, BAEL profile). Returns the per-rule
 * results with tiers. Severity per §7.12; bands per pack (provisional).
 */
export function validateColumn(ctx: ColumnValidationContext): ValidationItem[] {
  const { geometry, code, inputs, layout } = ctx;
  const ref = code.codeRef ?? code.id;
  const out: ValidationItem[] = [];
  const Ac = geometry.b * geometry.h;
  const N = layout.count;
  // A2 completeness: min_bars / face_min judge the REAL placed set when the addressable channel is
  // active (removals), else the nominal layout (byte-identical).
  const nBars = inputs.placedCount ?? N;
  const underfilled = inputs.placedUnderfilledFaces ?? layout.underfilledFaces;
  const asProv = inputs.asProvExact ?? N * barArea(inputs.phiL);
  const bands = code.warnBands ?? { spacing: 0.05, anchorage: 0.05, cover: 0.1 };

  // 7.1 provided area
  out.push(
    item(
      "provided_area",
      asProv >= inputs.asReq ? "PASS" : "FAIL",
      round(asProv),
      round(inputs.asReq),
      ref,
      asProv >= inputs.asReq
        ? `Acier fourni ${mm2(asProv)} ≥ requis ${mm2(inputs.asReq)}`
        : `Acier fourni ${mm2(asProv)} < requis ${mm2(inputs.asReq)}`,
      asProv >= inputs.asReq
        ? `Provided steel ${mm2(asProv)} ≥ required ${mm2(inputs.asReq)}`
        : `Provided steel ${mm2(asProv)} < required ${mm2(inputs.asReq)}`,
      [inputs.longGroupId],
    ),
  );

  // 7.4 min bars (rect column = 4) + per-face minimum (§6.1.2)
  out.push(
    item(
      "min_bars",
      nBars >= 4 ? "PASS" : "FAIL",
      nBars,
      4,
      ref,
      nBars >= 4 ? `Nombre de barres ${nBars} ≥ 4` : `Nombre de barres ${nBars} < 4 (minimum poteau)`,
      nBars >= 4 ? `Bar count ${nBars} ≥ 4` : `Bar count ${nBars} < 4 (column minimum)`,
      [inputs.longGroupId],
    ),
  );
  if (underfilled.length > 0) {
    out.push(
      item(
        "face_min_bars",
        "FAIL",
        underfilled.join(","),
        2,
        ref,
        `Face(s) ${underfilled.join(", ")} avec < 2 barres (impossible)`,
        `Face(s) ${underfilled.join(", ")} have < 2 bars (impossible)`,
        [inputs.longGroupId],
      ),
    );
  }

  // 7.4 ratio limits
  const asMin = code.AsMin({ Ac, b: geometry.b, material: ctx.material, member: "COLUMN" });
  const asMax = code.AsMax({ Ac, material: ctx.material, member: "COLUMN" });
  const ratioStatus: ValidationStatus =
    asProv < asMin || asProv > asMax ? "FAIL" : "PASS";
  out.push(
    item(
      "ratio_limits",
      ratioStatus,
      round(asProv),
      `[${round(asMin)}, ${round(asMax)}]`,
      ref,
      ratioStatus === "PASS"
        ? `Ratio d'acier dans [${mm2(asMin)}, ${mm2(asMax)}]`
        : `Ratio d'acier hors limites [${mm2(asMin)}, ${mm2(asMax)}]`,
      ratioStatus === "PASS"
        ? `Steel ratio within [${mm2(asMin)}, ${mm2(asMax)}]`
        : `Steel ratio outside [${mm2(asMin)}, ${mm2(asMax)}]`,
      [inputs.longGroupId],
    ),
  );

  // 7.2 clear spacing — checked per face on the resolved core edge
  const sMin = Math.max(inputs.phiL, ctx.dg + 5, 20);
  let worst = Infinity;
  let worstFace = "TOP";
  const fc = layout.faceCounts;
  const faceEdges: { tag: string; n: number; edge: number }[] = [
    { tag: "TOP", n: fc.TOP, edge: layout.core.width },
    { tag: "BOTTOM", n: fc.BOTTOM, edge: layout.core.width },
    { tag: "LEFT", n: fc.LEFT, edge: layout.core.height },
    { tag: "RIGHT", n: fc.RIGHT, edge: layout.core.height },
  ];
  for (const f of faceEdges) {
    if (f.n < 2) continue;
    const s = clearSpacing(f.edge, f.n, inputs.phiL);
    if (s < worst) {
      worst = s;
      worstFace = f.tag;
    }
  }
  if (Number.isFinite(worst)) {
    const spacingStatus: ValidationStatus =
      worst < sMin ? "FAIL" : worst < sMin * (1 + bands.spacing) ? "WARN" : "PASS";
    out.push(
      item(
        "clear_spacing",
        spacingStatus,
        round(worst),
        round(sMin),
        ref,
        spacingStatus === "FAIL"
          ? `Espacement libre ${round(worst)} mm < min ${round(sMin)} mm (face ${worstFace})`
          : `Espacement libre ${round(worst)} mm (min ${round(sMin)} mm, face ${worstFace})`,
        spacingStatus === "FAIL"
          ? `Clear spacing ${round(worst)} mm < min ${round(sMin)} mm (face ${worstFace})`
          : `Clear spacing ${round(worst)} mm (min ${round(sMin)} mm, face ${worstFace})`,
        [inputs.longGroupId],
      ),
    );
  }

  // 7.3 cover
  const reqCover = code.cover({
    diameter: inputs.phiL,
    phiT: inputs.phiT,
    exposure: ctx.exposure,
    fire: ctx.fire,
    material: ctx.material,
  });
  // cover meeting durability + fire PASSES (§7.3). The §7.12 "comfort target" WARN band is a
  // separate, softer semantic deferred to a later phase to avoid noisy false warnings.
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
      [inputs.longGroupId],
    ),
  );

  // 7.5 tie spacing (zone courante)
  const sTmax = code.tieSpacingMax({
    bMin: Math.min(geometry.b, geometry.h),
    phiLMin: inputs.phiL,
  });
  const tieSpStatus: ValidationStatus =
    inputs.tieSpacing > sTmax
      ? "FAIL"
      : inputs.tieSpacing > sTmax * (1 - bands.spacing)
      ? "WARN"
      : "PASS";
  out.push(
    item(
      "tie_spacing",
      tieSpStatus,
      round(inputs.tieSpacing),
      round(sTmax),
      ref,
      tieSpStatus === "FAIL"
        ? `Espacement cadres ${round(inputs.tieSpacing)} mm > max ${round(sTmax)} mm`
        : `Espacement cadres ${round(inputs.tieSpacing)} mm (max ${round(sTmax)} mm)`,
      tieSpStatus === "FAIL"
        ? `Tie spacing ${round(inputs.tieSpacing)} mm > max ${round(sTmax)} mm`
        : `Tie spacing ${round(inputs.tieSpacing)} mm (max ${round(sTmax)} mm)`,
      [inputs.tieGroupId],
    ),
  );

  // 7.5 tie diameter (φ_t ≥ φ_ℓ,max/3, ≥6)
  const tieMin = code.tieDiameterMin ? code.tieDiameterMin(inputs.phiLMax) : Math.max(6, inputs.phiLMax / 3);
  out.push(
    item(
      "tie_diameter",
      inputs.phiT >= tieMin ? "PASS" : "FAIL",
      inputs.phiT,
      round(tieMin),
      ref,
      inputs.phiT >= tieMin
        ? `Ø cadre ${inputs.phiT} mm ≥ min ${round(tieMin)} mm`
        : `Ø cadre ${inputs.phiT} mm < min ${round(tieMin)} mm`,
      inputs.phiT >= tieMin
        ? `Tie ø ${inputs.phiT} mm ≥ min ${round(tieMin)} mm`
        : `Tie ø ${inputs.phiT} mm < min ${round(tieMin)} mm`,
      [inputs.tieGroupId],
    ),
  );

  // 7.6 mandrel / bend feasibility — tie mandrel ≥ code min AND ≥ φ_ℓ (clears enclosed bar, §7.5)
  const reqMandrel = Math.max(code.mandrelMin(inputs.phiT), inputs.phiL);
  if (inputs.userTieMandrel !== undefined) {
    const ok = inputs.userTieMandrel >= reqMandrel;
    out.push(
      item(
        "mandrel_feasibility",
        ok ? "PASS" : "FAIL",
        round(inputs.userTieMandrel),
        round(reqMandrel),
        ref,
        ok
          ? `Mandrin cadre Ø ${round(inputs.userTieMandrel)} mm ≥ min ${round(reqMandrel)} mm`
          : `Mandrin cadre Ø ${round(inputs.userTieMandrel)} mm < min ${round(reqMandrel)} mm (écrasement béton)`,
        ok
          ? `Tie mandrel ø ${round(inputs.userTieMandrel)} mm ≥ min ${round(reqMandrel)} mm`
          : `Tie mandrel ø ${round(inputs.userTieMandrel)} mm < min ${round(reqMandrel)} mm (concrete crushing)`,
        [inputs.tieGroupId],
      ),
    );
  }

  // 7.5 leg-counted Asw/m vs required (A2: governing region spacing when set)
  if (inputs.aswReqPerM > 0) {
    const aswProv =
      aswProvidedPerMetre(inputs.nLegs, inputs.phiT, inputs.aswSpacing ?? inputs.tieSpacing) +
      (inputs.aswProvExtraPerM ?? 0);
    const aswStatus: ValidationStatus =
      aswProv < inputs.aswReqPerM
        ? "FAIL"
        : aswProv < inputs.aswReqPerM * (1 + bands.spacing)
        ? "WARN"
        : "PASS";
    out.push(
      item(
        "asw_leg_count",
        aswStatus,
        round(aswProv),
        round(inputs.aswReqPerM),
        ref,
        aswStatus === "FAIL"
          ? `Asw fourni ${round(aswProv)} mm²/m < requis ${round(inputs.aswReqPerM)} mm²/m (${inputs.nLegs} brins)`
          : `Asw fourni ${round(aswProv)} mm²/m (${inputs.nLegs} brins)`,
        aswStatus === "FAIL"
          ? `Provided Asw ${round(aswProv)} mm²/m < required ${round(inputs.aswReqPerM)} mm²/m (${inputs.nLegs} legs)`
          : `Provided Asw ${round(aswProv)} mm²/m (${inputs.nLegs} legs)`,
        [inputs.tieGroupId],
      ),
    );
  }

  return out;
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
export function mm2(n: number): string {
  return `${(n / 100).toFixed(2)} cm²`;
}
