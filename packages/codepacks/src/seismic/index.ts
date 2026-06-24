/**
 * RPS 2000/2011 seismic overlay (spec §7.10 [REF-MATH-710]) — the Moroccan parasismic module.
 *
 * Implements the core `SeismicOverlay` interface (packages/core/src/types/seismic.ts) so the
 * engine stays overlay-agnostic: it rides on TOP of whichever concrete pack (BAEL or EC2) is
 * active, composing as keyed overrides (§7.10 "Overlay mechanism"). When the user picks no
 * seismic regime, the overlay is never constructed and detailing is pure gravity.
 *
 * ⚠ Every numeric cell lives in ./rps-2011.json flagged `"_provisional": true` and is gated by
 * G-RPS (§14.5/§14.6) — ratification by the nominated engineer blocks M4b *acceptance*, not
 * coding. The table shape + dispatch are final; only the values move once signed.
 *
 * Pure + deterministic: no DOM/React/three, no Date.now()/Math.random().
 */
import type {
  SeismicOverlay,
  SeismicRegime,
  Ductility,
  CritZoneSegment,
  SeismicHookRule,
} from "@rebarconfig/core";
import constants from "./rps-2011.json";

type CritSpacingCell = { phiLMultiple: number; bMinFraction: number; cap_mm: number };

/** Pick a per-ND-class cell, tolerating the JSON's `_note` documentation keys. */
function byClass<T>(table: unknown, nd: Ductility): T {
  return (table as Record<string, T>)[nd]!;
}

/** Build the RPS-2011 overlay for a chosen regime (zone + ductility class). */
export function makeRpsOverlay(regime: SeismicRegime): SeismicOverlay {
  const nd: Ductility = regime.ductility;
  const cz = constants.criticalZone;

  const criticalZoneLength: SeismicOverlay["criticalZoneLength"] = (args) => {
    if (args.member === "BEAM") return cz.beamHeightMultiple * args.hSectionMax;
    // column: max(h_section_max, H_clear/6, 450 mm)
    return Math.max(
      args.hSectionMax,
      args.clearLength / cz.columnClearLengthDivisor,
      cz.columnFloor_mm,
    );
  };

  const injectCriticalSegments: SeismicOverlay["injectCriticalSegments"] = (args) => {
    const { member, memberLength, l_c, userSpacing } = args;
    // clamp l_c so two end zones never overrun the member; the middle is the remainder.
    const lc = Math.min(l_c, memberLength / 2);
    const middle = Math.max(0, memberLength - 2 * lc);
    const ends = member === "BEAM" ? ["END_LEFT", "END_RIGHT"] : ["END_BOTTOM", "END_TOP"];
    return [
      { region: ends[0], extent: lc, spacing: userSpacing, critical: true },
      { region: "MIDDLE", extent: middle, spacing: userSpacing, critical: false },
      { region: ends[1], extent: lc, spacing: userSpacing, critical: true },
    ] as CritZoneSegment[];
  };

  const critSpacingMax: SeismicOverlay["critSpacingMax"] = (args) => {
    const cell = byClass<CritSpacingCell>(constants.critSpacing, nd);
    return Math.min(
      cell.phiLMultiple * args.phiL,
      cell.bMinFraction * args.bMin,
      cell.cap_mm,
    );
  };

  const critTieDiameterMin: SeismicOverlay["critTieDiameterMin"] = () =>
    byClass<number>(constants.minTieDiameter_mm, nd);

  const hookRule: SeismicOverlay["hookRule"] = () =>
    ({ angle: 135, extFactor: constants.hook.extFactor } as SeismicHookRule);

  const requiredConfinement: SeismicOverlay["requiredConfinement"] = () =>
    [...byClass<string[]>(constants.confinement, nd)];

  const engagementRule: SeismicOverlay["engagementRule"] = () =>
    byClass<"none" | "alternate" | "every">(constants.engagement, nd);

  const longRatioUplift: SeismicOverlay["longRatioUplift"] = () =>
    byClass<number>(constants.longRatioUplift, nd);

  const lapInCriticalZoneTier: SeismicOverlay["lapInCriticalZoneTier"] = () =>
    byClass<"FAIL" | "WARN">(constants.lapTier, nd);

  return {
    id: constants.id,
    _provisional: constants._provisional,
    codeRef: constants.codeRef,
    regime,
    criticalZoneLength,
    injectCriticalSegments,
    critSpacingMax,
    critTieDiameterMin,
    hookRule,
    requiredConfinement,
    engagementRule,
    longRatioUplift,
    lapInCriticalZoneTier,
  };
}
