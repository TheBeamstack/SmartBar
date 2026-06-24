/**
 * Shape registry — `archetypeId → generator` (spec §6 "Shape registry", §5.2.1g).
 *
 * THE SINGLE extension seam for novel geometry. Most archetypes are handled by the generic
 * segment-grammar generator (every open/closed planar polyline bent bar); only genuinely special
 * shapes whose centerline is not a planar polyline register a bespoke generator here. v1.0 has
 * exactly two: SPIRALE_HELICE and TREILLIS_MESH. Adding a new non-polyline shape = register one
 * function — nothing else in the pipeline changes.
 *
 * Pure + deterministic.
 */
import type { ShapeArchetype } from "../types/shape";
import type { CodePack } from "../types/codepack";
import { generateBarShape, type BarShapeResult } from "./segment-grammar";
import { generateHelix } from "./bespoke/helix";
import { generateMesh } from "./bespoke/mesh";

export type ShapeGenerator = (
  archetype: ShapeArchetype,
  params: Record<string, number>,
  diameter: number,
  code: CodePack,
) => BarShapeResult;

/** Bespoke (non-polyline) generators, keyed by archetype id (§5.2.1g). */
export const BESPOKE_GENERATORS: Record<string, ShapeGenerator> = {
  SPIRALE_HELICE: generateHelix,
  TREILLIS_MESH: generateMesh,
};

/**
 * Resolve and run the generator for a shape: a registered bespoke generator if one exists for
 * `archetype.id`, otherwise the generic segment-grammar generator. This is what the pipeline
 * (element/circular/slab) calls — never `generateBarShape` directly for novel shapes.
 */
export function generateShape(
  archetype: ShapeArchetype,
  params: Record<string, number>,
  diameter: number,
  code: CodePack,
): BarShapeResult {
  const bespoke = BESPOKE_GENERATORS[archetype.id];
  return (bespoke ?? generateBarShape)(archetype, params, diameter, code);
}
