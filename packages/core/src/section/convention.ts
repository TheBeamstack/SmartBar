/**
 * Coupe drawing conventions (spec §9.5, [REF-EXT-GAP-7]).
 *
 * The cutting-line/tag style, default look-behind depth, and the near-parallel angle threshold
 * are REGIONAL drawing-standard choices, so they live here as data (1.0.1 swaps them per region /
 * code pack). The numeric values below are **provisional** owner conventions (spec §14 open items
 * 14–16) — flagged like the BAEL/EC2/RPS constants until ratified.
 */
export interface CoupeConvention {
  /**
   * Near-parallel angle threshold (degrees). A bar whose crossing angle with the cut plane is
   * BELOW this renders as a line (elevation run) instead of a circle (section dot). §14 item 16,
   * proposed ≈ 20–30°.
   */
  nearParallelDeg: number;
  /**
   * Default look-behind depth (mm) when a cut omits `lookBehind_mm` and the member has no
   * transverse spacing to derive it from. §14 item 15.
   */
  defaultLookBehind_mm: number;
  /**
   * Clamp band [min, max] (mm) applied to a look-behind derived from the transverse spacing, so a
   * cut landing between two stirrups still shows the nearest one. §14 item 15, proposed 100–150.
   */
  lookBehindClamp: [number, number];
  /** tag letters for auto-incrementing coupes (A, B, C, …). §14 item 14. */
  tagFor: (index: number) => string;
  /** French coupe label from a tag, e.g. "A" → "Coupe A-A". */
  labelFor: (tag: string) => string;
  /** provisional until the owner ratifies the coupe conventions (§14). */
  _provisional: boolean;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Default (French) coupe convention — provisional pending §14 sign-off. */
export const DEFAULT_COUPE_CONVENTION: CoupeConvention = {
  nearParallelDeg: 25,
  defaultLookBehind_mm: 120,
  lookBehindClamp: [100, 150],
  tagFor: (i) => {
    // A..Z, then AA, AB, … (deterministic, no overflow surprises).
    let n = Math.max(0, Math.floor(i));
    let out = "";
    do {
      out = ALPHABET[n % 26] + out;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return out;
  },
  labelFor: (tag) => `Coupe ${tag}-${tag}`,
  _provisional: true,
};

/**
 * Resolve the look-behind depth for a member from a cut + convention: an explicit `lookBehind_mm`
 * wins; otherwise derive ≈ one transverse spacing clamped to the convention band; otherwise the
 * convention default (spec §9.5.3, §14 item 15).
 */
export function resolveLookBehind(
  explicit: number | undefined,
  transverseSpacing: number | undefined,
  conv: CoupeConvention = DEFAULT_COUPE_CONVENTION,
): number {
  if (explicit !== undefined && explicit > 0) return explicit;
  if (transverseSpacing !== undefined && transverseSpacing > 0) {
    const [lo, hi] = conv.lookBehindClamp;
    return Math.min(hi, Math.max(lo, transverseSpacing));
  }
  return conv.defaultLookBehind_mm;
}
