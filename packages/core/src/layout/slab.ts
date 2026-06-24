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
