/**
 * v1.0.6 N6 / Track U5 ([REF-UI-811]) — pure helpers for the EDITABLE elevation. N4 built the
 * `ElevationDock` as a read-only view over `buildElevationFiche(result)`; N6 makes it a canvas where a
 * detailer drags a bar end (curtailment), drops a lap/coupler (splice), grabs a bend-up point (relevé),
 * or drags a stirrup-zone boundary. Every gesture is really "a pointer position → a member-axis STATION"
 * committed to the v1.0.5 per-bar station model; these functions are that pure mapping (screen ⇄ drawing
 * ⇄ station + snap), plus small doc readers. No store, no DOM, no three — so they are headless-unit-tested
 * (spec §0.4: pure hit-test/coord/snap helpers headless; the drag widget is owner-GPU-verified).
 */
import type { MemberAttitude, ElevationFiche } from "@rebarconfig/exporters";
import type { Splice, EndAnchorageChoice } from "@rebarconfig/core";
import type { ElementDoc } from "./document";
import { isColumnDoc, isBeamDoc } from "./document";

/**
 * The minimal shape of the store's unified `Selection` this module reads (kind + the bar index / extra
 * id). Typed locally so `engine/` (the pure adapter) never imports the store — the store's richer
 * `Selection` union is structurally assignable to it.
 */
export type ElevationSelection = { kind: string; index?: number; id?: string } | null;

/** The fit transform that maps a fiche's drawing coords into the SVG viewport (and back). Pure. */
export interface ElevationTransform {
  /** drawing-x (mm) → screen-x (px). */
  px: (x: number) => number;
  /** drawing-y (mm) → screen-y (px); flips so +height draws upward (drawing convention). */
  py: (y: number) => number;
  /** screen (px) → drawing (mm) — the inverse of (px,py), for hit-testing a pointer. */
  toDrawing: (sx: number, sy: number) => { x: number; y: number };
  scale: number;
}

export interface ElevationViewport {
  W: number;
  H: number;
  pad: number;
}

/**
 * Build the fit transform for a fiche in a `W×H` viewport (the SAME math the read-only `ElevationView`
 * used inline in N4 — extracted here so the on-screen render, the hit-testing and the tests share ONE
 * transform). `toDrawing` inverts it so a pointer `(sx,sy)` recovers the drawing point.
 */
export function fitElevation(fiche: ElevationFiche, view: ElevationViewport): ElevationTransform {
  const { bbox } = fiche;
  const { W, H, pad } = view;
  const spanX = Math.max(bbox.maxX - bbox.minX, 1);
  const spanY = Math.max(bbox.maxY - bbox.minY, 1);
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const px = (x: number) => W / 2 + (x - cx) * scale;
  const py = (y: number) => H / 2 - (y - cy) * scale;
  const toDrawing = (sx: number, sy: number) => ({
    x: cx + (sx - W / 2) / scale,
    y: cy - (sy - H / 2) / scale,
  });
  return { px, py, toDrawing, scale };
}

/**
 * The member-axis station (mm) of a drawing point, inverting `orientPoint`: a VERTICAL member (column /
 * pile) runs up the drawing-y; a HORIZONTAL/FLAT member (beam / slab / stair) runs along the drawing-x.
 */
export function stationFromDrawing(att: MemberAttitude, dx: number, dy: number): number {
  return att === "VERTICAL" ? dy : dx;
}

/** Clamp a station into the member run `[0, L]` and snap it to a grid (default 10 mm). Pure. */
export function snapStation(station: number, memberLen: number, grid = 10): number {
  const clamped = Math.max(0, Math.min(memberLen, station));
  return Math.max(0, Math.min(memberLen, Math.round(clamped / grid) * grid));
}

/**
 * The full "a pointer landed here → which snapped station" mapping every N6 gesture commits through:
 * screen → drawing (via the transform) → axis station (via the attitude) → snapped into `[0,L]`. This
 * is the single pure seam the drag handler AND the typed-coordinate twin both call.
 */
export function screenToStation(
  fiche: ElevationFiche,
  transform: ElevationTransform,
  sx: number,
  sy: number,
  memberLen: number,
  grid = 10,
): number {
  const d = transform.toDrawing(sx, sy);
  return snapStation(stationFromDrawing(fiche.attitude, d.x, d.y), memberLen, grid);
}

/** The member axis length (mm) for a doc — the drag range `[0, L]`. Column height / beam span. */
export function memberRunLength(doc: ElementDoc): number {
  if (isColumnDoc(doc)) return doc.geometry.H;
  if (isBeamDoc(doc)) return doc.geometry.L;
  const g = doc.geometry;
  return g.L ?? g.H ?? g.Lx ?? Math.max(1, ...Object.values(g));
}

/**
 * The per-bar station model of the CURRENTLY selected bar (a longitudinal-group override, or an
 * independent extra), read straight from the doc — the model the elevation handles AND the inspector's
 * numeric twins render. `start`/`end` default to the full run `[0, L]` (an uncurtailed bar). Returns
 * `null` when the selection is not an editable single bar (row/bundle/layer selection lands with the
 * N5 palette per §7; alerts/cross-ties carry no station).
 */
export interface SelectedBarStations {
  start: number;
  end: number;
  memberLen: number;
  anchorage?: EndAnchorageChoice;
  splices: Splice[];
  /** true iff the bar carries any explicit curtailment (start>0 or end<L) — for the "runs through" hint. */
  curtailed: boolean;
}

export function selectedBarStations(doc: ElementDoc, selection: ElevationSelection): SelectedBarStations | null {
  if (!selection) return null;
  const memberLen = memberRunLength(doc);
  const read = (b: { startStation?: number; endStation?: number; anchorage?: EndAnchorageChoice; splices?: Splice[] }): SelectedBarStations => {
    const start = b.startStation ?? 0;
    const end = b.endStation ?? memberLen;
    return { start, end, memberLen, anchorage: b.anchorage, splices: b.splices ?? [], curtailed: start > 0 || end < memberLen };
  };

  if (selection.kind === "bar" && selection.index !== undefined) {
    const group = isColumnDoc(doc) ? doc.longitudinal : isBeamDoc(doc) ? doc.span : null;
    if (!group) return null;
    const ov = (group.barOverrides ?? []).find((o) => o.index === selection.index);
    return read(ov ?? {});
  }
  if (selection.kind === "extra" && selection.id !== undefined) {
    const extras = isColumnDoc(doc) || isBeamDoc(doc) ? doc.extraBars ?? [] : [];
    const e = extras.find((x) => x.id === selection.id);
    return e ? read(e) : null;
  }
  return null;
}
