/**
 * Pure world-space placement of a solved element's bars (spec §9.5, [REF-SYS-950]).
 *
 * Reconstructs each bar's 3D centreline in WORLD millimetres from a `SolveResult` + its
 * `MemberPlacement`, using the established frame (`X = u`, `Y = member axis 0..length`, `Z = v`).
 * This is the core-side equivalent of the SPA's `rebarProps.buildScene` (which it will replace),
 * kept pure so it feeds BOTH the 3D viewport and the Section/Coupe engine (D-P2-3, D-P5-1).
 *
 *   - Longitudinal bars run along `+Y` at their section position `(u, v)`.
 *   - Transverse sets (ties/stirrups/hoops) are the bent loop centreline laid flat in the `X–Z`
 *     plane, instanced up the axis at the set's `spacing`.
 *   - Supplements are surfaced for presence (centred at mid-length) — precise placement is a
 *     later pass (D-P3-6), and the coupe engine treats them like transverse loops.
 *
 * Representative note: slab-family DISTRIBUTION bars are placed along `+Y` like the main steel
 * (per-metre representative model, D-P4a-5) — their true cross-direction run is a P6 refinement.
 */
import type { SolveResult, SolvedGroup } from "../pipeline/element";
import type { PlacedBar } from "./types";

/** Transverse-set stations up the member axis (placement of the `spacing` repetition). */
export function transverseStations(length: number, spacing: number): number[] {
  const s = spacing > 0 ? spacing : length;
  const margin = Math.min(50, length / 2);
  const ys: number[] = [];
  for (let y = margin; y <= length - margin + 1e-6; y += s) ys.push(y);
  if (ys.length === 0) ys.push(length / 2);
  return ys;
}

/** Centre a flat engine centreline (local x,y) and lay it horizontally at axis station `y`. */
function placeLoop(centerline3D: number[], y: number): number[] {
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

const LONG_ROLES = new Set(["PRIMARY_LONGITUDINAL", "DISTRIBUTION"]);

/** Place every bar of a solved element into world space (pure, deterministic). */
export function placeBars(result: SolveResult): PlacedBar[] {
  const { member, bars, groups } = result;
  const length = member.length;
  const out: PlacedBar[] = [];

  const longGroups = groups.filter((g) => LONG_ROLES.has(g.role));
  const byZone = new Map<string, SolvedGroup>();
  for (const g of groups) if (g.zone) byZone.set(g.zone, g);
  const mainLong = longGroups[0];
  const topLong = longGroups[1] ?? longGroups[0];

  // longitudinal runs along +Y at (u, v)
  for (const bp of bars) {
    // slab-family bars carry the zone in faceTag → exact group match; else the rect convention
    // (a TOP-face bar belongs to the second long group, e.g. a beam's chapeaux).
    const g = byZone.get(bp.faceTag) ?? (bp.faceTag === "TOP" ? topLong : mainLong) ?? mainLong;
    if (!g) continue;
    out.push({
      groupId: g.groupId,
      diameter: g.diameter,
      role: g.role,
      points: [bp.position.u, 0, bp.position.v, bp.position.u, length, bp.position.v],
      closed: false,
    });
  }

  // transverse loops instanced up the axis at the set spacing
  for (const tset of member.transverse) {
    const g = groups.find((x) => x.groupId === tset.groupId);
    if (!g) continue;
    for (const y of transverseStations(length, tset.spacing)) {
      out.push({
        groupId: g.groupId,
        diameter: g.diameter,
        role: g.role,
        points: placeLoop(g.shape.centerline3D, y),
        closed: g.shape.closed,
      });
    }
  }

  // supplements (presence only, centred) — anything that is neither a long bar nor a placed set
  const placedTransverse = new Set(member.transverse.map((t) => t.groupId));
  for (const g of groups) {
    if (LONG_ROLES.has(g.role) || g.role === "TRANSVERSE" || placedTransverse.has(g.groupId)) continue;
    out.push({
      groupId: g.groupId,
      diameter: g.diameter,
      role: g.role,
      points: placeLoop(g.shape.centerline3D, length / 2),
      closed: g.shape.closed,
    });
  }

  return out;
}
