/**
 * v1.0.6 N5 / Track U4 ([REF-UI-560]) — pure placement helpers for the tool palette + place-by-pointing.
 * The palette drops a bar/row/bundle/layer on the section; these functions **snap** the pointed (u,v)
 * into the buildable envelope and **build** the right canonical `PlacedBarDoc` for the active kind. Pure
 * + deterministic (no store, no DOM) so they are headless-unit-tested; the store's `placeInSection`
 * router calls them. All new steel lands in the v1.0.5 `doc.placed` model, which the adapter already
 * threads to the engine on all 8 elements — so a placed bar renders + schedules + is validated for free.
 */
import type {
  PlacedBarDoc,
  PlacedRowDoc,
  PlacedBundleDoc,
  PlacedLayerDoc,
  AddressableBar,
} from "./document";

/** The four things the palette can drop. `single` is a free `AddressableBar`; the rest are M3 kinds. */
export type PlaceKind = "single" | "row" | "bundle" | "layer";

export interface SectionGeom {
  /** rect section width (mm); undefined for a circular/non-rect section (u then only grid-snaps). */
  b?: number;
  /** rect section height (mm); undefined ⇒ v only grid-snaps. */
  h?: number;
  cover: number;
  diameter: number;
  /** snap grid step (mm); default 5. */
  grid?: number;
}

/**
 * Snap a pointed section coordinate into the **cover envelope** (a bar centre can sit no closer to a
 * face than `cover + Ø/2`) and onto a coarse grid. On a non-rect section (no `b`/`h`) the axis only
 * grid-snaps (there is no rectangular envelope to clamp to). Pure.
 */
export function snapSection(u: number, v: number, geom: SectionGeom): { u: number; v: number } {
  const grid = geom.grid ?? 5;
  const snap1 = (val: number, dim: number | undefined): number => {
    const g = Math.round(val / grid) * grid;
    if (dim === undefined) return g;
    const lim = Math.max(0, dim / 2 - geom.cover - geom.diameter / 2);
    return Math.max(-lim, Math.min(lim, g));
  };
  return { u: snap1(u, geom.b), v: snap1(v, geom.h) };
}

/** A stable, collision-free `p{n}` id — the first free slot across the existing placed set. */
export function freshPlacedId(existing: readonly PlacedBarDoc[]): string {
  const used = new Set(existing.map((p) => (p as { id: string }).id));
  let n = 1;
  while (used.has(`p${n}`)) n++;
  return `p${n}`;
}

/**
 * Build the canonical doc object for a dropped kind at the (already-snapped) `(u,v)`. Kind-specific
 * defaults are deliberately modest + valid (a 3-bar row across the section width, a 2-bar bundle, a
 * 2-bar second BOTTOM layer) — the inspector/list then refines count/spacing/face. Pure.
 */
export function buildPlacedBar(
  kind: PlaceKind,
  opts: { id: string; u: number; v: number; shapeId: string; diameter: number; geom: SectionGeom },
): PlacedBarDoc {
  const { id, u, v, shapeId, diameter, geom } = opts;
  const width = geom.b ?? 400;
  const clear = Math.max(0, width - 2 * geom.cover); // available run across the face
  switch (kind) {
    case "single": {
      const bar: AddressableBar = { id, u, v, shapeId, diameter };
      return bar;
    }
    case "row": {
      const row: PlacedRowDoc = {
        kind: "row",
        id,
        anchor: { u: -clear / 2, v },
        direction: "u",
        extent: clear,
        count: 3,
        shapeId,
        diameter,
      };
      return row;
    }
    case "bundle": {
      const bundle: PlacedBundleDoc = { kind: "bundle", id, u, v, n: 2, shapeId, diameter };
      return bundle;
    }
    case "layer": {
      const layer: PlacedLayerDoc = {
        kind: "layer",
        id,
        face: v >= 0 ? "TOP" : "BOTTOM",
        layerIndex: 2,
        count: 2,
        inset: geom.cover + diameter,
        span: clear,
        shapeId,
        diameter,
      };
      return layer;
    }
  }
}
