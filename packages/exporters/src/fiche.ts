/**
 * Elevation *fiche* — the shop-drawing model (spec §9.2 [REF-SYS-925], v1.0.1 Feature C, D-P7-2).
 *
 * v1.0 drew the elevation as a bare side projection: always horizontal, no annotations. This module
 * upgrades it into a shop drawing while changing NO engine geometry:
 *   - element-aware ORIENTATION (column/pile upright, beam horizontal, slab/joist flat) via the
 *     shared `memberAttitude` map — the SAME map the ViewCube uses (§1.4) so 3D and paper agree;
 *   - bar MARKS + counts (`3 Ø20`) on each distinct projected longitudinal run (the width-collapsing
 *     projection hides multiplicity);
 *   - a tie-SPACING callout (`Ø8 e=200`) per transverse set;
 *   - overall-length + section-depth DIMENSIONS.
 *
 * Geometry is still computed ONCE in core (`placeBars` → 2D projection); the marks/dims are a pure
 * annotation layer on top. Shared by the PDF (`drawElevation`) and DXF (`elevationToDxf`) so the
 * on-paper elevation and the DXF agree by construction. Pure + deterministic; no DOM/three.
 */
import { placeBars, type SolveResult } from "@rebarconfig/core";

export type MemberAttitude = "VERTICAL" | "HORIZONTAL" | "FLAT";

/**
 * Element-id prefix → drawing attitude. This is DATA (a lookup table), not branching logic, and it
 * lives in the presentation layer (exporters), never in `packages/core`. The ViewCube reuses the
 * same map for its element-aware default camera up-axis (spec §1.4 / [REF-SYS-810]). Owner-confirmable
 * cosmetic convention (§14 item 18) — no structural-engineer sign-off.
 */
const ATTITUDE_BY_PREFIX: ReadonlyArray<readonly [string, MemberAttitude]> = [
  ["E-COL", "VERTICAL"], // rect + circular columns stand upright
  ["E-FND", "VERTICAL"], // drilled-shaft pile cage stands upright
  ["E-BEM", "HORIZONTAL"], // beam lies along the drawing x-axis
  ["E-SLB", "FLAT"], // one-/two-way slabs + joist drawn flat (thickness up)
  ["E-STR", "HORIZONTAL"], // stair: primary span along x
];

/** Drawing attitude for an element id (default HORIZONTAL for an unknown family). */
export function memberAttitude(element: string): MemberAttitude {
  const hit = ATTITUDE_BY_PREFIX.find(([p]) => element.startsWith(p));
  return hit ? hit[1] : "HORIZONTAL";
}

export interface FichePt {
  x: number;
  y: number;
}
export interface FicheBar {
  points: FichePt[];
  closed: boolean;
}
export interface FicheLabel {
  at: FichePt;
  text: string;
}
export interface FicheDim {
  from: FichePt;
  to: FichePt;
  label: string;
}

export interface ElevationFiche {
  attitude: MemberAttitude;
  /** drawing extents (mm) over concrete + bars + dims + annotations (for the fit transform). */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** closed concrete outline. */
  concrete: FichePt[];
  bars: FicheBar[];
  marks: FicheLabel[];
  tieCallouts: FicheLabel[];
  dims: FicheDim[];
}

/**
 * Project a member-frame point `(axis 0..length, height ±)` into the oriented 2D drawing plane.
 * HORIZONTAL/FLAT keep the v1.0 mapping (axis→x, height→y); VERTICAL swaps so the member stands up.
 */
export function orientPoint(att: MemberAttitude, axis: number, height: number): FichePt {
  return att === "VERTICAL" ? { x: height, y: axis } : { x: axis, y: height };
}

const LONG_ROLES = new Set(["PRIMARY_LONGITUDINAL", "DISTRIBUTION"]);

/** Build the annotated elevation fiche for a solved element (pure, deterministic). */
export function buildElevationFiche(result: SolveResult): ElevationFiche {
  const att = memberAttitude(result.element);
  const { member } = result;
  const L = member.length;
  const halfH = member.envelope === "CIRCULAR" ? (member.D ?? 0) / 2 : (member.h ?? 0) / 2;
  const o = (axis: number, height: number) => orientPoint(att, axis, height);

  const concrete = [o(0, -halfH), o(L, -halfH), o(L, halfH), o(0, halfH)];

  // bars: projected polylines (world (x,y,z) → (axis=y, height=z) → oriented)
  const placed = placeBars(result);
  const bars: FicheBar[] = placed.map((bar) => {
    const points: FichePt[] = [];
    for (let i = 0; i + 2 < bar.points.length; i += 3) {
      points.push(o(bar.points[i + 1]!, bar.points[i + 2]!));
    }
    return { points, closed: bar.closed };
  });

  // marks: one `n Ø d` per distinct longitudinal group (count = bars placed in that group).
  const byGroup = new Map<string, { diameter: number; mids: FichePt[] }>();
  for (const bar of placed) {
    if (!LONG_ROLES.has(bar.role)) continue;
    const e = byGroup.get(bar.groupId) ?? { diameter: bar.diameter, mids: [] };
    const n = bar.points.length / 3;
    const mid = Math.floor(n / 2) * 3; // midpoint vertex of the run
    e.mids.push(o(bar.points[mid + 1]!, bar.points[mid + 2]!));
    byGroup.set(bar.groupId, e);
  }
  const marks: FicheLabel[] = [];
  for (const e of byGroup.values()) {
    const sorted = [...e.mids].sort((a, b) => a.y - b.y || a.x - b.x);
    const rep = sorted[Math.floor(sorted.length / 2)]!; // median, so the label sits on a real bar
    marks.push({ at: rep, text: `${e.mids.length} Ø${e.diameter}` });
  }

  // tie-spacing callouts: one `Ø d e=spacing` per transverse set, fanned along the axis.
  const tieCallouts: FicheLabel[] = [];
  member.transverse.forEach((tset, i) => {
    const g = result.groups.find((x) => x.groupId === tset.groupId);
    if (!g) return;
    tieCallouts.push({
      at: o(L * Math.min(0.85, 0.15 + i * 0.18), halfH),
      text: `Ø${g.diameter} e=${Math.round(tset.spacing)}`,
    });
  });

  // dimensions: overall length (offset on the −height side) + section depth (offset on the −axis side).
  const off = Math.max(halfH * 0.8, L * 0.04, 80);
  const dims: FicheDim[] = [
    { from: o(0, -halfH - off), to: o(L, -halfH - off), label: `${Math.round(L)}` },
    { from: o(-off, -halfH), to: o(-off, halfH), label: `${Math.round(2 * halfH)}` },
  ];

  const all: FichePt[] = [
    ...concrete,
    ...bars.flatMap((b) => b.points),
    ...marks.map((m) => m.at),
    ...tieCallouts.map((c) => c.at),
    ...dims.flatMap((d) => [d.from, d.to]),
  ];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const bbox = {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
  return { attitude: att, bbox, concrete, bars, marks, tieCallouts, dims };
}

/**
 * The cutting-line + tag for a coupe, oriented onto the elevation (spec §9.5, §2.3). `axisStation`
 * is the cut's station along the member; `tick` is the symbol overshoot beyond the section depth.
 */
export function cuttingLineFiche(
  att: MemberAttitude,
  axisStation: number,
  halfH: number,
  tick: number,
): { from: FichePt; to: FichePt; tagAt: FichePt } {
  return {
    from: orientPoint(att, axisStation, -halfH - tick),
    to: orientPoint(att, axisStation, halfH + tick),
    tagAt: orientPoint(att, axisStation, halfH + tick * 1.5),
  };
}
