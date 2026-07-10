/**
 * Pure world-space placement of a solved element's bars (spec §9.5, [REF-SYS-950]).
 *
 * Reconstructs each bar's 3D centreline in WORLD millimetres from a `SolveResult` + its
 * `MemberPlacement`, using the established frame (`X = u`, `Y = member axis 0..length`, `Z = v`).
 * This is the core-side equivalent of the SPA's `rebarProps.buildScene` (which it will replace),
 * kept pure so it feeds BOTH the 3D viewport and the Section/Coupe engine (D-P2-3, D-P5-1).
 *
 *   - Longitudinal bars render their REAL bent `centerline3D` (v1.0.3 G1, [REF-SYS-960]) oriented
 *     onto the member frame at their section position `(u, v)`: the shape's local run maps to the
 *     member axis `+Y`, its local lateral offset bends into the section depth `±Z`. A straight
 *     `DROITE` is byte-identical to the old straight 2-point line (local lateral ≡ 0).
 *   - Transverse sets (ties/stirrups/hoops) are the bent loop centreline laid flat in the `X–Z`
 *     plane, instanced up the axis at the set's `spacing`. A continuous coil (spiral/helix) is
 *     placed ONCE as a single member-length helix (G1), never instanced + flattened per station.
 *   - Supplements are surfaced for presence (centred at mid-length) — precise placement is a
 *     later pass (D-P3-6), and the coupe engine treats them like transverse loops.
 *
 * Slab-family DISTRIBUTION bars (v1.0.4 C1, [REF-SYS-810]): a linear répartition bar flagged
 * `across` runs ACROSS the width (world-X) at its span station — its true cross-direction geometry,
 * so the transverse coupe reads the main bars as dots + the distribution layer as a line. (A welded
 * topping MESH keeps the per-metre representative panel.) Provided steel stays per-metre (unchanged).
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
 * Region-aware transverse stations (v1.0.2 F5 + v1.0.3 G6 cadence continuity, [REF-SYS-757b]):
 * emit stations region-by-region, each at its own spacing, with the global end margins preserved at
 * axis 0 and `length`. A single full-length region delegates to `transverseStations` so the uniform
 * case is byte-identical (protects the goldens).
 *
 * **Cadence continuity (G6, spec §6.1):** when a new region starts, its first cadre is placed ONE
 * new-spacing step after the *last placed cadre of the previous region* — NOT reset to the region's
 * `from` station. The region `from` only marks where the new spacing takes over; carrying the running
 * station across the boundary removes the illogical short stub (e.g. a 2 cm gap) at a region change.
 */
export function regionStations(regions: TransverseRegion[], length: number): number[] {
  if (regions.length === 0) return transverseStations(length, length);
  if (isSingleFullRegion(regions, length)) return transverseStations(length, regions[0]!.spacing);
  const margin = Math.min(50, length / 2);
  const ys: number[] = [];
  let last: number | undefined; // the last placed station (carried across region boundaries)
  for (let ri = 0; ri < regions.length; ri++) {
    const r = regions[ri]!;
    const s = r.spacing > 0 ? r.spacing : Math.max(r.to - r.from, 1);
    const isLast = ri === regions.length - 1;
    const stop = isLast ? Math.min(r.to, length - margin) : r.to;
    // first region begins at the end margin; later regions continue ONE new step past the carried
    // station (cadence continuity, G6), so the boundary `from` is never a forced/short stub.
    let y = last === undefined ? Math.max(r.from, margin) : last + s;
    for (; y <= stop + 1e-6; y += s) {
      ys.push(y);
      last = y;
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

/**
 * Orient a longitudinal bar's local bent centreline (v1.0.3 G1) onto the member frame at its
 * section position `(u, v)`. The generator emits a flat 2D centreline `[localX, localY, 0, …]`
 * (`localX` = run along u+, `localY` = lateral in v); we map it to world mm by
 * `worldX = u`, `worldY = axisStart + localX`, `worldZ = v + localY`. A straight `DROITE`
 * (`localY ≡ 0`, `localX` 0..L) reproduces the old `[u,0,v, u,L,v]` line byte-for-byte.
 * `axisStart` shifts a bar's run along the axis (default 0; G2 unique-length bars will use it).
 */
function placeLongitudinal(centerline3D: number[], u: number, v: number, axisStart: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + 2 < centerline3D.length; i += 3) {
    out.push(u, axisStart + centerline3D[i]!, v + centerline3D[i + 1]!);
  }
  return out;
}

/** A continuous coil (spiral/helix) carries `coilLength` — placed ONCE, not per station (G1, mirrors bbs.ts). */
function isContinuousCoil(shape: SolvedGroup["shape"]): boolean {
  return "coilLength" in shape;
}

/**
 * Place a continuous coil (spiral/helix) along the member axis (v1.0.3 G1). The bespoke helix
 * generator emits its centreline with the coil axis along local `+v` and the circle in the `u–w`
 * plane (`bespoke/helix.ts`): `[u, axis, w]`. World frame is `X = u`, `Y = axis (0..length)`,
 * `Z = w`, so the helix centreline maps straight through — one bar spanning the member.
 */
function placeCoil(centerline3D: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 2 < centerline3D.length; i += 3) {
    out.push(centerline3D[i]!, centerline3D[i + 1]!, centerline3D[i + 2]!);
  }
  return out;
}

/**
 * Render ONE grouped base layout bar (the byte-identical pre-longBars path): map its group's bent
 * centreline (G1) onto the member frame at `(u, v)`, honouring a slab `across` distribution bar (C1).
 * Factored out (v1.0.5 M2) so it serves BOTH the pure grouped path AND the additive path where a
 * generic pipeline keeps its base mat in `bars[]` and appends free placed bars to `longBars`.
 */
function placeGroupedLongBar(
  bp: SolveResult["bars"][number],
  bi: number,
  longGroups: SolvedGroup[],
  byZone: Map<string, SolvedGroup>,
  member: SolveResult["member"],
  length: number,
): PlacedBar | undefined {
  const mainLong = longGroups[0];
  const topLong = longGroups[1] ?? longGroups[0];
  // slab-family bars carry the zone in faceTag → exact group match; else the rect convention
  // (a TOP-face bar belongs to the second long group, e.g. a beam's chapeaux).
  const g = byZone.get(bp.faceTag) ?? (bp.faceTag === "TOP" ? topLong : mainLong) ?? mainLong;
  if (!g) return undefined;
  const cl = g.shape.centerline3D;
  // v1.0.4 C1 ([REF-SYS-810]): a DISTRIBUTION bar flagged `across` runs the full section width
  // (world-X) at its span station `axial` and depth `v` — perpendicular to the main steel, so the
  // transverse coupe shows it as a true line across the width. Otherwise honour the group's bent
  // shape; fall back to a straight full-length run if it has no polyline.
  const points = bp.across
    ? [-(member.b ?? 0) / 2, bp.axial ?? 0, bp.position.v, (member.b ?? 0) / 2, bp.axial ?? 0, bp.position.v]
    : cl.length >= 6
    ? placeLongitudinal(cl, bp.position.u, bp.position.v, 0)
    : [bp.position.u, 0, bp.position.v, bp.position.u, length, bp.position.v];
  return { groupId: g.groupId, diameter: g.diameter, role: g.role, points, closed: false, barIndex: bi };
}

/** Place every bar of a solved element into world space (pure, deterministic). */
export function placeBars(result: SolveResult): PlacedBar[] {
  const { member, bars, groups } = result;
  const length = member.length;
  const out: PlacedBar[] = [];
  const longGroups = groups.filter((g) => LONG_ROLES.has(g.role));
  const byZone = new Map<string, SolvedGroup>();
  for (const g of groups) if (g.zone) byZone.set(g.zone, g);

  // v1.0.3 G2 ([REF-SYS-530]) / v1.0.5 M2 (P-B): when the element carries a per-bar `longBars[]` the
  // pipeline emits each bar's own shape/Ø/axial start — render from it so a façonné / unique-length /
  // free bar appears here (and, via the shared placement, in the coupe + PDF + DXF). A **RECT** element
  // fully replaces its base steel: every `bars[]` entry has a non-standalone `longBars` twin, so the
  // additive loop below renders nothing → byte-identical. A **generic** pipeline (slab/circular/…) keeps
  // its base mat in `bars[]` and appends only FREE (standalone) placed bars, so the additive loop renders
  // the base bars NOT already represented in `longBars`. Absent → the pure grouped path (byte-identical).
  if (result.longBars) {
    const covered = new Set<number>();
    for (const lb of result.longBars) if (!lb.standalone) covered.add(lb.barIndex);
    for (const lb of result.longBars) {
      if (lb.removed) continue;
      const cl = lb.shape.centerline3D;
      const points = cl.length >= 6
        ? placeLongitudinal(cl, lb.position.u, lb.position.v, lb.axisStart)
        : [lb.position.u, lb.axisStart, lb.position.v, lb.position.u, lb.axisStart + length, lb.position.v];
      out.push({ groupId: lb.groupId, diameter: lb.diameter, role: lb.role, points, closed: false, barIndex: lb.barIndex });
    }
    // additive: grouped base bars not represented in longBars (generic pipelines' base mat).
    for (let bi = 0; bi < bars.length; bi++) {
      if (covered.has(bi)) continue;
      const pb = placeGroupedLongBar(bars[bi]!, bi, longGroups, byZone, member, length);
      if (pb) out.push(pb);
    }
  } else {
    // longitudinal bars render their real bent centreline (G1), oriented at (u, v) on the member axis
    for (let bi = 0; bi < bars.length; bi++) {
      const pb = placeGroupedLongBar(bars[bi]!, bi, longGroups, byZone, member, length);
      if (pb) out.push(pb);
    }
  }

  // transverse sets: a continuous coil is placed ONCE (G1); discrete loops instance up the axis
  for (const tset of member.transverse) {
    const g = groups.find((x) => x.groupId === tset.groupId);
    if (!g) continue;
    if (isContinuousCoil(g.shape)) {
      out.push({
        groupId: g.groupId,
        diameter: g.diameter,
        role: g.role,
        points: placeCoil(g.shape.centerline3D),
        closed: false,
      });
      continue;
    }
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

  // supplements (presence only, centred) — anything that is neither a long bar nor a placed set.
  // v1.0.3 G5 ([REF-SYS-756b], §5): an ÉPINGLE is NEVER centred — every épingle is an anchored
  // cross-tie placed on the line between its two bars (above, via member.transverse + anchor). So
  // an épingle-shape group is skipped here (the legacy centred-supplement path is removed); a
  // genuine non-épingle supplement (skin bars, interior diamond tie) keeps its centred placement.
  const placedTransverse = new Set(member.transverse.map((t) => t.groupId));
  for (const g of groups) {
    if (LONG_ROLES.has(g.role) || g.role === "TRANSVERSE" || placedTransverse.has(g.groupId)) continue;
    if (g.shape.archetypeId === "EPINGLE") continue; // anchored-only (G5); never render centred
    // v1.0.4 B3 ([REF-SYS-756c]): render an anchored supplement in its TRUE section position — an
    // OPEN shape (skin bar, corner diagonal) runs longitudinally at its (u,v); a CLOSED loop (diamond
    // tie) is placed at its anchor. No anchor → the legacy centred presence render (byte-identical).
    const anchor = g.anchor;
    let points: number[];
    if (anchor && !g.shape.closed) {
      points = placeLongitudinal(g.shape.centerline3D, anchor.u, anchor.v, 0);
    } else {
      points = placeLoop(g.shape.centerline3D, length / 2, anchor);
    }
    out.push({
      groupId: g.groupId,
      diameter: g.diameter,
      role: g.role,
      points,
      closed: g.shape.closed,
    });
  }

  return out;
}
