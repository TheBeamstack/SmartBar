/**
 * Eurocode 2 (EN 1992-1-1) code pack (spec §7.1–7.8, §7.11) — the second v1.0 pack (P4a).
 *
 * Implements the SAME `CodePack` interface (packages/core/src/types/codepack.ts) as the BAEL
 * pack behind the SAME `code.*` names. Selecting EC2 vs BAEL swaps THIS implementation and
 * nothing else — archetypes, schemes, the layout solver and every validation profile stay
 * pack-agnostic (spec §7.11). Proven by tests/pack_swap.spec.ts.
 *
 * ⚠ Every numeric constant lives in ./ec2-constants.json flagged `"_provisional": true` and is
 * gated by G-EC2 (plan P4a, §14): ratification by the nominated engineer blocks P4a *acceptance*,
 * not coding. The formulas below are the standard EC2 relations.
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
import constants from "./ec2-constants.json";

const DEG = Math.PI / 180;

/** Optional pack extras the validation engine reads when present (still pack-agnostic). */
export interface PackExtras {
  _provisional: boolean;
  codeRef: string;
  warnBands: { spacing: number; anchorage: number; cover: number };
  /** EC2 min shear ratio coefficient ρ_w,min = factor·√f_ck / f_yk (§7.5). */
  minShearStress_MPa: number;
  /** EC2 §9.5.3: φ_t ≥ max(6, φ_ℓ,max/4). */
  tieDiameterMin(phiLMax: number): number;
  /** EC2 basic required anchorage l_b,rqd (good bond, full stress) (mm). */
  lsStraight(diameter: number, material: MaterialContext): number;
  /** EC2 §9.3.1.1 max slab bar spacing (mm). */
  slabSpacingMax(h: number, secondary: boolean): number;
  /** EC2 §9.3.1.1(2) distribution-steel minimum fraction of main steel. */
  distMinFraction: number;
}

export type Ec2Pack = CodePack & PackExtras;

function fck(material: MaterialContext): number {
  return material.f_ck ?? material.f_c28 ?? 25;
}
function fyk(material: MaterialContext): number {
  return material.f_yk ?? material.f_e ?? 500;
}
/** f_ctm = 0.30·f_ck^(2/3) (C ≤ 50/60). */
function fctm(material: MaterialContext): number {
  const m = constants.materials;
  return m.fctm_factor * Math.pow(fck(material), m.fctm_exp);
}
/** design tensile strength f_ctd = α_ct·f_ctk,0.05 / γ_c. */
function fctd(material: MaterialContext): number {
  const m = constants.materials;
  return (m.alpha_ct * (m.fctk005_factor * fctm(material))) / m.gamma_c;
}
function fyd(material: MaterialContext): number {
  return fyk(material) / constants.materials.gamma_s;
}

export function makeEc2Pack(): Ec2Pack {
  const mandrelMin = (diameter: number): number => {
    const m = constants.mandrel;
    const mult = diameter <= m.smallPhiThreshold_mm ? m.smallMultiple : m.largeMultiple;
    return mult * diameter;
  };

  const bendDeduction = (angle: number, diameter: number): number => {
    const r = mandrelMin(diameter) / 2 + diameter / 2;
    const halfDeg = Math.min(angle / 2, constants.bendDeduction.maxHalfAngle_deg);
    const ded = r * (2 * Math.tan(halfDeg * DEG) - angle * DEG);
    const cap = constants.bendDeduction.capFactorOfFilletRadius * r;
    return Math.max(0, Math.min(ded, cap));
  };

  /** bond stress f_bd = 2.25·η₁·η₂·f_ctd (§7.7). */
  const fbd = (material: MaterialContext, diameter: number, goodBond: boolean): number => {
    const a = constants.anchorage;
    const eta1 = goodBond ? 1 : a.eta1_poor;
    const eta2 = diameter > a.largePhiThreshold_mm ? a.eta2_large_phi : 1;
    return a.fbd_factor * eta1 * eta2 * fctd(material);
  };

  /** basic required anchorage l_b,rqd = (φ/4)·(σ_sd/f_bd). */
  const lbRqd = (diameter: number, material: MaterialContext, goodBond: boolean, sigmaSd: number): number =>
    (diameter / 4) * (sigmaSd / fbd(material, diameter, goodBond));

  // good-bond, full-stress l_b,rqd (used as the pack's "straight anchorage" extra)
  const lsStraight = (diameter: number, material: MaterialContext): number =>
    lbRqd(diameter, material, true, fyd(material));

  const lbMin = (lbrqd: number, diameter: number): number =>
    Math.max(
      constants.anchorage.lbMinFactorOfLbrqd * lbrqd,
      constants.anchorage.lbMinPhiMultiple * diameter,
      constants.anchorage.lbMinFloor_mm,
    );

  const lbd = (args: AnchorageArgs): number => {
    const goodBond = args.goodBond !== false;
    const reduce = Math.min(1, Math.max(0, args.asReqOverProv ?? 1));
    const sigmaSd = fyd(args.material) * reduce; // §7.7.1 As,req/As,prov stress reduction
    const lbrqd = lbRqd(args.diameter, args.material, goodBond, sigmaSd);
    // α₁..α₅ default to 1.0 (disclosed); l_bd = α·l_b,rqd ≥ l_b,min
    return Math.max(lbrqd, lbMin(lbRqd(args.diameter, args.material, goodBond, fyd(args.material)), args.diameter));
  };

  const l0 = (args: LapArgs): number => {
    const base = lbd(args);
    const alpha6 = (args.fractionLapped ?? 0) > 0.5 ? constants.anchorage.alpha6Over50pct : 1;
    return base * alpha6;
  };

  const AsMin = (args: AsLimitArgs): number => {
    const r = constants.ratios;
    if (args.member === "COLUMN") {
      const ratioTerm = r.columnMinRatioOfAc * args.Ac;
      const nEdTerm = args.NEd ? r.columnMinNEdFactor * (args.NEd / fyd(args.material)) : 0;
      return Math.max(ratioTerm, nEdTerm);
    }
    // beams + slabs: As,min = max(0.26·(f_ctm/f_yk)·b·d, 0.0013·b·d)
    const b = args.b ?? 0;
    const d = args.d ?? 0;
    return Math.max(
      r.beamMinFctmFactor * (fctm(args.material) / fyk(args.material)) * b * d,
      r.beamMinFloorFactor * b * d,
    );
  };

  const AsMax = (args: AsLimitArgs): number => constants.ratios.maxRatioOfAc * args.Ac;

  const tieSpacingMax = (args: TieSpacingArgs): number => {
    const c = constants.tieSpacing.column;
    let s = Math.min(c.phiLMultiple * args.phiLMin, args.bMin, c.absoluteCap_mm);
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
        const cFire = a - (args.phiT ?? 0) - args.diameter / 2;
        cMin = Math.max(cMin, cFire);
      }
    }
    return cMin + constants.cover.deltaCdev_mm;
  };

  const tieDiameterMin = (phiLMax: number): number => Math.max(6, phiLMax / 4);

  const slabSpacingMax = (h: number, secondary: boolean): number => {
    const s = constants.slab;
    return secondary
      ? Math.min(s.secondaryMaxFactorOfH * h, s.secondaryCap_mm)
      : Math.min(s.principalMaxFactorOfH * h, s.principalCap_mm);
  };

  /** ρ_w,min = 0.08·√f_ck / f_yk — surfaced as a MPa-equivalent floor for the §7.5 check. */
  const minShearStress = (material: MaterialContext): number =>
    constants.tieSpacing.shearRatioFactor * Math.sqrt(fck(material)) * 1; // ×f_yk handled in profile

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
    minShearStress_MPa: minShearStress({ f_ck: 25 }),
    tieDiameterMin,
    lsStraight,
    slabSpacingMax,
    distMinFraction: constants.slab.distMinFractionOfMain,
  };
}
