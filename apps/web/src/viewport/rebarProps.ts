/**
 * PURE viewport mapping (spec §2.1, §8; plan P2 risks: "the viewport must be a *dumb* renderer
 * of arrays"). It turns an engine SolveResult into plain geometry + flags for the R3F layer. It
 * contains NO three / DOM imports, so it is unit-tested headlessly (red_fail_mapping.spec,
 * degradation.spec). The bend/fillet/hook geometry itself is the engine's `centerline3D`, never
 * recomputed here.
 *
 * The world-space placement now comes from core's pure `placeBars(result)` (D-P5-1 dedupe): one
 * source of truth for the 3D viewport, the DXF/PDF exporters and the Section/Coupe engine. This is
 * what lets ALL eight elements render generically — the member envelope (RECT box or CIRCULAR
 * cylinder) is read from `result.member`, not from any element-specific branch.
 *
 * World frame: member axis = +Y (length); cross-section = X–Z plane (engine u→X, v→Z).
 */
import { placeBars, type SolveResult } from "@rebarconfig/core";

export type RenderMode = "tubes" | "lines";
export type ValidationMode = "live" | "deferred";

/** Performance-degradation directives (normative §2.2). Solve always runs; only render/UI degrade. */
export interface ViewportDirectives {
  geometry: RenderMode;
  validation: ValidationMode;
}

export function viewportDirectives(dragMode: boolean): ViewportDirectives {
  return dragMode
    ? { geometry: "lines", validation: "deferred" }
    : { geometry: "tubes", validation: "live" };
}

/** Union of `affectedGroupIds` across every FAIL rule — these bars render absolute RED (§8). */
export function failingGroupIds(result: SolveResult): string[] {
  const ids = new Set<string>();
  for (const item of result.validation) {
    if (item.status === "FAIL") for (const id of item.affectedGroupIds) ids.add(id);
  }
  return [...ids];
}

export interface BarInstance {
  groupId: string;
  /** flat world points [x,y,z, …] (mm). */
  points: number[];
  diameter: number;
  closed: boolean;
  /** in a FAIL rule's affectedGroupIds → render RED. */
  failing: boolean;
  /** clicked alert group OR a bar selected in the F7 section picker → highlight. */
  selected: boolean;
  /** index into result.bars for a longitudinal bar (F7 picker ↔ 3D click sync); undefined for loops. */
  barIndex?: number;
}

/** Concrete envelope to draw (RECT box or CIRCULAR cylinder), from `result.member`. */
export interface ConcreteEnvelope {
  envelope: "RECT" | "CIRCULAR";
  length: number;
  /** RECT cross-section (mm). */
  b?: number;
  h?: number;
  /** CIRCULAR overall diameter (mm). */
  D?: number;
}

export interface Scene {
  concrete: ConcreteEnvelope;
  bars: BarInstance[];
  mode: RenderMode;
  validation: ValidationMode;
  failingIds: string[];
}

/** Geometry-only placed bar (before the viewport's failing/selected colouring is applied). */
interface PlacedGeom {
  groupId: string;
  points: number[];
  diameter: number;
  closed: boolean;
  barIndex?: number;
}

/** A group whose shape is a welded mat (TREILLIS_MESH) — carries the bespoke wire fields. */
function meshFields(shape: unknown): { pitchX: number; pitchY: number } | null {
  const s = shape as { nWiresX?: number; pitchX?: number; pitchY?: number };
  if (!("nWiresX" in (s as object))) return null;
  if (!(typeof s.pitchX === "number" && typeof s.pitchY === "number" && s.pitchX > 0 && s.pitchY > 0)) return null;
  return { pitchX: s.pitchX, pitchY: s.pitchY };
}

/**
 * v1.0.4 D2 (spec Part V D2) — indicative→faithful welded MESH render. A `TREILLIS_MESH` group (two-way
 * slab mats, joist topping) is a grid, not a bent bar; render it as its actual orthogonal wire grid at
 * the mat's layer depth instead of a single (mis-oriented) panel outline. Pure + deterministic — the
 * wire layout is unit-tested; the GPU acceptance is the owner's pass (§D-3). Frame: width = X
 * (`member.b`), span = +Y (`member.length`), depth = Z (the zone's tension-centroid v).
 */
export function meshGridBars(result: SolveResult): PlacedGeom[] {
  const out: PlacedGeom[] = [];
  const m = result.member;
  const b = m.b ?? 0;
  const length = m.length;
  if (b <= 0 || length <= 0) return out;
  for (const g of result.groups) {
    const mf = meshFields(g.shape);
    if (!mf) continue;
    const v = result.zones.find((z) => z.zone === g.zone)?.tensionCentroid.v ?? 0;
    // wires running ACROSS the width (world-X), spaced along the span (Y) at pitchY.
    for (let y = 0; y <= length + 1e-6; y += mf.pitchY) {
      out.push({ groupId: g.groupId, points: [-b / 2, y, v, b / 2, y, v], diameter: g.diameter, closed: false });
    }
    // wires running ALONG the span (world-Y), spaced across the width (X) at pitchX.
    for (let x = -b / 2; x <= b / 2 + 1e-6; x += mf.pitchX) {
      out.push({ groupId: g.groupId, points: [x, 0, v, x, length, v], diameter: g.diameter, closed: false });
    }
  }
  return out;
}

/**
 * Build the full render scene. Pure: same (result, dragMode, selected) → identical Scene.
 * Geometry is taken verbatim from core's `placeBars` (plus the D2 mesh grid for welded mats); this
 * layer only adds the per-bar failing/selected flags (colouring) and the drag-mode render directive.
 */
export function buildScene(
  result: SolveResult,
  _doc: unknown,
  dragMode: boolean,
  selectedGroupIds: readonly string[] = [],
  selectedBars: readonly number[] = [],
): Scene {
  const { geometry: mode, validation } = viewportDirectives(dragMode);
  const failingIds = failingGroupIds(result);
  const isFailing = (id: string) => failingIds.includes(id);
  const isSelected = (id: string) => selectedGroupIds.includes(id);

  // D2: replace a welded mat's (mis-oriented) placeBars outline with its true wire grid.
  const meshIds = new Set(result.groups.filter((g) => meshFields(g.shape)).map((g) => g.groupId));
  const placed: PlacedGeom[] = placeBars(result).filter((b) => !meshIds.has(b.groupId));
  const geom: PlacedGeom[] = [...placed, ...meshGridBars(result)];

  const bars: BarInstance[] = geom.map((b) => ({
    groupId: b.groupId,
    points: b.points,
    diameter: b.diameter,
    closed: b.closed,
    failing: isFailing(b.groupId),
    selected: isSelected(b.groupId) || (b.barIndex !== undefined && selectedBars.includes(b.barIndex)),
    ...(b.barIndex !== undefined ? { barIndex: b.barIndex } : {}),
  }));

  const m = result.member;
  const concrete: ConcreteEnvelope = {
    envelope: m.envelope,
    length: m.length,
    ...(m.b !== undefined ? { b: m.b } : {}),
    ...(m.h !== undefined ? { h: m.h } : {}),
    ...(m.D !== undefined ? { D: m.D } : {}),
  };

  return { concrete, bars, mode, validation, failingIds };
}
