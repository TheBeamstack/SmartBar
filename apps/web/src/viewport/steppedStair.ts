/**
 * PURE stepped-stair concrete geometry (v1.0.4 D1, spec Part V D1; builds on G8/D-V103-8).
 *
 * The engine models a stair as a FLAT slab-family rect envelope (waist × width, bars along the
 * going). For E-STR-01 the viewport rebuilds the concrete as a real stepped profile from the stair
 * geometry so the transparent solid reads as an actual staircase. This module is the geometry ONLY —
 * no three / DOM — so the box layout (and the D1 landing) is unit-tested headlessly; `Viewport.tsx`
 * just renders the boxes it returns.
 *
 * Frame: member axis = +Y (the going/run), rise = +Z, width = X (see `MemberPlacement`). Boxes are
 * centred on the member origin, matching the flat box they replace.
 */

/** One axis-aligned concrete box: centre `position` [x,y,z] (mm) + `size` [width, run, height] (mm). */
export interface StairBox {
  position: [number, number, number];
  size: [number, number, number];
}

export interface SteppedStairSpec {
  /** one solid box per tread (solid to the base → a full staircase silhouette). */
  steps: StairBox[];
  /**
   * D1: the top landing modelled as a flat slab of the waist thickness, continuing PAST the flight
   * along +Y at the top rise level. `null` when `landing_L <= 0` (a plain flight, no landing).
   */
  landing: StairBox | null;
}

/**
 * Build the stepped-stair box layout. `g` going · `r` riser · `n_steps` · `flight_width` ·
 * (optional) `landing_L` waist `waist_t`. `fallbackWidth` supplies the width when the geometry omits
 * `flight_width` (e.g. the solved member's `b`). Pure + deterministic.
 */
export function steppedStairSpec(
  geometry: Record<string, number>,
  fallbackWidth: number,
): SteppedStairSpec {
  const g = geometry.g ?? 280;
  const r = geometry.r ?? 170;
  const n = Math.max(1, Math.round(geometry.n_steps ?? 14));
  const b = geometry.flight_width ?? fallbackWidth;
  const landingL = geometry.landing_L ?? 0;
  const waist = geometry.waist_t ?? r; // a riser-thick slab if the waist is unknown

  const L = n * g; // total going (run) along the member axis
  const R = n * r; // total rise
  const topZ = R / 2; // the top tread's upper surface, in the centred frame

  const steps: StairBox[] = [];
  for (let i = 0; i < n; i++) {
    const height = (i + 1) * r; // solid to the base
    const yc = -L / 2 + i * g + g / 2; // centred along the run (member +Y)
    const zc = -R / 2 + height / 2; // centred over its own rise (section +Z)
    steps.push({ position: [0, yc, zc], size: [b, g, height] });
  }

  // D1: the landing is a flat slab at the top level, extending past the flight along +Y. Its TOP
  // surface aligns with the top tread (topZ); its thickness is the waist.
  const landing: StairBox | null =
    landingL > 0
      ? { position: [0, L / 2 + landingL / 2, topZ - waist / 2], size: [b, landingL, waist] }
      : null;

  return { steps, landing };
}
