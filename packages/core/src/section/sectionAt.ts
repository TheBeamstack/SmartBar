/**
 * Section / Coupe engine (spec §9.5, [REF-SYS-950]) — `sectionAt(solveResult, cut) → CoupeView`.
 *
 * Normative, pure, deterministic: same `(result, cut)` → identical `CoupeView`. No Date.now /
 * Math.random, no DOM/three. The same output feeds the live 3D coupe preview, the DXF section
 * view (§9.2), and the PDF view box (§9.3) — the projection is written ONCE here.
 *
 * Steps (spec §9.5):
 *   1. Concrete outline = plane ∩ concrete envelope (rectangle for a perpendicular prismatic cut,
 *      a general convex polygon for an oblique cut). Layer COFFRAGE.
 *   2. Bars in section: a bar the plane crosses steeply → a nominal CIRCLE of its Ø; a bar nearly
 *      PARALLEL to the plane (crossing angle < convention threshold) → a LINE (elevation run, e.g.
 *      a tie outline). Layer ARMATURES. Grouped `n Ø d` on layer TEXTE.
 *   3. Look-behind: the cut face PLUS what is within `lookBehind_mm` behind it (viewing arrow =
 *      +normal) — so a cut between two stirrups still shows the nearest transverse set.
 *   4. Dimensions (layer COTATION) — templated.
 *   5. Cutting-line + tag on the elevation.
 */
import type { SolveResult } from "../pipeline/element";
import { placeBars } from "./place";
import {
  resolveLookBehind,
  DEFAULT_COUPE_CONVENTION,
  type CoupeConvention,
} from "./convention";
import type {
  Vec3,
  Pt2,
  SectionCut,
  CoupeView,
  CoupeBarCircle,
  CoupeBarLine,
  CoupeAnnotation,
  CoupeDimension,
  CoupeFrame,
} from "./types";

// --- tiny vec3 helpers (local; core stays dependency-light) ---
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const len = (a: Vec3): number => Math.sqrt(dot(a, a));
const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const EPS = 1e-6;

/** Build an orthonormal in-plane basis (e1, e2) so the coupe reads width=s, height=t. */
function planeFrame(origin: Vec3, normalRaw: Vec3): CoupeFrame {
  const normal = norm(normalRaw);
  // e1 = projection of world +X onto the plane (degenerate if the plane normal ≈ ±X → use +Z).
  const ref: Vec3 = Math.abs(normal.x) > 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const e1 = norm(sub(ref, scale(normal, dot(ref, normal))));
  const e2 = norm(cross(e1, normal)); // for a horizontal cut (normal +Y) this is +Z (height up)
  return { origin, normal, e1, e2 };
}

/** Project a world point into the plane's 2D frame (drops the normal component). */
function project(p: Vec3, f: CoupeFrame): Pt2 {
  const rel = sub(p, f.origin);
  return { s: dot(rel, f.e1), t: dot(rel, f.e2) };
}

/** Order a set of 2D points CCW around their centroid (convex polygon outline). */
function orderConvex(pts: Pt2[]): Pt2[] {
  if (pts.length < 3) return pts;
  const cx = pts.reduce((a, p) => a + p.s, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.t, 0) / pts.length;
  const uniq = dedupe(pts);
  return uniq.sort((a, b) => Math.atan2(a.t - cy, a.s - cx) - Math.atan2(b.t - cy, b.s - cx));
}

function dedupe(pts: Pt2[]): Pt2[] {
  const out: Pt2[] = [];
  for (const p of pts) {
    if (!out.some((q) => Math.abs(q.s - p.s) < 1e-3 && Math.abs(q.t - p.t) < 1e-3)) out.push(p);
  }
  return out;
}

/** Plane ∩ rectangular prism → convex polygon (mm), via the 12 box edges. */
function rectEnvelopePolygon(b: number, h: number, length: number, f: CoupeFrame): Pt2[] {
  const hb = b / 2, hh = h / 2;
  const c: Vec3[] = [];
  for (const y of [0, length])
    for (const x of [-hb, hb]) for (const z of [-hh, hh]) c.push({ x, y, z });
  // 12 edges as index pairs of the 8 corners
  const idx = (x: number, y: number, z: number) =>
    c.findIndex((p) => p.x === x && p.y === y && p.z === z);
  const edges: [number, number][] = [];
  for (const y of [0, length]) {
    edges.push([idx(-hb, y, -hh), idx(hb, y, -hh)]);
    edges.push([idx(hb, y, -hh), idx(hb, y, hh)]);
    edges.push([idx(hb, y, hh), idx(-hb, y, hh)]);
    edges.push([idx(-hb, y, hh), idx(-hb, y, -hh)]);
  }
  for (const x of [-hb, hb]) for (const z of [-hh, hh]) edges.push([idx(x, 0, z), idx(x, length, z)]);
  return edgeCrossings(c, edges, f);
}

/** Collect plane∩edge intersection points (mm) in the plane frame. */
function edgeCrossings(corners: Vec3[], edges: [number, number][], f: CoupeFrame): Pt2[] {
  const hits: Pt2[] = [];
  for (const [i, j] of edges) {
    const P = corners[i]!, Q = corners[j]!;
    const dP = dot(sub(P, f.origin), f.normal);
    const dQ = dot(sub(Q, f.origin), f.normal);
    if (Math.abs(dP) < EPS) hits.push(project(P, f));
    if (Math.abs(dQ) < EPS) hits.push(project(Q, f));
    if (dP * dQ < -EPS * EPS) {
      const tt = dP / (dP - dQ);
      const I: Vec3 = {
        x: P.x + tt * (Q.x - P.x),
        y: P.y + tt * (Q.y - P.y),
        z: P.z + tt * (Q.z - P.z),
      };
      hits.push(project(I, f));
    }
  }
  return orderConvex(hits);
}

/** Plane ∩ vertical cylinder (axis +Y) → polygon sampled on the lateral surface (ellipse/circle). */
function circularEnvelopePolygon(D: number, length: number, f: CoupeFrame, steps = 96): Pt2[] {
  const R = D / 2;
  const N = f.normal, O = f.origin;
  const pts: Pt2[] = [];
  if (Math.abs(N.y) < 1e-3) {
    // cut ≈ parallel to the axis → an axis-extruded chord (rectangle). Two chord points on the
    // circle, extruded over y ∈ [0, length].
    for (let k = 0; k < steps; k++) {
      const th = (2 * Math.PI * k) / steps;
      const x = R * Math.cos(th), z = R * Math.sin(th);
      const d = dot(sub({ x, y: length / 2, z }, O), N);
      if (Math.abs(d) < (R * 2 * Math.PI) / steps) {
        for (const y of [0, length]) pts.push(project({ x, y, z }, f));
      }
    }
    return orderConvex(pts);
  }
  for (let k = 0; k < steps; k++) {
    const th = (2 * Math.PI * k) / steps;
    const x = R * Math.cos(th), z = R * Math.sin(th);
    // solve (x,y,z)·N = O·N for y on this lateral line
    const y = (dot(O, N) - x * N.x - z * N.z) / N.y;
    if (y >= -EPS && y <= length + EPS) pts.push(project({ x, y, z }, f));
  }
  return orderConvex(pts);
}

/** Crossing angle (rad) between a bar segment direction and the plane: 0 = parallel, π/2 = ⟂. */
function crossingAngle(a: Vec3, b: Vec3, normal: Vec3): number {
  const dir = norm(sub(b, a));
  return Math.asin(Math.min(1, Math.abs(dot(dir, normal))));
}

/**
 * Pure section operation — slice a solved element with a cut plane (spec §9.5).
 */
export function sectionAt(
  result: SolveResult,
  cut: SectionCut,
  conv: CoupeConvention = DEFAULT_COUPE_CONVENTION,
): CoupeView {
  const f = planeFrame(cut.origin, cut.normal);
  const member = result.member;
  const spacing = member.transverse[0]?.spacing;
  const lookBehind = resolveLookBehind(cut.lookBehind_mm, spacing, conv);
  const nearParallel = (conv.nearParallelDeg * Math.PI) / 180;

  // --- 1. concrete outline ---
  const outline =
    member.envelope === "CIRCULAR"
      ? circularEnvelopePolygon(member.D ?? 0, member.length, f)
      : rectEnvelopePolygon(member.b ?? 0, member.h ?? 0, member.length, f);

  // --- 2/3. bars in section (circle vs near-parallel line) within look-behind ---
  const placed = placeBars(result);
  const circles: CoupeBarCircle[] = [];
  // candidate near-parallel segments, tagged with their signed distance so look-behind +
  // "nearest transverse set" (§9.5.3) can be resolved after the sweep.
  const paCandidates: (CoupeBarLine & { d: number })[] = [];

  for (const bar of placed) {
    const pts = bar.points;
    for (let i = 0; i + 5 < pts.length; i += 3) {
      const A: Vec3 = { x: pts[i]!, y: pts[i + 1]!, z: pts[i + 2]! };
      const B: Vec3 = { x: pts[i + 3]!, y: pts[i + 4]!, z: pts[i + 5]! };
      const dA = dot(sub(A, f.origin), f.normal);
      const dB = dot(sub(B, f.origin), f.normal);
      const ang = crossingAngle(A, B, f.normal);

      if (ang >= nearParallel) {
        // steep crossing → CIRCLE where the segment meets the plane (within the segment)
        if (dA * dB <= EPS && Math.abs(dA - dB) > EPS) {
          const tt = dA / (dA - dB);
          if (tt >= -EPS && tt <= 1 + EPS) {
            const I: Vec3 = {
              x: A.x + tt * (B.x - A.x),
              y: A.y + tt * (B.y - A.y),
              z: A.z + tt * (B.z - A.z),
            };
            circles.push({ groupId: bar.groupId, diameter: bar.diameter, center: project(I, f) });
          }
        }
      } else {
        paCandidates.push({
          groupId: bar.groupId,
          diameter: bar.diameter,
          d: (dA + dB) / 2,
          a: project(A, f),
          b: project(B, f),
        });
      }
    }
  }

  // near-parallel lines visible within look-behind (the cut face + behind, viewing arrow = +N).
  const lines: CoupeBarLine[] = paCandidates
    .filter((c) => c.d >= -1.0 && c.d <= lookBehind + EPS)
    .map(({ d: _d, ...rest }) => rest);
  // §9.5.3 guarantee: if a transverse group's set landed entirely outside look-behind (cut between
  // two stirrups, the nearer one in front), still show its NEAREST set behind the plane.
  for (const tset of member.transverse) {
    if (lines.some((l) => l.groupId === tset.groupId)) continue;
    const behind = paCandidates
      .filter((c) => c.groupId === tset.groupId && c.d > EPS)
      .sort((a, b) => a.d - b.d);
    const nearest = behind[0]?.d;
    if (nearest === undefined) continue;
    for (const c of paCandidates) {
      if (c.groupId === tset.groupId && Math.abs(c.d - nearest) < 1e-3) {
        const { d: _d, ...rest } = c;
        lines.push(rest);
      }
    }
  }

  // --- 2. annotations: n Ø d per group (only groups that produced section circles) ---
  const byGroup = new Map<string, CoupeBarCircle[]>();
  for (const c of circles) {
    const arr = byGroup.get(c.groupId) ?? [];
    arr.push(c);
    byGroup.set(c.groupId, arr);
  }
  const annotations: CoupeAnnotation[] = [];
  for (const [groupId, cs] of byGroup) {
    const at: Pt2 = {
      s: cs.reduce((a, c) => a + c.center.s, 0) / cs.length,
      t: cs.reduce((a, c) => a + c.center.t, 0) / cs.length,
    };
    annotations.push({ groupId, count: cs.length, diameter: cs[0]!.diameter, at });
  }
  annotations.sort((a, b) => a.groupId.localeCompare(b.groupId));

  // --- 4. dimensions: section width/height + enrobage (cover) on each face (G6, §6.4) ---
  const dimensions = buildDimensions(outline, member, result, circles);

  // --- 5. cutting-line + tag on the elevation ---
  const tag = String(cut.id);
  const label = cut.label_fr ?? conv.labelFor(tag);
  const elevation = {
    tag,
    label,
    axisStation: cut.origin.y,
    arrow: arrowOnElevation(f.normal),
  };

  return {
    cutId: cut.id,
    label,
    isDefault: cut.isDefault === true,
    concrete: { outline },
    circles,
    lines,
    annotations,
    dimensions,
    elevation,
    frame: f,
    lookBehind_mm: lookBehind,
  };
}

/** Viewing-arrow direction projected onto the elevation (axis = +Y, lateral = +X). */
function arrowOnElevation(normal: Vec3): { axis: number; lateral: number } {
  const a = normal.y, l = normal.x;
  const m = Math.hypot(a, l) || 1;
  return { axis: a / m, lateral: l / m };
}

function buildDimensions(
  outline: Pt2[],
  member: SolveResult["member"],
  result: SolveResult,
  circles: CoupeBarCircle[],
): CoupeDimension[] {
  if (outline.length === 0) return [];
  const minS = Math.min(...outline.map((p) => p.s));
  const maxS = Math.max(...outline.map((p) => p.s));
  const minT = Math.min(...outline.map((p) => p.t));
  const maxT = Math.max(...outline.map((p) => p.t));
  const dims: CoupeDimension[] = [];
  if (member.envelope === "CIRCULAR") {
    dims.push({
      kind: "DIAMETER",
      from: { s: minS, t: 0 },
      to: { s: maxS, t: 0 },
      value: member.D ?? maxS - minS,
      label: `Ø ${Math.round(member.D ?? maxS - minS)}`,
    });
  } else {
    dims.push({
      kind: "WIDTH",
      from: { s: minS, t: minT },
      to: { s: maxS, t: minT },
      value: member.b ?? maxS - minS,
      label: `${Math.round(member.b ?? maxS - minS)}`,
    });
    dims.push({
      kind: "HEIGHT",
      from: { s: minS, t: minT },
      to: { s: minS, t: maxT },
      value: member.h ?? maxT - minT,
      label: `${Math.round(member.h ?? maxT - minT)}`,
    });
  }
  // enrobage (cover) on EACH face (G6 / §6.4): the inset from a concrete face to the nearest bar
  // centroid in that half. Measured from the real section circles; falls back to the first zone's
  // d' when the cut crossed no bars (e.g. a near-parallel / slab-representative coupe).
  const midT = (minT + maxT) / 2;
  const topBars = circles.filter((c) => c.center.t >= midT);
  const botBars = circles.filter((c) => c.center.t < midT);
  if (topBars.length > 0) {
    const t = Math.max(...topBars.map((c) => c.center.t));
    dims.push({ kind: "COVER", from: { s: minS, t: maxT }, to: { s: minS, t }, value: maxT - t, label: `enr. ${Math.round(maxT - t)}` });
  }
  if (botBars.length > 0) {
    const t = Math.min(...botBars.map((c) => c.center.t));
    dims.push({ kind: "COVER", from: { s: maxS, t: minT }, to: { s: maxS, t }, value: t - minT, label: `enr. ${Math.round(t - minT)}` });
  }
  if (topBars.length === 0 && botBars.length === 0) {
    const dPrime = result.zones[0]?.dPrime;
    if (typeof dPrime === "number") {
      dims.push({ kind: "COVER", from: { s: minS, t: maxT }, to: { s: minS, t: maxT - dPrime }, value: dPrime, label: `enr. ${Math.round(dPrime)}` });
    }
  }
  return dims;
}

/** Roles whose bars define a meaningful section station (the true longitudinal members). */
const STATION_ROLES = new Set(["PRIMARY_LONGITUDINAL", "DISTRIBUTION"]);

/**
 * The along-member [lo,hi] axial (world-Y) extent of each longitudinal bar. A bar that is bent,
 * relevé, axially offset (a right-support chapeau) or an independent extra covers only part of the
 * member — this is what makes a mid-span cut miss it.
 */
function longitudinalRanges(result: SolveResult): { lo: number; hi: number }[] {
  const ranges: { lo: number; hi: number }[] = [];
  for (const bar of placeBars(result)) {
    if (!STATION_ROLES.has(bar.role)) continue;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 1; i < bar.points.length; i += 3) {
      const y = bar.points[i]!;
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    if (hi > lo) ranges.push({ lo, hi });
  }
  return ranges;
}

/**
 * v1.0.4 C1 ([REF-SYS-810], §C1): the station (world-Y) at which a PERPENDICULAR default coupe shows
 * the MOST longitudinal detailing. Mid-length is the seed; another station wins only when it crosses
 * strictly MORE bars (so an offset chapeau / relevé / extra that mid-span misses is revealed) — ties
 * and equal counts keep mid-length. When every bar spans the full member (a plain grouped element),
 * every station crosses the same set → mid-length → byte-identical to the pre-C1 default.
 */
function richestStation(result: SolveResult, length: number): number {
  const ranges = longitudinalRanges(result);
  const mid = length / 2;
  if (ranges.length === 0) return mid;
  const coverage = (s: number): number => ranges.filter((r) => r.lo - 1e-6 <= s && s <= r.hi + 1e-6).length;
  const candidates = [mid, ...ranges.map((r) => (r.lo + r.hi) / 2)].sort((a, b) => a - b);
  let best = mid;
  let bestCount = coverage(mid);
  for (const s of candidates) {
    if (coverage(s) > bestCount) {
      best = s;
      bestCount = coverage(s);
    }
  }
  return best;
}

/**
 * v1.0.4 C1 ([REF-SYS-810], §C1): meaningful cut stations to offer the user ("auto-suggest a cut
 * where the detailing is") — mid-length plus the midpoint of every longitudinal bar that covers only
 * part of the member (a chapeau / relevé / offset extra). Sorted, de-duplicated. A plain full-length
 * element yields just [mid]. Pure + deterministic.
 */
export function suggestCoupeStations(result: SolveResult): number[] {
  const length = result.member.length;
  const mid = length / 2;
  const out = new Set<number>([mid]);
  for (const r of longitudinalRanges(result)) {
    if (r.hi - r.lo < 0.98 * length) out.add(Math.round(((r.lo + r.hi) / 2) * 1e3) / 1e3);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Seed the default representative coupe for a solved element (spec §9.5; §14 item 17): a
 * PERPENDICULAR cut looking along +Y. v1.0.4 C1 ([REF-SYS-810]): the station is now STATION-AWARE —
 * mid-length for a plain member (byte-identical), but shifted to reveal offset/bent/relevé/extra
 * detailing when the addressable channel places bars a mid-span cut would miss. The owner may move,
 * rename, add to, or delete it. ⚠ the G-COUPE conventions (near-parallel angle, look-behind depth,
 * cutting-line/tag style, default station) remain PROVISIONAL pending owner/engineer ratification.
 */
export function defaultCoupeFor(
  result: SolveResult,
  conv: CoupeConvention = DEFAULT_COUPE_CONVENTION,
): SectionCut {
  const length = result.member.length;
  const spacing = result.member.transverse[0]?.spacing;
  const tag = conv.tagFor(0);
  // Station-aware only when the addressable channel is active; grouped docs keep mid-length exactly.
  const station = result.longBars && result.longBars.length > 0 ? richestStation(result, length) : length / 2;
  return {
    id: tag,
    label_fr: conv.labelFor(tag),
    origin: { x: 0, y: station, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    lookBehind_mm: resolveLookBehind(undefined, spacing, conv),
    isDefault: true,
  };
}
