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
import type { TransverseAnchor, TransverseRegion } from "../types/layout";
import type { PlacedBar } from "./types";

const DEG = Math.PI / 180;

/** Transverse-set stations up the member axis (placement of the `spacing` repetition). */
export function transverseStations(length: number, spacing: number): number[] {
  const s = spacing > 0 ? spacing : length;
  const margin = Math.min(50, length / 2);
  const ys: number[] = [];
  for (let y = margin; y <= length - margin + 1e-6; y += s) ys.push(y);
  if (ys.length === 0) ys.push(length / 2);
  return ys;
}

/** True when the list is one full-length region — pre-F5 uniform spacing (byte-identical path). */
function isSingleFullRegion(regions: TransverseRegion[], length: number): boolean {
  return regions.length === 1 && regions[0]!.from <= 1e-6 && regions[0]!.to >= length - 1e-6;
}

/**
 * Region-aware transverse stations (v1.0.2 F5): emit stations region-by-region, each at its own
 * spacing, with the global end margins preserved at axis 0 and `length`. A single full-length region
 * delegates to `transverseStations` so the uniform case is byte-identical (protects the goldens).
 * Boundaries shared by adjacent regions are de-duplicated.
 */
export function regionStations(regions: TransverseRegion[], length: number): number[] {
  if (regions.length === 0) return transverseStations(length, length);
  if (isSingleFullRegion(regions, length)) return transverseStations(length, regions[0]!.spacing);
  const margin = Math.min(50, length / 2);
  const ys: number[] = [];
  for (let ri = 0; ri < regions.length; ri++) {
    const r = regions[ri]!;
    const s = r.spacing > 0 ? r.spacing : Math.max(r.to - r.from, 1);
    const start = ri === 0 ? Math.max(r.from, margin) : r.from;
    const isLast = ri === regions.length - 1;
    const stop = isLast ? Math.min(r.to, length - margin) : r.to;
    for (let y = start; y <= stop + 1e-6; y += s) {
      if (ys.length && Math.abs(ys[ys.length - 1]! - y) < 1e-6) continue; // shared boundary
      ys.push(y);
    }
  }
  if (ys.length === 0) ys.push(length / 2);
  return ys;
}

/** Per-region cadre/stirrup counts (one entry per region), consistent with `regionStations`. */
export function regionStationCounts(regions: TransverseRegion[], length: number): number[] {
  if (regions.length <= 1) return [regionStations(regions, length).length];
  // count stations whose station falls in [from, to) per region (last region inclusive of `to`).
  const ys = regionStations(regions, length);
  return regions.map((r, ri) => {
    const isLast = ri === regions.length - 1;
    return ys.filter((y) => y >= r.from - 1e-6 && (isLast ? y <= r.to + 1e-6 : y < r.to - 1e-6)).length;
  });
}

/** The placement stations for a transverse set: region-driven when present, else uniform. */
function stationsFor(tset: { spacing: number; regions?: TransverseRegion[] }, length: number): number[] {
  return tset.regions && tset.regions.length > 0
    ? regionStations(tset.regions, length)
    : transverseStations(length, tset.spacing);
}

/**
 * Lay a flat engine centreline (local x,y) horizontally at axis station `y`. Without an `anchor`
 * the loop is centred at the section origin and unrotated (perimeter cadre/stirrup — byte-identical
 * to v1.0.1). With an `anchor` (v1.0.2 F2 cross-ties) the centred loop is rotated by `angleDeg` in
 * the u–v plane and translated to `(anchor.u, anchor.v)`, so a cross-tie sits ON the line between
 * the two bars it engages (world frame: X = u, Z = v).
 */
function placeLoop(centerline3D: number[], y: number, anchor?: TransverseAnchor): number[] {
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
  if (!anchor) {
    for (let i = 0; i < centerline3D.length; i += 3) {
      out.push(centerline3D[i]! - cx, y, centerline3D[i + 1]! - cy);
    }
    return out;
  }
  const cos = Math.cos(anchor.angleDeg * DEG), sin = Math.sin(anchor.angleDeg * DEG);
  for (let i = 0; i < centerline3D.length; i += 3) {
    const lu = centerline3D[i]! - cx, lv = centerline3D[i + 1]! - cy;
    out.push(anchor.u + (lu * cos - lv * sin), y, anchor.v + (lu * sin + lv * cos));
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
  for (let bi = 0; bi < bars.length; bi++) {
    const bp = bars[bi]!;
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
      barIndex: bi,
    });
  }

  // transverse loops instanced up the axis at the set spacing
  for (const tset of member.transverse) {
    const g = groups.find((x) => x.groupId === tset.groupId);
    if (!g) continue;
    for (const y of stationsFor(tset, length)) {
      out.push({
        groupId: g.groupId,
        diameter: g.diameter,
        role: g.role,
        points: placeLoop(g.shape.centerline3D, y, tset.anchor),
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
