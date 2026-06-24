/**
 * Manifest loading for the SPA. The JSON manifests under apps/web/manifests are the real
 * data (current_state.md §5); Vite imports them as typed objects. The engine stays a generic
 * machine — the UI just hands it the archetype JSON the active scheme references.
 *
 * v1.0/P2 only needs the two column archetypes (DROITE longitudinals, CADRE_RECT ties). P3
 * generalises this to a manifest registry keyed by id when the beam + scheme catalog land.
 */
import type { ShapeArchetype } from "@rebarconfig/core";
import droite from "../../manifests/shapes/droite.json";
import cadreRect from "../../manifests/shapes/cadre_rect.json";

export const SHAPES: Record<string, ShapeArchetype> = {
  DROITE: droite as ShapeArchetype,
  CADRE_RECT: cadreRect as ShapeArchetype,
};

export function loadShape(id: string): ShapeArchetype {
  const s = SHAPES[id];
  if (!s) throw new Error(`unknown shape archetype: ${id}`);
  return s;
}
