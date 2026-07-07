/**
 * BAEL 91 mod.99 / CBA 93 code pack (spec §7.11 [REF-MATH-720]) — the v1.0 default path.
 *
 * Implements the core `CodePack` interface (packages/core/src/types/codepack.ts) so
 * archetypes, schemes, and the validator stay pack-agnostic: selecting BAEL vs EC2 swaps
 * THIS implementation behind the same `code.*` names, nothing else (spec §7.11).
 *
 * ⚠ Every numeric constant lives in ./bael-constants.json flagged `"_provisional": true`
 * and is gated by G-BAEL (§14.5/§14.7) — ratification by the nominated engineer blocks P1
 * *acceptance*, not coding. The formulas below are the standard BAEL relations.
 *
 * Pure + deterministic: no DOM/React/three, no Date.now()/Math.random().
 */
import type {
  CodePack,
  AnchorageArgs,
  LapArgs,
  AsLimitArgs,
  TieSpacingArgs,
  CoverArgs,
  MaterialContext,
} from "@rebarconfig/core";
import constants from "./bael-constants.json";

const DEG = Math.PI / 180;

/** Optional pack extras the validation engine reads when present (still pack-agnostic). */
export interface PackExtras {
  _provisional: boolean;
  codeRef: string;
  warnBands: { spacing: number; anchorage: number; cover: number };
  /** min web shear stress utilisation (BAEL 0.4 MPa rule, §7.5/§7.11). */
  minShearStress_MPa: number;
  /** min transverse ø given the largest longitudinal ø (φ_t ≥ φ_ℓ,max/3, ≥6 mm). */
  tieDiameterMin(phiLMax: number): number;
  /** straight anchorage l_s (scellement) before α-reductions (mm). */
  lsStraight(diameter: number, material: MaterialContext): number;
  /** BAEL slab bar spacing (mm): principal min(3h,33cm) / secondary min(4h,45cm) (§7.11). */
  slabSpacingMax(h: number, secondary: boolean): number;
  /** min distribution/secondary steel as a fraction of main steel (§7.4, default 0.20). */
  distMinFraction: number;
}

export type BaelPack = CodePack & PackExtras;

function ft28(material: MaterialContext): number {
  const fc28 = material.f_c28 ?? 25;
  return constants.materials.ft28_a + constants.materials.ft28_b * fc28;
}
function tauSu(material: MaterialContext): number {
  // τ_su = 0.6·ψ_s²·f_t28
  return 0.6 * constants.materials.psi_s_HA ** 2 * ft28(material);
}
function fe(material: MaterialContext): number {
  return material.f_e ?? 500;
}

export function makeBaelPack(): BaelPack {
  const lsStraight = (diameter: number, material: MaterialContext): number =>
    (diameter * fe(material)) / (4 * tauSu(material));

  const mandrelMin = (diameter: number): number => {
    const m = constants.mandrel;
    const mult = diameter <= m.smallPhiThreshold_mm ? m.smallMultiple : m.largeMultiple;
    return mult * diameter;
  };

  const bendDeduction = (angle: number, diameter: number): number => {
    // provisional geometric model: r·(2·tan(θ/2) − θ), r = mandrelØ/2 + φ/2
    const r = mandrelMin(diameter) / 2 + diameter / 2;
    const halfDeg = Math.min(angle / 2, constants.bendDeduction.maxHalfAngle_deg);
    const ded = r * (2 * Math.tan(halfDeg * DEG) - angle * DEG);
    const cap = constants.bendDeduction.capFactorOfFilletRadius * r;
    return Math.max(0, Math.min(ded, cap));
  };

  const lbMin = (ls: number, diameter: number): number =>
    Math.max(
      constants.anchorage.lbMinFactorOfLs * ls,
      constants.anchorage.lbMinPhiMultiple * diameter,
      constants.anchorage.lbMinFloor_mm,
    );

  const lbd = (args: AnchorageArgs): number => {
    let ls = lsStraight(args.diameter, args.material);
    if (args.goodBond === false) ls /= constants.anchorage.poorBondFactor; // poor bond → longer
    // B2 (§A.6.1.253): a standard hook/bend reduces the required anchorage to hookedFactor·l_s.
    const hookFactor = args.hooked ? constants.anchorage.hookedFactor : 1;
    const reduce = args.asReqOverProv ?? 1;
    const reduced = ls * hookFactor * Math.min(1, Math.max(0, reduce));
    return Math.max(reduced, lbMin(ls, args.diameter));
  };

  const l0 = (args: LapArgs): number => {
    const base = lbd(args); // lap rides on l_s (BAEL l_r = l_s)
    const overlap =
      (args.fractionLapped ?? 0) > 0.5 ? constants.anchorage.lapOver50pctFactor : 1;
    return base * overlap;
  };

  const AsMin = (args: AsLimitArgs): number => {
    const fyd = fe(args.material) / constants.materials.gamma_s;
    if (args.member === "COLUMN") {
      const ratioTerm = constants.ratios.columnMinRatioOfB * args.Ac;
      // 4 cm²/m of perimeter when b is known (h = Ac/b)
      let perimTerm = 0;
      if (args.b && args.b > 0) {
        const h = args.Ac / args.b;
        const perimeter_m = (2 * (args.b + h)) / 1000;
        perimTerm = constants.ratios.columnMinPerimeter_mm2_per_m * perimeter_m;
      }
      const nEdTerm = args.NEd ? 0.1 * (args.NEd / fyd) : 0;
      return Math.max(ratioTerm, perimTerm, nEdTerm);
    }
    // beams + slabs: A_min = 0.23·b·d·(f_t28/f_e)  (non-fragilité)
    const b = args.b ?? 0;
    const d = args.d ?? 0;
    return constants.ratios.beamMinFactor * b * d * (ft28(args.material) / fe(args.material));
  };

  const AsMax = (args: AsLimitArgs): number => constants.ratios.maxRatioOfB * args.Ac;

  const tieSpacingMax = (args: TieSpacingArgs): number => {
    const c = constants.tieSpacing.column;
    let s = Math.min(
      c.phiLMultiple * args.phiLMin,
      c.absoluteCap_mm,
      args.bMin + c.sidePlusOffset_mm,
    );
    if (args.criticalZone) s *= constants.tieSpacing.criticalZoneFactor;
    return s;
  };

  const cover = (args: CoverArgs): number => {
    const table = constants.cover.byExposure_mm as Record<string, number>;
    const dur = table[args.exposure] ?? constants.cover.default_mm;
    let cMin = Math.max(dur, args.diameter, constants.cover.floor_mm);
    if (args.fire) {
      const fireMap = constants.cover.fireAxisDistance_mm as Record<string, number>;
      const a = fireMap[args.fire];
      if (a !== undefined) {
        // c_min,fire = axis distance − φ_t − φ_ℓ/2 (spec §7.3)
        const cFire = a - (args.phiT ?? 0) - args.diameter / 2;
        cMin = Math.max(cMin, cFire);
      }
    }
    return cMin + constants.cover.deltaCdev_mm;
  };

  const tieDiameterMin = (phiLMax: number): number => Math.max(6, phiLMax / 3);

  const slabSpacingMax = (h: number, secondary: boolean): number => {
    const s = constants.slab;
    return secondary
      ? Math.min(s.secondaryMaxFactorOfH * h, s.secondaryCap_mm)
      : Math.min(s.principalMaxFactorOfH * h, s.principalCap_mm);
  };

  return {
    id: constants.id,
    allowedDiameters: constants.allowedDiameters,
    mandrelMin,
    bendDeduction,
    lbd,
    l0,
    AsMin,
    AsMax,
    tieSpacingMax,
    cover,
    // --- extras (PackExtras) ---
    _provisional: constants._provisional,
    codeRef: constants.codeRef,
    warnBands: {
      spacing: constants.tolerance.spacingWarnBand,
      anchorage: constants.tolerance.anchorageWarnBand,
      cover: constants.tolerance.coverWarnBand,
    },
    minShearStress_MPa: constants.tieSpacing.minShearStress_MPa,
    tieDiameterMin,
    lsStraight,
    slabSpacingMax,
    distMinFraction: constants.slab.distMinFractionOfMain,
  };
}
