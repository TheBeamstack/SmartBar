/**
 * Shop-drawing annotation model (spec §7 [REF-SYS-930], v1.0.3 G7).
 *
 * v1.0.1/.2 gave the exported elevation an oriented *fiche* with bar marks + tie callouts + basic
 * dims (`fiche.ts`), and v1.0.3 G6 added coupe/region dims. This module completes the shop drawing:
 * it turns a solved element into the full annotation set matching the reference beam drawing —
 *   1. **leader lines** — a pointer from each distinct longitudinal bar run to a label
 *      `mark · nØd · l=length` (e.g. `1 3Ø20 l=6000`), with a basic anti-overlap label column;
 *   2. **per-element sequential bar marks** (repères 1,2,3…) — the BBS line ordinals (a per-element
 *      namespacing, separate from the project-wide `markPrefix` marks, §7.2);
 *   3. **coupe markers** (A-A, B-B…) — the cutting-line + tag per section on the elevation;
 *   4. **stirrup-zone notation** `count × spacing` per region (from G6 region stations);
 *   5. **support labels** V1/V2 (+ optional bearing width / bottom-bar anchorage from G3);
 *   6. a **bending table** — one row per distinct scheduled shape (mark · sketch · Ø · cut · count
 *      per element · total = count × element quantity).
 *
 * The model is built ONCE over `buildElevationFiche` + `computeBBS` + `sectionAt` so the PDF and the
 * DXF draw the SAME annotations (they agree by construction). Pure + deterministic; no DOM/three.
 */
import {
  placeBars,
  sectionAt,
  defaultCoupeFor,
  transverseStations,
  regionStationCounts,
  type SolveResult,
  type SectionCut,
} from "@rebarconfig/core";
import { computeBBS, type BbsLine } from "./bbs";
import {
  buildElevationFiche,
  cuttingLineFiche,
  orientPoint,
  type FichePt,
  type MemberAttitude,
} from "./fiche";

/** A leader line from a bar run to its label `mark · nØd · l=length`. */
export interface ShopLeader {
  mark: string;
  /** anchor on the bar (drawing mm). */
  from: FichePt;
  /** label anchor after basic anti-overlap (drawing mm). */
  to: FichePt;
  text: string;
}

/** A per-element sequential bar mark (repère) with a drawing anchor. */
export interface ShopMark {
  mark: string;
  at: FichePt;
}

/** A coupe cutting-line + tag drawn on the elevation. */
export interface ShopCoupeMarker {
  tag: string;
  label: string;
  from: FichePt;
  to: FichePt;
  tagAt: FichePt;
}

/** Stirrup-zone notation `count × spacing` for one uniform set or one spacing region. */
export interface ShopStirrupZone {
  groupId: string;
  count: number;
  spacing: number;
  label: string;
  at: FichePt;
}

/** A beam support label V1/V2 with optional bearing width + bottom-bar anchorage (G3). */
export interface ShopSupportLabel {
  side: "left" | "right";
  tag: string;
  at: FichePt;
  width?: number;
  anchorage?: number;
  label: string;
}

/** One bending-table row = one distinct scheduled shape. */
export interface BendingRow {
  mark: string;
  shapeArchetypeId: string;
  diameter: number;
  cutLength_mm: number;
  /** count within one element. */
  countPerElement: number;
  /** count × element quantity (the fabrication total across all repeats). */
  totalCount: number;
  /** the façonnage sketch (legs a/b/c, bends, hooks) for the row's shape thumbnail. */
  fiche: BbsLine["fiche"];
  /** the shape's 2D centreline `[{x,y}, …]` (local plane, mm) for a faithful bending-table sketch. */
  sketch?: { x: number; y: number }[];
}

export interface ShopDrawing {
  attitude: MemberAttitude;
  leaders: ShopLeader[];
  marks: ShopMark[];
  coupeMarkers: ShopCoupeMarker[];
  stirrupZones: ShopStirrupZone[];
  supportLabels: ShopSupportLabel[];
  bendingTable: BendingRow[];
}

export interface ShopDrawingOptions {
  /** namespaced project mark prefix passed through to the BBS (e.g. "P1" → "P1-01"). Default bare. */
  markPrefix?: string;
  /** element fabrication quantity — scales the bending-table total (count × quantity). Default 1. */
  quantity?: number;
  /** user coupes beyond the seeded default (each gets a cutting-line marker on the elevation). */
  coupes?: SectionCut[];
  /**
   * per-support drawing data (G3) not carried on the pure `SolveResult`: bearing width + bottom-bar
   * anchorage into the support. Absent → the V1/V2 label is still emitted (derived from the chapeau
   * zones), just without the width/anchorage annotation.
   */
  supports?: { side: "left" | "right"; width?: number; anchorage?: number }[];
}

const LONG_ROLES = new Set(["PRIMARY_LONGITUDINAL", "DISTRIBUTION"]);
const SUPPORT_TAG = { left: "V1", right: "V2" } as const;

/** Build the shop-drawing annotation model for a solved element (pure, deterministic). */
export function shopDrawing(result: SolveResult, opts: ShopDrawingOptions = {}): ShopDrawing {
  const quantity = opts.quantity ?? 1;
  const fiche = buildElevationFiche(result);
  const bbs = computeBBS(result, opts.markPrefix ? { markPrefix: opts.markPrefix } : {});
  const att = fiche.attitude;
  const { member } = result;
  const L = member.length;
  const halfH = member.envelope === "CIRCULAR" ? (member.D ?? 0) / 2 : (member.h ?? 0) / 2;
  const o = (axis: number, height: number): FichePt => orientPoint(att, axis, height);

  // --- 6. bending table: one row per distinct scheduled shape (the BBS already merged identical
  // bars); count per element = the line count, total = count × quantity. The sketch thumbnail comes
  // from the source group's real 2D centreline (the generator emits a flat `[x,y,0, …]`). ---------
  const centerlineByGroup = new Map<string, number[]>();
  for (const g of result.groups) centerlineByGroup.set(g.groupId, g.shape.centerline3D);
  for (const lb of result.longBars ?? []) centerlineByGroup.set(lb.groupId, lb.shape.centerline3D);
  const sketchOf = (groupIds: string[]): { x: number; y: number }[] | undefined => {
    for (const gid of groupIds) {
      const c3 = centerlineByGroup.get(gid.split("#")[0]!);
      if (c3 && c3.length >= 6) {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i + 2 < c3.length; i += 3) pts.push({ x: c3[i]!, y: c3[i + 1]! });
        return pts;
      }
    }
    return undefined;
  };
  const bendingTable: BendingRow[] = bbs.lines.map((l) => {
    const sketch = sketchOf(l.groupIds);
    return {
      mark: l.mark,
      shapeArchetypeId: l.shapeArchetypeId,
      diameter: l.diameter,
      cutLength_mm: l.cutLength_mm,
      countPerElement: l.count,
      totalCount: l.count * quantity,
      fiche: l.fiche,
      ...(sketch ? { sketch } : {}),
    };
  });

  // --- 1/2. leaders + sequential marks: one leader per distinct longitudinal group, pointing to
  // its BBS mark. Aggregate the placed longitudinal bars per group (mirrors `fiche` marks) so the
  // leader anchors on a real bar, then join to the BBS line for the mark + cut length. ---------
  const placed = placeBars(result);
  const byGroup = new Map<string, { diameter: number; count: number; mids: FichePt[] }>();
  for (const bar of placed) {
    if (!LONG_ROLES.has(bar.role)) continue;
    const e = byGroup.get(bar.groupId) ?? { diameter: bar.diameter, count: 0, mids: [] };
    const n = bar.points.length / 3;
    const mid = Math.floor(n / 2) * 3; // midpoint vertex of the run
    e.mids.push(o(bar.points[mid + 1]!, bar.points[mid + 2]!));
    e.count++;
    byGroup.set(bar.groupId, e);
  }
  // groupId → (mark, cut length): a longitudinal group maps to exactly one BBS line.
  const markByGroup = new Map<string, { mark: string; cut: number }>();
  for (const l of bbs.lines) for (const gid of l.groupIds) markByGroup.set(gid, { mark: l.mark, cut: l.cutLength_mm });

  const groupsArr = [...byGroup.entries()]
    .map(([gid, e]) => {
      const sorted = [...e.mids].sort((a, b) => a.y - b.y || a.x - b.x);
      const rep = sorted[Math.floor(sorted.length / 2)]!; // median, so the label sits on a real bar
      const info = markByGroup.get(gid);
      return { gid, rep, count: e.count, diameter: e.diameter, mark: info?.mark ?? "", cut: info?.cut ?? 0 };
    })
    .filter((g) => g.mark !== "")
    .sort((a, b) => a.rep.x - b.rep.x || a.rep.y - b.rep.y || a.mark.localeCompare(b.mark));

  // basic anti-overlap: fan the labels out along the member's drawing axis, on a row just beyond the
  // concrete envelope, so no two labels coincide (the §9.2 collision note actioned at a basic level).
  const gap = Math.max(halfH * 0.6, L * 0.05, 60);
  const bb = fiche.bbox;
  const n = groupsArr.length;
  const leaders: ShopLeader[] = groupsArr.map((g, i) => {
    const frac = n <= 1 ? 0.5 : i / (n - 1);
    const to: FichePt =
      att === "VERTICAL"
        ? { x: bb.maxX + gap, y: bb.minY + (bb.maxY - bb.minY) * frac }
        : { x: bb.minX + (bb.maxX - bb.minX) * frac, y: bb.maxY + gap };
    return { mark: g.mark, from: g.rep, to, text: `${g.mark} ${g.count}Ø${g.diameter} l=${Math.round(g.cut)}` };
  });
  const marks: ShopMark[] = leaders.map((l) => ({ mark: l.mark, at: l.from }));

  // --- 3. coupe markers: the cutting-line + tag per coupe (default + user coupes). --------------
  const cuts: SectionCut[] = [defaultCoupeFor(result), ...(opts.coupes ?? [])];
  const tick = Math.max(halfH * 0.2, 40);
  const coupeMarkers: ShopCoupeMarker[] = cuts.map((cut) => {
    const view = sectionAt(result, cut);
    const cl = cuttingLineFiche(att, view.elevation.axisStation, halfH, tick);
    return { tag: view.elevation.tag, label: view.label, from: cl.from, to: cl.to, tagAt: cl.tagAt };
  });

  // --- 4. stirrup-zone notation `count × spacing` per region (G6 region stations). --------------
  const stirrupZones: ShopStirrupZone[] = [];
  for (const tset of member.transverse) {
    const g = result.groups.find((x) => x.groupId === tset.groupId);
    if (!g) continue;
    if (tset.regions && tset.regions.length > 1) {
      const counts = regionStationCounts(tset.regions, L);
      tset.regions.forEach((r, ri) => {
        const c = counts[ri] ?? 0;
        const mid = (Math.max(r.from, 0) + Math.min(r.to, L)) / 2;
        stirrupZones.push({ groupId: tset.groupId, count: c, spacing: r.spacing, label: `${c}×${Math.round(r.spacing)}`, at: o(mid, halfH) });
      });
    } else {
      const c = transverseStations(L, tset.spacing).length;
      stirrupZones.push({ groupId: tset.groupId, count: c, spacing: tset.spacing, label: `${c}×${Math.round(tset.spacing)}`, at: o(L / 2, halfH) });
    }
  }

  // --- 5. support labels V1/V2 (+ optional width/anchorage). The label is derived from the beam's
  // per-support chapeau zones present on the result (`As_top_support_left/right`, G3); the width +
  // anchorage are drawing data supplied via opts (not carried on the pure result). --------------
  const supportLabels: ShopSupportLabel[] = [];
  const supOpts = new Map((opts.supports ?? []).map((s) => [s.side, s] as const));
  for (const side of ["left", "right"] as const) {
    const zone = `As_top_support_${side}`;
    if (!result.groups.some((gp) => gp.zone === zone)) continue;
    const axis = side === "left" ? 0 : L;
    const so = supOpts.get(side);
    const parts: string[] = [SUPPORT_TAG[side]];
    if (so?.width !== undefined) parts.push(`b=${Math.round(so.width)}`);
    if (so?.anchorage !== undefined) parts.push(`l.a=${Math.round(so.anchorage)}`);
    supportLabels.push({
      side,
      tag: SUPPORT_TAG[side],
      at: o(axis, -halfH),
      ...(so?.width !== undefined ? { width: so.width } : {}),
      ...(so?.anchorage !== undefined ? { anchorage: so.anchorage } : {}),
      label: parts.join("  "),
    });
  }

  return { attitude: att, leaders, marks, coupeMarkers, stirrupZones, supportLabels, bendingTable };
}
