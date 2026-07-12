/**
 * Contract — the canonical **placed-bar** input family (v1.0.5 M2 / P-A, [REF-DATA-530]).
 *
 * ONE first-class, persisted unit for user-detailed steel, generalising today's `LongBarOverride` /
 * `ExtraLongBar` (`pipeline/element.ts`) and the web-side `BarOverrideEdit` / `AddressableBar`
 * (`document.ts`) into a single family that every pipeline resolves through the shared placement pass
 * (`section/resolvePlacedBars.ts`). The engine turns a `PlacedBarInput[]` into the resolved
 * `SolveResult.longBars` (`PlacedLongBar[]`) that `placeBars` + `computeBBS` + `sectionAt` already
 * consume — so a freely placed bar renders + schedules + appears in the coupe on ALL 8 elements.
 *
 * **M2 ships `SingleBar` only.** `BarRow` / `Bundle` / `Layer` (P-C/P-D/P-E of the spec) extend the
 * `PlacedBarInput` union in Phase 3 (M3) — additive, so a `.rcfg` written then still opens on an M2
 * reader (forward-compat, D-P0-2). Binding stays id-based, never coordinates (D-P3-4).
 *
 * Two placement modes (audit B3): a **free** bar at `(u,v)` resolves the same on every section
 * (section-agnostic); a per-bar **override onto an existing layout bar** (`overrideBarIndex`) resolves
 * its position from that bar (section-aware — RECT face/zone, SLAB/JOIST `byZone`, CIRCULAR pitch idx).
 *
 * Pure data; no DOM/three. `import type` only for the geometry contracts (no runtime coupling).
 */
import type { ShapeArchetype } from "./shape";
import type { BarRole } from "./reinforcing-element";
import type { UserHook } from "../geometry/segment-grammar";
import type { Splice } from "../geometry/splice";

/**
 * A longitudinal bar's per-end treatment where it stops (a curtailment cut-off or a support). `none` =
 * a bare cut; `straight` = a straight development length; `hook` = a standard bend/hook. `{ start, end }`
 * are the two member-axis ends of the bar. (Moved here from `pipeline/element.ts` in M2 so the canonical
 * data contract lives in the types layer; the anchorage-length validity check is Track V, M4.)
 */
export type EndAnchorageChoice = "none" | "straight" | "hook";
export interface BarEndAnchorage {
  start?: EndAnchorageChoice;
  end?: EndAnchorageChoice;
}

/**
 * The steel a placed bar carries — shape archetype + params, Ø, hooks, role, axial start, curtailment
 * stations, per-end anchorage, splices and a `removed` flag. Shared by every member of the
 * `PlacedBarInput` union (M3): a `BarRow`/`Bundle`/`Layer` expands into N bars that all carry ONE body,
 * so a row/bundle is edited + persisted as one object but resolves to real per-bar geometry. (Extracted
 * in M3 from the M2 `SingleBar` field list — `SingleBar` now `extends` it, unchanged in shape.)
 */
export interface PlacedBarBody {
  shape: ShapeArchetype;
  params: Record<string, number>;
  diameter: number;
  hooks?: { start?: UserHook; end?: UserHook };
  role?: BarRole;
  /** axial start station along the member (mm); default 0. */
  axisStart?: number;
  /** v1.0.5 P2 ([REF-SYS-260], D3): curtailment — the bar's run is clipped to `[start, end]` (mm). */
  startStation?: number;
  endStation?: number;
  /** v1.0.5 P2: per-end anchorage choice at a curtailed/support end (validated in M4/Track V). */
  anchorage?: BarEndAnchorage;
  /** explicit per-bar lap/coupler stations (staggered by the caller). */
  splices?: Splice[];
  /** auto-split this bar at the stock length. */
  autoSplice?: boolean;
  /** drop this bar from the render + schedule. */
  removed?: boolean;
  /**
   * **v1.0.6-fix R9 (finding F-H) — span direction on a two-way section.** Which span a placed band
   * reinforces on a TWO-WAY slab, where an x-zone and a y-zone sit at the SAME level `v`. Absent → the
   * credit falls back to nearest-zone-by-level (the one-way / single-direction case, byte-identical). When
   * set, `creditPlacedPerMetre` credits the matching-axis zone, so a Y band raises `As_main_y` instead of
   * always landing on X (owner decision O-5, 2026-07-12). Additive / forward-compat. Only meaningful on a
   * two-way slab; ignored elsewhere (no zone declares an axis). ⚠ accounting convention → G-BAEL/EC2.
   */
  spanAxis?: "x" | "y";
}

/**
 * `SingleBar` — one freely placed bar (P-A). Its own section position `(u,v)` + a `PlacedBarBody`.
 * Carries a **stable id** (binding is id/index-based, D-P3-4). The station fields generalise the
 * Phase-1 `startStation`/`endStation`/`anchorage` that M1 added to `LongBarOverride`/`ExtraLongBar`.
 */
export interface SingleBar extends PlacedBarBody {
  /** discriminant for the `PlacedBarInput` union. */
  kind: "single";
  /** stable id (binds/persists by id, never coordinates — D-P3-4). */
  id: string;
  /** section position in the (u,v) frame (mm); `v` is the section level/depth. */
  position: { u: number; v: number };
  /**
   * audit B3 — section-aware OVERRIDE mode: when set, this bar MODIFIES the native layout bar at this
   * index (its section position is taken from that bar, the section's own convention). Absent → a free
   * bar at `position` (section-agnostic). The shared pass resolves the position from the pipeline's
   * `layoutBars`; the free-placement path needs no per-section logic.
   */
  overrideBarIndex?: number;
  /**
   * **v1.0.6-fix R1 (F-A) — the CODE diameter, when it differs from the physical one.** A bar expanded
   * from a `Bundle` is physically Ø, but the code rules judge the bundle as one equivalent bar of
   * `φₙ = code.bundleEquivDiameter(Ø, n) = φ·√n ≤ 55` (spec P-E; EC2 §8.9 / BAEL). The **lap length**,
   * the **mandrel/bend radius** and the **clear-spacing to neighbours** must therefore be computed on
   * `φₙ`, while **area, mass and the BBS Ø column stay on the physical Ø** (a bundle must not gain
   * phantom steel). Set ONLY by `expandBundle`; absent on every other bar → the bare Ø is used and the
   * resolved bar is byte-identical to pre-R1.
   *
   * *Why this field exists:* expanding a bundle into N independent bars destroys the fact that they act
   * as one — this carries that fact to the rules that need it. Owner decision **O-1** (2026-07-11):
   * φₙ drives lap + mandrel + spacing. ⚠ PROVISIONAL constants → G-BAEL/G-EC2.
   */
  equivDiameter?: number;
}

/**
 * `BarRow` — v1.0.5 M3 (P-C): N bars placed as ONE object, one shape/Ø/curtailment for all. An
 * `anchor` (the first bar), a `direction` (the section axis it spreads along), an `extent` (the
 * across-section length it covers) and either an explicit `count` or a centre `spacing` (mm). Resolves
 * to N `SingleBar`s at solve time (real bars for 3D/coupe/BBS) but edits/persists as one. `skin: true`
 * marks a side-face skin row (P-F) — placement identical; the depth-triggered skin minimum is Track V.
 */
export interface BarRow extends PlacedBarBody {
  kind: "row";
  id: string;
  /** first-bar anchor in the section (u,v) frame (mm). */
  anchor: { u: number; v: number };
  /** the section axis the row spreads along: "u" (a horizontal band) or "v" (a vertical / skin row). */
  direction: "u" | "v";
  /** the across-section length the row covers from the anchor (mm). */
  extent: number;
  /** N bars by explicit count (spread evenly over `extent`) … */
  count?: number;
  /** … OR by centre-to-centre spacing (mm) along `extent`. `count` wins if both are given. */
  spacing?: number;
  /** P-F: this row is side-face skin steel (drives the depth-triggered skin minimum in Track V/M4). */
  skin?: boolean;
}

/**
 * `Bundle` — v1.0.5 M3 (P-E): 2–4 bars in contact at one position, scheduled as one mark with the real
 * count, `As = n·area`, and an equivalent diameter `φₙ = φ·√n ≤ 55` (`code.bundleEquivDiameter`) that
 * drives cover / clear-spacing / mandrel-lap (Track V/M4). Resolves to `n` touching `SingleBar`s.
 */
export interface Bundle extends PlacedBarBody {
  kind: "bundle";
  id: string;
  /** the bundle centre in the section (u,v) frame (mm). */
  position: { u: number; v: number };
  /** bars in contact (2–4; the >4 / >3-at-a-lap limit is a Track V/M4 check). */
  n: number;
}

/**
 * `Layer` — v1.0.5 M3 (P-D, [REF-SYS-611]): an explicit 2nd/3rd flexural layer attaching to a face. Its
 * `count` bars spread across the face (`span`) at `layerIndex` steps inboard of the cover layer — each
 * step offsets the fixed axis by `Ø + layerGap`. The bars feed the **area-weighted effective depth `d`**
 * (`computeZoneGeometryWeighted`) so a lower second layer correctly lowers `d`; between-layer clear
 * spacing is Track V/M4. Section-aware — the resolver needs the section dims (RECT + slab-family).
 */
export interface Layer extends PlacedBarBody {
  kind: "layer";
  id: string;
  /** the face this layer attaches to (bars run parallel to it, offset inboard). */
  face: "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
  /** layer depth index from the face: 0 = the outer (cover) layer, 1 = the next in, … */
  layerIndex: number;
  /** bars in this layer (spread across the face `span`). */
  count: number;
  /** the cover-to-centroid inset of layer 0 from the face (mm). */
  inset: number;
  /** across-face span the bars spread over (mm) — the core width/height at the face. */
  span: number;
  /** clear gap added between consecutive layers (mm); default `max(Ø, 20)`. */
  layerGap?: number;
}

/**
 * The placed-bar input union. M2 shipped `SingleBar`; M3 adds `BarRow`/`Bundle`/`Layer` (additive — an
 * unknown future member survives an older reader by riding `meta.app_document`, D-P0-2). Each non-single
 * kind expands to N `SingleBar`s in the shared pass (`section/resolvePlacedBars.ts`).
 */
export type PlacedBarInput = SingleBar | BarRow | Bundle | Layer;

/** Narrow a `PlacedBarInput` to a `SingleBar`. */
export const isSingleBar = (p: PlacedBarInput): p is SingleBar => p.kind === "single";
/** Narrow a `PlacedBarInput` to a `BarRow` (P-C). */
export const isBarRow = (p: PlacedBarInput): p is BarRow => p.kind === "row";
/** Narrow a `PlacedBarInput` to a `Bundle` (P-E). */
export const isBundle = (p: PlacedBarInput): p is Bundle => p.kind === "bundle";
/** Narrow a `PlacedBarInput` to a `Layer` (P-D). */
export const isLayer = (p: PlacedBarInput): p is Layer => p.kind === "layer";
