/**
 * Slab / mat layout helpers (spec §6.1 "Slabs/mats", §7.4).
 *
 * Slab placement is a 1-D bar line per direction at `pitch = spacing`, offset by cover; the mat
 * itself is the TREILLIS_MESH generator (§5.2.1g). Provided steel is expressed PER METRE of
 * width (cm²/m at the UI edge, mm²/m internally), so the spacing — not a bar count — drives the
 * provided area. Pure + deterministic.
 */
import type { BarPosition } from "../types/layout";

const PI = Math.PI;

/** Provided steel per metre of width for bars at `spacing` (mm), ø `phi` (mm) → mm²/m. */
export function slabProvidedPerMetre(phi: number, spacing: number): number {
  if (spacing <= 0) return 0;
  return ((PI * phi * phi) / 4) * (1000 / spacing);
}

/**
 * Computed effective depth for a slab flexural zone ([REF-SYS-611]): `d = t − c − φ/2` for a
 * bottom (or single-layer) mat; the top-support mat measures from the bottom fibre identically.
 */
export function slabEffectiveDepth(t: number, cover: number, phi: number): number {
  return t - cover - phi / 2;
}

/**
 * Representative bar centroids across a slab width for rendering / spacing display. Section frame
 * here is the slab cross-section: u across the width, v through the thickness (v=+t/2 top fibre).
 */
export function solveSlabBars(
  width: number,
  spacing: number,
  v: number,
  faceTag: string,
): BarPosition[] {
  const out: BarPosition[] = [];
  if (spacing <= 0 || width <= 0) return out;
  const n = Math.floor(width / spacing) + 1;
  const half = width / 2;
  for (let i = 0; i < n; i++) {
    out.push({ position: { u: -half + i * spacing, v }, faceTag, layerIndex: 0, isCorner: false });
  }
  return out;
}

/**
 * v1.0.4 C1 ([REF-SYS-810], spec §C1): the DISTRIBUTION (secondary) layer of a slab / stair waist
 * physically runs ACROSS the width, distributed along the SPAN at `spacing` — perpendicular to the
 * main steel. Emit one cross-width bar per span station (world-Y), each flagged `across` so the
 * placement + coupe render it as a line across the width (main bars are the row of dots). This is
 * the exact geometry replacing the pre-C1 representative model, where distribution bars were fanned
 * along the span like short main bars (a second row of dots in the coupe).
 *
 * Stationing mirrors `transverseStations` (a margin in from each end, then `spacing`), so a
 * distribution bar sits close to the mid-span default cut. `span` is the member length
 * (`Lx` / going). Provided steel stays PER METRE (`slabProvidedPerMetre`, spacing-driven) — this
 * only changes where the bars are drawn, not the As accounting.
 */
/**
 * v1.0.4 C1: a distribution zone whose bars are a single discrete LINEAR bar (a DROITE répartition
 * bar) — the case that runs across the width. A welded topping MESH (`TREILLIS_MESH`, joist/two-way)
 * and a continuous coil are NOT discrete cross-width bars, so they keep the representative panel /
 * along-span render. Structural (marker) checks — no shape-id / element-type branch.
 */
export function isDistributionLinear(role: string, shape: object): boolean {
  return role === "DISTRIBUTION" && !("nWiresX" in shape) && !("coilLength" in shape);
}

export function solveSlabDistributionBars(
  span: number,
  spacing: number,
  v: number,
  faceTag: string,
): BarPosition[] {
  const out: BarPosition[] = [];
  if (spacing <= 0 || span <= 0) return out;
  const margin = Math.min(50, span / 2);
  for (let y = margin; y <= span - margin + 1e-6; y += spacing) {
    out.push({ position: { u: 0, v }, faceTag, layerIndex: 0, isCorner: false, across: true, axial: y });
  }
  if (out.length === 0) out.push({ position: { u: 0, v }, faceTag, layerIndex: 0, isCorner: false, across: true, axial: span / 2 });
  return out;
}
