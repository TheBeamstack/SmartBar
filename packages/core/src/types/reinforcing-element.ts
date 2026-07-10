/**
 * Contract #3 — ReinforcingElement supertype + BarGroup.
 * Spec: v1.0-Spec.md §0.2.1 ([REF-DATA-060]), §5.1, §10 ([REF-DATA-1000]).
 *
 * The persisted/solved unit is a ReinforcingElement discriminated by `kind`. v1.0 ships
 * ONLY kind="REBAR_GROUP". Horizontal scaling (v1.0.x) adds kind="TENDON" etc. WITHOUT
 * changing the solver/store/viewport/exporter contracts. A v1.0 reader MUST preserve
 * unknown kinds on round-trip (so a future tendon-bearing .rcfg survives a v1.0.0 load).
 */
import type { Distribution } from "./distribution";
import type { PlacementRule } from "./placement";

export type BarRole =
  | "PRIMARY_LONGITUDINAL"
  | "TRANSVERSE"
  | "SUPPLEMENTAL"
  | "SKIN"
  | "DOWEL"
  | "STARTER"
  | "DISTRIBUTION";

/**
 * The only concrete v1.0 ReinforcingElement.kind. Serialized contract (§10): for
 * kind="REBAR_GROUP" the required fields are EXACTLY id, kind, role, (zone | supplementId),
 * shapeArchetypeId, params, diameter, distribution, placement.
 */
export interface BarGroup {
  id: string;
  kind: "REBAR_GROUP";
  role: BarRole;
  /** which As_zone this base group satisfies (base groups). */
  zone?: string;
  /** the supplemental catalog entry this group instantiates (supplements). */
  supplementId?: string;
  shapeArchetypeId: string;
  /** archetype param values (keys per the shape manifest). */
  params: Record<string, number>;
  diameter: number;
  distribution: Distribution;
  placement: PlacementRule;
}

/**
 * v1.0.5 M7 / Track E ([REF-DATA-1000], audit B4) — the canonical **placed-bar** reinforcing element.
 *
 * A `BarGroup` (`REBAR_GROUP`) carries a `distribution` + `placement` and cannot express a bundle, an
 * explicit flexural layer, a curtailed run, or per-bar shape/splices — so a freely-detailed bar
 * (M2/M3) had no faithful canonical home and its detail was dropped to the private `meta.app_document`
 * blob (D-P5-7). `PLACED_BAR` fills that gap: ONE resolved bar's as-built geometry (position, cut
 * length, curtailment stations, per-end anchorage, splice tally, and the row/bundle/layer it expanded
 * from), so the canonical `.rcfg` arrays are lossless for interchange / a future IFC / server — not
 * just this app.
 *
 * Forward-compat (NORMATIVE, §10) is preserved AND newly exercised for our OWN kind: an OLDER reader
 * that predates `PLACED_BAR` sees it as an unknown kind and preserves it verbatim (the `isBarGroup`
 * guard is false → it rides the `UnknownReinforcingElement` path), never dropping it on round-trip.
 */
export interface PlacedBarElement {
  id: string;
  kind: "PLACED_BAR";
  role: BarRole;
  shapeArchetypeId: string;
  diameter: number;
  /** section position in the (u,v) frame (mm). */
  position: { u: number; v: number };
  /** axial start station along the member (mm). */
  axisStart: number;
  /** as-built fabrication cut length (mm) — the D-P1-1 accounting, not a polyline sum. */
  cutLength: number;
  /** v1.0.5 P2 (D3): curtailment stations (mm) when the bar stops short of the full member run. */
  startStation?: number;
  endStation?: number;
  /** per-end anchorage choice at a curtailed/support end (`none|straight|hook`). Inlined (no coupling). */
  anchorage?: { start?: string; end?: string };
  /** the placed-input kind this bar expanded from + its parent id (a row/bundle/layer fans out to N). */
  placedKind?: "single" | "row" | "bundle" | "layer";
  placedParentId?: string;
  /** lap/coupler segmentation summary when spliced (absent → unspliced). */
  splice?: { segments: number; couplerCount: number; lapLength: number };
}

/**
 * Forward-compat carrier for kinds a v1.0 reader does not understand (e.g. a future
 * "TENDON"). The loader keeps these verbatim; it never drops a kind it cannot parse (§10).
 */
export interface UnknownReinforcingElement {
  id: string;
  kind: string;
  [extra: string]: unknown;
}

export type ReinforcingElement = BarGroup | PlacedBarElement | UnknownReinforcingElement;

/** Type guard the engine/loader uses to operate on the v1.0 concrete kind. */
export function isBarGroup(el: ReinforcingElement): el is BarGroup {
  return el.kind === "REBAR_GROUP";
}

/** Type guard for the v1.0.5 M7 canonical placed-bar kind. */
export function isPlacedBarElement(el: ReinforcingElement): el is PlacedBarElement {
  return el.kind === "PLACED_BAR";
}
