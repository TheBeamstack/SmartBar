/**
 * Contract #2 — Distribution (count or segmented spacing along a path).
 * Spec: v1.0-Spec.md §5.1.1 ([REF-DATA-510]).
 *
 * A single countOrSpacing cannot express real detailing (densified ends, seismic
 * critical zones). SPACING_ALONG_PATH supports piecewise spacing; the RPS overlay
 * (§7.10) injects END_* segments of length l_c and the user's spacing becomes MIDDLE.
 *
 * NOTE on reconciliation (recorded for the next agent): the spec lists
 * {FIXED_COUNT, SPACING_ALONG_PATH, EQUAL_PERIMETER, LAYERED, SYMMETRIC} in §5.4.
 * Of these, only FIXED_COUNT / SPACING_ALONG_PATH / EQUAL_PERIMETER are *distribution*
 * modes (how many / how spaced). LAYERED and SYMMETRIC are *layout principles* and live
 * on PlacementRule.layout.principle (see placement.ts), matching the §10 .rcfg example
 * (`"layout": { "principle": "SYMMETRIC", ... }`).
 */

export type DistributionMode = "FIXED_COUNT" | "SPACING_ALONG_PATH" | "EQUAL_PERIMETER";

/** A cross-section group with a fixed bar count (e.g. longitudinal bars). */
export interface FixedCountDistribution {
  mode: "FIXED_COUNT";
  count: number;
}

/** Circular longitudinal bars on the pitch circle (§6.1 EQUAL_PERIMETER). */
export interface EqualPerimeterDistribution {
  mode: "EQUAL_PERIMETER";
  count: number;
}

/** One ordered span of the placement path with its own spacing. Validation + BBS run per segment. */
export interface DistributionSegment {
  /** e.g. END_BOTTOM | MIDDLE | END_TOP | a user region tag. */
  region: string;
  /** length expression: "l_c" (seismic), "0.25*L", "remainder", or "all". */
  extent: string;
  /** centre-to-centre spacing (mm). */
  spacing: number;
}

/** Transverse steel repeating along a path (column height, beam length, spiral axis). */
export interface SpacingAlongPathDistribution {
  mode: "SPACING_ALONG_PATH";
  /** resolved by §5.4, e.g. "placement.path", or a bound spacing expr ("= tie.spacing"). */
  path?: string;
  /** uniform shorthand; the engine (P1) normalizes a bare spacing to a single "all" segment. */
  spacing?: number;
  /** explicit piecewise segments (the densified / seismic case). */
  segments?: DistributionSegment[];
}

export type Distribution =
  | FixedCountDistribution
  | EqualPerimeterDistribution
  | SpacingAlongPathDistribution;
