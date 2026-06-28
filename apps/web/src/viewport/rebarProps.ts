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

/**
 * Build the full render scene. Pure: same (result, dragMode, selected) → identical Scene.
 * Geometry is taken verbatim from core's `placeBars`; this layer only adds the per-bar
 * failing/selected flags (colouring) and the drag-mode render directive.
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

  const bars: BarInstance[] = placeBars(result).map((b) => ({
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
