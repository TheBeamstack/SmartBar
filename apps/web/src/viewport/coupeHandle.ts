/**
 * Coupe drag-handle pure helpers (spec v1.0.1 Feature B §2.5). The in-3D cut handle needs a GPU,
 * but the station math — clamping a dragged station to the member, snapping it onto a transverse
 * set, and the cut-plane extents — is pure and headless-tested. The handle writes the SAME
 * `updateCut(id, { origin, normal })` the numeric field writes (one source of truth, §2.4).
 */
import { transverseStations, type SolveResult } from "@rebarconfig/core";

export type Vec3 = [number, number, number];
type Member = SolveResult["member"];

/** Clamp a station to the member length (0..length), §2.2. */
export function clampStation(y: number, length: number): number {
  return Math.max(0, Math.min(length, y));
}

/** Snap a station onto the nearest transverse-set station within `tol` (so a cut lands on a stirrup). */
export function snapStation(y: number, stations: readonly number[], tol: number): number {
  let best = y;
  let bestD = tol;
  for (const s of stations) {
    const d = Math.abs(s - y);
    if (d <= bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** Half-extents of the member cross-section (for sizing the cut-plane gizmo). */
export function memberHalfExtents(member: Member): { halfW: number; halfH: number } {
  if (member.envelope === "CIRCULAR") {
    const r = (member.D ?? 0) / 2;
    return { halfW: r, halfH: r };
  }
  return { halfW: (member.b ?? 0) / 2, halfH: (member.h ?? 0) / 2 };
}

/** The transverse-set stations along the axis (deduped, sorted) a cut can snap onto. */
export function snapStationsFor(result: SolveResult): number[] {
  const set = new Set<number>();
  for (const tr of result.member.transverse) {
    for (const y of transverseStations(result.member.length, tr.spacing)) set.add(Math.round(y));
  }
  return [...set].sort((a, b) => a - b);
}
