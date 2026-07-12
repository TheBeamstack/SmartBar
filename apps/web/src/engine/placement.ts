/**
 * v1.0.6 N5 / Track U4 ([REF-UI-560]) — pure placement helpers for the tool palette + place-by-pointing.
 * The palette drops a bar/row/bundle/layer on the section; these functions **build** the right canonical
 * `PlacedBarDoc` for the active kind. Pure + deterministic (no store, no DOM) so they are headless-unit-
 * tested; the store's `placeInSection` router calls them. All new steel lands in the v1.0.5 `doc.placed`
 * model, which the adapter already threads to the engine on all 8 elements — so a placed bar renders +
 * schedules + is validated for free.
 *
 * **v1.0.6-fix R5:** the snap/clamp half of this module (`snapSection` + its private `SectionGeom` frame)
 * is **gone** — it derived a second, weaker section frame that silently skipped the cover envelope on any
 * element without `b`/`h` (i.e. every circular section). `engine/sectionFrame.ts` is now the ONE place a
 * frame and a clamp come from (`snapToFrame`), for all 8 elements. Two frames that disagree is the bug —
 * the same lesson as R4's twin bar-layouts.
 */
import type {
  PlacedBarDoc,
  PlacedRowDoc,
  PlacedBundleDoc,
  PlacedLayerDoc,
  AddressableBar,
} from "./document";
import type { SectionFrame } from "./sectionFrame";

/** The four things the palette can drop. `single` is a free `AddressableBar`; the rest are M3 kinds. */
export type PlaceKind = "single" | "row" | "bundle" | "layer";

/** A stable, collision-free `p{n}` id — the first free slot across the existing placed set. */
export function freshPlacedId(existing: readonly PlacedBarDoc[]): string {
  const used = new Set(existing.map((p) => (p as { id: string }).id));
  let n = 1;
  while (used.has(`p${n}`)) n++;
  return `p${n}`;
}

/**
 * Build the canonical doc object for a dropped kind at the (already-snapped) `(u,v)`. Kind-specific
 * defaults are deliberately modest + valid (a row across the section width, a 2-bar bundle, a 2-bar second
 * layer) — the inspector then refines count/spacing/face. Pure.
 *
 * R5: the defaults are taken from the **section frame**, so they suit the element they land on — a row on
 * a 4 m slab spans the slab, not a column's 400 mm. On a CIRCULAR section a `layer` is an inner pitch
 * circle (core `expandRadialLayer`, owner O-3c), so `face`/`span` are inert there and the count is what
 * matters.
 */
export function buildPlacedBar(
  kind: PlaceKind,
  opts: {
    id: string;
    u: number;
    v: number;
    shapeId: string;
    diameter: number;
    frame: SectionFrame;
    /** R9 (F-H): the span this band reinforces on a two-way slab — attached to every kind (absent → none). */
    spanAxis?: "x" | "y";
  },
): PlacedBarDoc {
  const { id, u, v, shapeId, diameter, frame, spanAxis } = opts;
  const clear = Math.max(0, frame.b - 2 * frame.cover); // available run across the section
  const axis = spanAxis !== undefined ? { spanAxis } : {}; // R9: only present on a two-way slab placement
  switch (kind) {
    case "single": {
      const bar: AddressableBar = { id, u, v, shapeId, diameter, ...axis };
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
        ...axis,
      };
      return row;
    }
    case "bundle": {
      const bundle: PlacedBundleDoc = { kind: "bundle", id, u, v, n: 2, shapeId, diameter, ...axis };
      return bundle;
    }
    case "layer": {
      const layer: PlacedLayerDoc = {
        kind: "layer",
        id,
        face: v >= 0 ? "TOP" : "BOTTOM",
        layerIndex: 2,
        count: 2,
        inset: frame.cover + diameter,
        span: clear,
        shapeId,
        diameter,
        ...axis,
      };
      return layer;
    }
  }
}
