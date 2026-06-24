/**
 * PURE viewport mapping (spec §2.1, §8; plan P2 risks: "the viewport must be a *dumb* renderer
 * of arrays"). These functions turn an engine SolveResult into plain geometry + flags for the
 * R3F layer. They contain NO three / DOM imports, so they are unit-tested headlessly
 * (red_fail_mapping.spec, degradation.spec). The bend/fillet/hook geometry itself is the
 * engine's `centerline3D`, never recomputed here — we only PLACE it (instance + translate).
 *
 * World frame: column axis = +Y (height H); cross-section = X–Z plane (engine u→X, v→Z).
 */
import type { SolveResult, BarPosition } from "@rebarconfig/core";
import { type ElementDoc, isColumnDoc } from "../engine/document";

/** Member axis (length + transverse spacing + concrete box) for either element. */
function memberAxis(doc: ElementDoc): {
  length: number;
  spacing: number;
  concrete: { b: number; h: number; H: number };
} {
  if (isColumnDoc(doc)) {
    return {
      length: doc.geometry.H,
      spacing: doc.tie.spacing,
      concrete: { b: doc.geometry.b, h: doc.geometry.h, H: doc.geometry.H },
    };
  }
  return {
    length: doc.geometry.L,
    spacing: doc.stirrup.spacing,
    concrete: { b: doc.geometry.b, h: doc.geometry.h, H: doc.geometry.L },
  };
}

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
  /** user clicked an alert referencing this group → highlight. */
  selected: boolean;
}

export interface Scene {
  concrete: { b: number; h: number; H: number };
  bars: BarInstance[];
  mode: RenderMode;
  validation: ValidationMode;
  failingIds: string[];
}

/** Vertical straight longitudinal bar at section (u,v): two world endpoints 0..H. */
function longitudinalPolyline(p: BarPosition, H: number): number[] {
  return [p.position.u, 0, p.position.v, p.position.u, H, p.position.v];
}

/** Center a flat engine centerline (local x,y plane) and lay it horizontally at height y. */
function placeTieLoop(centerline3D: number[], y: number): number[] {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < centerline3D.length; i += 3) {
    const lx = centerline3D[i]!, ly = centerline3D[i + 1]!;
    if (lx < minX) minX = lx;
    if (lx > maxX) maxX = lx;
    if (ly < minY) minY = ly;
    if (ly > maxY) maxY = ly;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const out: number[] = [];
  for (let i = 0; i < centerline3D.length; i += 3) {
    out.push(centerline3D[i]! - cx, y, centerline3D[i + 1]! - cy);
  }
  return out;
}

/** Tie heights up the column (placement only — visualization of `spacing` repetition). */
function tieHeights(H: number, spacing: number): number[] {
  const s = spacing > 0 ? spacing : H;
  const margin = Math.min(50, H / 2);
  const ys: number[] = [];
  for (let y = margin; y <= H - margin + 1e-6; y += s) ys.push(y);
  if (ys.length === 0) ys.push(H / 2);
  return ys;
}

/**
 * Build the full render scene. Pure: same (result, doc, dragMode, selected) → identical Scene.
 * `result.bars` are the solved longitudinal positions; transverse + supplemental groups carry
 * bent-loop centerlines instanced up the member at the transverse spacing.
 *
 * Generic over the element: the member axis = +Y (H for a column, L for a beam) and the
 * cross-section lives in X–Z. Bottom/side bars belong to the first longitudinal group, top bars
 * to the second (a beam's chapeaux) — so failing/selected colouring is per zone.
 */
export function buildScene(
  result: SolveResult,
  doc: ElementDoc,
  dragMode: boolean,
  selectedGroupIds: readonly string[] = [],
): Scene {
  const { geometry: mode, validation } = viewportDirectives(dragMode);
  const failingIds = failingGroupIds(result);
  const isFailing = (id: string) => failingIds.includes(id);
  const isSelected = (id: string) => selectedGroupIds.includes(id);
  const { length, spacing, concrete } = memberAxis(doc);

  const bars: BarInstance[] = [];

  const longGroups = result.groups.filter((g) => g.role === "PRIMARY_LONGITUDINAL");
  const mainLong = longGroups[0];
  const topLong = longGroups[1] ?? longGroups[0]; // a beam's chapeau group, else the main group
  if (mainLong) {
    for (const p of result.bars) {
      const g = p.faceTag === "TOP" ? topLong! : mainLong;
      bars.push({
        groupId: g.groupId,
        points: longitudinalPolyline(p, length),
        diameter: g.diameter,
        closed: false,
        failing: isFailing(g.groupId),
        selected: isSelected(g.groupId),
      });
    }
  }

  const tieGroup = result.groups.find((g) => g.role === "TRANSVERSE");
  if (tieGroup) {
    for (const y of tieHeights(length, spacing)) {
      bars.push({
        groupId: tieGroup.groupId,
        points: placeTieLoop(tieGroup.shape.centerline3D, y),
        diameter: tieGroup.diameter,
        closed: tieGroup.shape.closed,
        failing: isFailing(tieGroup.groupId),
        selected: isSelected(tieGroup.groupId),
      });
    }
  }

  // supplemental groups (épingles, skin, diamond, …). Precise placement is a polish item; here
  // we surface their presence — closed add-ons as a centred loop, open ones as a centred run.
  for (const g of result.groups) {
    if (g.role === "PRIMARY_LONGITUDINAL" || g.role === "TRANSVERSE") continue;
    bars.push({
      groupId: g.groupId,
      points: placeTieLoop(g.shape.centerline3D, length / 2),
      diameter: g.diameter,
      closed: g.shape.closed,
      failing: isFailing(g.groupId),
      selected: isSelected(g.groupId),
    });
  }

  return { concrete, bars, mode, validation, failingIds };
}
