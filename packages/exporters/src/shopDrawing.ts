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
  /** v1.0.5 Track O (M6): the French façonnage designation (code + label) — see `faconnageCodes.ts`. */
  faconnage: BbsLine["faconnage"];
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

/**
 * v1.0.4 C2 ([REF-SYS-820], §C2): the developed [from,to] arc-length window of each spliced segment
 * along the parent bar. A segment's GEOMETRIC extent excludes the lap overlap its `cutLength` carries
 * (`cutLength − lapLength` when it laps forward), so the windows tile the parent run exactly (Σ = run).
 */
function segmentArcBounds(
  segments: { cutLength: number; lapForward: boolean }[],
  lapLength: number,
  run: number,
): { from: number; to: number }[] {
  const bounds: { from: number; to: number }[] = [];
  let acc = 0;
  for (const seg of segments) {
    const geom = seg.cutLength - (seg.lapForward ? lapLength : 0);
    const to = Math.min(acc + geom, run);
    bounds.push({ from: acc, to });
    acc = to;
  }
  return bounds;
}

/** Slice a flat `[x,y,z, …]` centreline between developed arc-lengths [from,to] → 2D (x,y) points. */
function sliceCenterline2D(c3: number[], from: number, to: number): { x: number; y: number }[] {
  const n = Math.floor(c3.length / 3);
  if (n < 2) return [];
  const cum = [0];
  for (let i = 1; i < n; i++) {
    const dx = c3[i * 3]! - c3[(i - 1) * 3]!;
    const dy = c3[i * 3 + 1]! - c3[(i - 1) * 3 + 1]!;
    const dz = c3[i * 3 + 2]! - c3[(i - 1) * 3 + 2]!;
    cum.push(cum[i - 1]! + Math.hypot(dx, dy, dz));
  }
  const total = cum[n - 1]!;
  const a = Math.max(0, Math.min(from, total));
  const b = Math.max(a, Math.min(to, total));
  const sample = (s: number): { x: number; y: number } => {
    let i = 1;
    while (i < n - 1 && cum[i]! < s) i++;
    const s0 = cum[i - 1]!;
    const len = cum[i]! - s0;
    const t = len <= 1e-9 ? 0 : (s - s0) / len;
    return {
      x: c3[(i - 1) * 3]! + (c3[i * 3]! - c3[(i - 1) * 3]!) * t,
      y: c3[(i - 1) * 3 + 1]! + (c3[i * 3 + 1]! - c3[(i - 1) * 3 + 1]!) * t,
    };
  };
  const out: { x: number; y: number }[] = [sample(a)];
  for (let i = 0; i < n; i++) {
    if (cum[i]! > a + 1e-6 && cum[i]! < b - 1e-6) out.push({ x: c3[i * 3]!, y: c3[i * 3 + 1]! });
  }
  out.push(sample(b));
  return out;
}

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
  // Parent (shape + splice) per base groupId, for the segment-slice sketch below — from the grouped
  // groups AND the addressable longBars (a per-bar splice, H14/B1, also emits `groupId#si` rows).
  type SpliceParent = { splice?: { segments: { cutLength: number; lapForward: boolean }[]; lapLength: number }; shape: { cutLength: number; centerline3D: number[] } };
  const groupByIdFull = new Map<string, SpliceParent>();
  for (const g of result.groups) groupByIdFull.set(g.groupId, g);
  for (const lb of result.longBars ?? []) if (lb.splice) groupByIdFull.set(lb.groupId, lb);
  // v1.0.4 C2 ([REF-SYS-820], §C2): a spliced-bar BBS row is one SEGMENT (`groupId = "L1#si"`), so its
  // sketch must be the segment's OWN centreline — the developed [from,to] slice of the parent bar — not
  // the whole bar (the pre-C2 `split("#")[0]` fallback drew the full bar for every segment row). Absent
  // splice → the parent's full centreline (byte-identical).
  const sketchOf = (groupIds: string[]): { x: number; y: number }[] | undefined => {
    for (const gid of groupIds) {
      const hash = gid.indexOf("#");
      const base = hash >= 0 ? gid.slice(0, hash) : gid;
      const parent = groupByIdFull.get(base);
      if (parent?.splice && hash >= 0) {
        const si = Number.parseInt(gid.slice(hash + 1), 10) - 1; // BBS numbers segments from #1
        const bounds = segmentArcBounds(parent.splice.segments, parent.splice.lapLength, parent.shape.cutLength);
        const b = bounds[si];
        if (b) {
          const seg = sliceCenterline2D(parent.shape.centerline3D, b.from, b.to);
          if (seg.length >= 2) return seg;
        }
      }
      const c3 = centerlineByGroup.get(base);
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
      faconnage: l.faconnage,
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

  // v1.0.4 C2 ([REF-SYS-820], §C2): robust anti-overlap at density. Labels fan out along the member's
  // drawing axis on a rail just beyond the concrete envelope, in anchor order (groupsArr is sorted by
  // the bar's real position). The rail is stretched so consecutive labels are ALWAYS ≥ `minSep` apart —
  // a legible pitch — even when the bars are denser than the envelope span (the pre-C2 even fan let
  // labels stack when `span/(n−1) < text height`). Centred on the envelope so the callout stays local.
  const gap = Math.max(halfH * 0.6, L * 0.05, 60);
  const bb = fiche.bbox;
  const n = groupsArr.length;
  const along = att === "VERTICAL" ? { min: bb.minY, max: bb.maxY } : { min: bb.minX, max: bb.maxX };
  const minSep = Math.max(halfH * 0.35, 55); // minimum legible label pitch (mm)
  const railLen = Math.max(along.max - along.min, (n - 1) * minSep);
  const railStart = (along.min + along.max) / 2 - railLen / 2;
  const leaders: ShopLeader[] = groupsArr.map((g, i) => {
    const pos = n <= 1 ? (along.min + along.max) / 2 : railStart + (railLen * i) / (n - 1);
    const to: FichePt = att === "VERTICAL" ? { x: bb.maxX + gap, y: pos } : { x: pos, y: bb.maxY + gap };
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
