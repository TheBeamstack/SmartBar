/**
 * Seismic overlay contract (spec §7.10 [REF-MATH-710]).
 *
 * The seismic overlay (RPS 2000/2011) is a SEPARATE composable data module that rides on top of
 * the chosen concrete code pack (BAEL or EC2) — it never replaces it. It (1) injects critical-zone
 * (`l_c`) segments into a member's transverse distribution (§5.1.1), (2) tightens limits per
 * ductility class, (3) forces 135°/≥10φ hooks, and (4) promotes confinement add-ons to required.
 *
 * Just like a `CodePack`, the engine stays overlay-agnostic: it calls these named functions, and
 * the RPS implementation (packages/codepacks/src/seismic/) supplies the constants + behaviour.
 * A future seismic code (ACI 318 + ASCE 7, EC8) implements the same interface — no engine change.
 *
 * ⚠ The numeric cells are gated by G-RPS (§14.5/§14.6); ship `_provisional: true` until ratified.
 * Pure + deterministic — no DOM/React/three, no Date.now()/Math.random().
 */

/** Moroccan parasismic ductility class. */
export type Ductility = "ND1" | "ND2" | "ND3";

/** The user-selected seismic regime (null = pure gravity → overlay inert). */
export interface SeismicRegime {
  /** overlay id, e.g. "RPS-2011". */
  code: string;
  /** seismic zone — opaque key into the overlay's `a_g` map (§7.10 zone note). */
  zone: number;
  ductility: Ductility;
}

/**
 * One piecewise segment of a transverse distribution after the overlay injects critical zones
 * (spec §5.1.1). The user's single spacing becomes the `MIDDLE` segment; the overlay writes the
 * `END_*` plastic-hinge segments of length `l_c`.
 */
export interface CritZoneSegment {
  /** "END_BOTTOM" | "MIDDLE" | "END_TOP" (columns) / "END_LEFT"|"END_RIGHT" (beams). */
  region: string;
  /** length covered by this segment along the member axis (mm). */
  extent: number;
  /** tie spacing within this segment (mm). */
  spacing: number;
  /** true for the injected plastic-hinge (l_c) segments. */
  critical: boolean;
}

/** A lap / splice extent along a member axis, for the `lap_in_critical_zone` predicate (§7.13). */
export interface LapExtent {
  groupId: string;
  /** start / end station along the member axis (mm; 0..memberLength). */
  start: number;
  end: number;
}

/** Required hook geometry on ties/cross-ties/épingles in a seismic member (§7.10c). */
export interface SeismicHookRule {
  angle: 135;
  /** minimum hook extension as a multiple of φ (≥ 10φ). */
  extFactor: number;
}

/**
 * The seismic-overlay interface (spec §7.10). All numeric returns are SI (mm). Every method keys
 * its result off the regime's ductility class; the engine treats `zone` purely as a table key.
 */
export interface SeismicOverlay {
  id: string;
  /** true while the overlay's constants are unsigned (G-RPS). */
  _provisional: boolean;
  codeRef: string;
  regime: SeismicRegime;

  /** plastic-hinge / critical-zone length `l_c` (mm) at a member end (§7.10a). */
  criticalZoneLength(args: {
    member: "COLUMN" | "BEAM";
    /** largest cross-section dimension (mm). */
    hSectionMax: number;
    /** clear member length (mm). */
    clearLength: number;
  }): number;

  /** inject `END_*` + `MIDDLE` segments into a member's transverse distribution (§5.1.1, §7.10a). */
  injectCriticalSegments(args: {
    member: "COLUMN" | "BEAM";
    /** clear member length (mm). */
    memberLength: number;
    l_c: number;
    /** the user's (mid-span) tie spacing (mm). */
    userSpacing: number;
  }): CritZoneSegment[];

  /** max tie spacing inside a critical zone (mm), per ND class (§7.10b). */
  critSpacingMax(args: { phiL: number; bMin: number }): number;

  /** min tie ø inside a critical zone (mm), per ND class (§7.10b). */
  critTieDiameterMin(): number;

  /** required hook geometry on ties/cross-ties/épingles (§7.10c). */
  hookRule(): SeismicHookRule;

  /** confinement add-on supplement ids required for the section arrangement (§7.10b/c). */
  requiredConfinement(): string[];

  /** crosstie engagement requirement (§7.10b): ND1 none, ND2 alternate, ND3 every. */
  engagementRule(): "none" | "alternate" | "every";

  /** longitudinal-ratio uplift factor on the base AsMin per ND class (§7.10b). */
  longRatioUplift(): number;

  /** lap-in-critical-zone severity per ND class: ND2/3 FAIL, ND1 WARN (§7.10c). */
  lapInCriticalZoneTier(): "FAIL" | "WARN";
}
