/**
 * Generic segment-grammar generator (spec §5.2.1 [REF-SHAPE-511], §6 step 2).
 *
 * Consumes a ShapeArchetype + resolved params + diameter + the active CodePack and emits:
 *   - centerline3D : flat [x,y,z, …] polyline sampled with mandrel fillets (for the 3D tube)
 *   - cutLength    : fabrication length = Σ straight legs + Σ hook allowances − Σ bend deductions
 *   - fiche        : labelled legs a/b/c…, per-bend angle + mandrel, hooks
 *
 * Turtle/LOGO model in the local right-handed frame (u=run, v=lateral, w=out-of-plane);
 * 2D archetypes live in u–v. The PlacementRule (§5.4) supplies the world transform — this
 * generator never hard-codes world orientation. Only SPIRALE_HELICE / TREILLIS_MESH are
 * bespoke (§5.2.1g) and are NOT handled here.
 *
 * Pure + deterministic: no DOM/three, no Date.now()/Math.random().
 */
import type {
  ShapeArchetype,
  SegmentOp,
  LineOp,
  TurnOp,
  ArcOp,
  HookSpec,
} from "../types/shape";
import type { CodePack } from "../types/codepack";
import { evalExpr, makeScope, type ExprScope } from "./expr";

/** Chord tolerance for sampling fillet/arc centerlines (mm). */
const ARC_CHORD_MM = 2;

export interface FicheLeg {
  /** a, b, c, … in fabrication order. */
  label: string;
  /** schedule dimension to the theoretical bend intersection (mm). */
  length: number;
}

export interface FicheBend {
  /** swept angle at the bend (deg). */
  angle: number;
  /** centerline fillet radius r = mandrelDiameter/2 + diameter/2 (mm). */
  filletRadius: number;
  /** governing mandrel diameter (mm). */
  mandrelDiameter: number;
  /** true for end-hook bends (vs body corners). */
  isHook: boolean;
}

export interface FicheHook {
  end: "start" | "end";
  angle: number;
  /** straight extension allowance beyond the bend (mm). */
  extension: number;
}

/**
 * A user-chosen end hook (v1.0.2 F6, [REF-SYS-520]): `"none"` removes any hook; an object adds a
 * 90/135/180° anchorage hook whose extension is `extFactor·diameter` (default 10φ, BAEL/seismic min).
 * Supplied per end — it OVERRIDES the manifest's `endHooks` for that end, so a hook can be put on any
 * shape (the grammar's hook accounting handles the cutLength/`totalLengthExpr` cross-check).
 */
export type UserHook = "none" | { angle: 90 | 135 | 180; extFactor?: number };

export interface BarShapeOptions {
  /** F6 per-end hook override; an absent end keeps the manifest's `endHooks`. */
  hooks?: { start?: UserHook; end?: UserHook };
}

export interface BarShapeResult {
  archetypeId: string;
  /** flat [x,y,z, …] in the local frame (mm). */
  centerline3D: number[];
  /** site fabrication length (mm) — NOT the naive polyline sum. */
  cutLength: number;
  /** true geometric centerline length incl. fillet arcs (mm). */
  geomLength: number;
  closed: boolean;
  /** for closed shapes: did the body polyline weld within tolerance. */
  closes: boolean;
  /** governing mandrel diameter used for fillets (mm). */
  mandrelDiameter: number;
  fiche: { legs: FicheLeg[]; bends: FicheBend[]; hooks: FicheHook[] };
}

interface Vec2 {
  u: number;
  v: number;
}

const DEG = Math.PI / 180;
const LABELS = "abcdefghijklmnopqrstuvwxyz";

/** Resolve a `dir` token (u+/u-/v+/v- or absolute degrees) to a heading in degrees. */
function headingFromDir(dir: string | undefined, current: number): number {
  if (dir === undefined) return current;
  switch (dir) {
    case "u+":
      return 0;
    case "u-":
      return 180;
    case "v+":
      return 90;
    case "v-":
      return 270;
    default: {
      const n = Number(dir);
      if (!Number.isFinite(n)) throw new Error(`bad segment dir "${dir}"`);
      return n;
    }
  }
}

function advance(p: Vec2, heading: number, len: number): Vec2 {
  return { u: p.u + len * Math.cos(heading * DEG), v: p.v + len * Math.sin(heading * DEG) };
}

function isLine(op: SegmentOp): op is LineOp {
  return typeof (op as LineOp).line !== "undefined";
}
function isTurn(op: SegmentOp): op is TurnOp {
  return typeof (op as TurnOp).turn !== "undefined";
}
function isArc(op: SegmentOp): op is ArcOp {
  return typeof (op as ArcOp).arc !== "undefined";
}

interface BodyBend {
  angle: number;
  isHook: boolean;
}

/**
 * Generate the centerline + cut length + fiche for one bar group's shape.
 * `params` carries the archetype param values by key; `diameter` is the bar ø (mm).
 */
export function generateBarShape(
  archetype: ShapeArchetype,
  params: Record<string, number>,
  diameter: number,
  code: CodePack,
  opts?: BarShapeOptions,
): BarShapeResult {
  const mandrelDiameter = code.mandrelMin(diameter);
  const filletRadius = mandrelDiameter / 2 + diameter / 2;
  const baseScope = makeScope(params, diameter, code, { mandrelDiameter });

  // --- walk the segment list: collect straight legs, body bends, and polyline vertices ---
  const legs: number[] = [];
  const bodyBends: BodyBend[] = [];
  const vertices: Vec2[] = [];
  let pos: Vec2 = { u: 0, v: 0 };
  let heading = 0;
  let firstHeading: number | undefined; // heading of the first leg (for the start-hook return)
  vertices.push({ ...pos });

  for (const op of archetype.segments) {
    if (isLine(op)) {
      heading = headingFromDir(op.dir, heading);
      if (firstHeading === undefined) firstHeading = heading;
      const len = evalExpr(op.line, baseScope);
      // H19 ([v1.0.4]): reject a degenerate (non-positive) straight leg — a 0/negative body run is
      // unbuildable and would otherwise slip past the cutLength>0 guard when the other legs compensate.
      if (!(len > 0)) {
        throw new Error(`shape "${archetype.id}": non-positive leg length (${len}) — every straight run must be > 0`);
      }
      legs.push(len);
      pos = advance(pos, heading, len);
      vertices.push({ ...pos });
    } else if (isTurn(op)) {
      const angle = evalExpr(op.turn, baseScope);
      const signed = op.hand === "left" ? angle : -angle;
      heading += signed;
      bodyBends.push({ angle, isHook: false });
    } else if (isArc(op)) {
      const angle = evalExpr(op.arc, baseScope);
      const radius = evalExpr(op.radius, baseScope);
      const signed = op.hand === "left" ? angle : -angle;
      // approximate an arc as a turn at its midpoint advancing along the chord
      const chord = 2 * radius * Math.sin((angle * DEG) / 2);
      heading += signed / 2;
      pos = advance(pos, heading, chord);
      heading += signed / 2;
      vertices.push({ ...pos });
      legs.push(radius * angle * DEG); // arc centerline length contributes as a "leg"
      bodyBends.push({ angle: 0, isHook: false });
    }
    // inline {hook} ops are end-hook refs handled below via endHooks for v1.0 shapes
  }

  // --- closed shapes: weld last vertex to the first; the closing corner is a real bend ---
  let closes = true;
  if (archetype.closed) {
    const first = vertices[0]!;
    const last = vertices[vertices.length - 1]!;
    const gap = Math.hypot(last.u - first.u, last.v - first.v);
    closes = gap < Math.max(1e-6, 1e-4 * (Math.abs(first.u) + Math.abs(first.v) + 1));
    // exterior angles of a closed planar polygon sum to 360° → the closing corner angle
    const turned = bodyBends.filter((b) => !b.isHook).reduce((s, b) => s + b.angle, 0);
    const closingAngle = 360 - turned;
    if (closingAngle > 1e-6) bodyBends.push({ angle: closingAngle, isHook: false });
  }

  // --- end hooks (§5.2.1d): each adds an extension allowance + a hook bend ---
  // A user-chosen `hook_angle` param overrides the manifest's end-hook angle (v1.0.2 F2: the
  // cross-tie editor sets one hook angle for all épingles in an element; sets up F6). Additive —
  // shapes that don't pass `hook_angle` keep the manifest angle (goldens unchanged).
  const hookAngleOverride = params["hook_angle"];
  const useOverride = typeof hookAngleOverride === "number" && Number.isFinite(hookAngleOverride);
  const hooks: FicheHook[] = [];
  // resolve one end: a per-end F6 `UserHook` override wins over the manifest spec (and the F2
  // `hook_angle` param). `undefined` keeps the manifest hook → byte-identical to pre-F6.
  const hookExtFor = (spec: HookSpec, end: "start" | "end", user: UserHook | undefined): number => {
    let angle: number;
    let ext: number;
    if (user !== undefined) {
      if (user === "none") return 0;
      angle = user.angle;
      ext = Math.max((user.extFactor ?? 10) * diameter, 70);
    } else if (spec === "none" || !spec) {
      return 0;
    } else {
      angle = useOverride ? hookAngleOverride : spec.angle;
      ext = evalExpr(spec.ext_expr, baseScope);
    }
    hooks.push({ end, angle, extension: ext });
    bodyBends.push({ angle, isHook: true });
    return ext;
  };
  const extStart = hookExtFor(archetype.endHooks.start, "start", opts?.hooks?.start);
  const extEnd = hookExtFor(archetype.endHooks.end, "end", opts?.hooks?.end);
  const hookExtSum = extStart + extEnd;
  // representative per-hook ext for totalLengthExpr (uniform-hook authoring convention)
  const hookExtRep = hooks.length > 0 ? hookExtSum / hooks.length : 0;

  // --- bend deductions (§5.2.1e) from the active pack ---
  const bendDeductions = bodyBends.reduce(
    (s, b) => s + code.bendDeduction(b.angle, diameter),
    0,
  );

  // --- fabrication cut length (§5.2.1e): Σ legs + Σ hook allowances − Σ bend deductions ---
  const legSum = legs.reduce((s, l) => s + l, 0);
  const cutLength = legSum + hookExtSum - bendDeductions;

  // --- cross-check against the manifest's declared totalLengthExpr (authoring guard) ---
  const exprScope: ExprScope = {
    ...baseScope,
    mandrelDiameter,
    hookExt: hookExtRep,
    bendDeductions,
    hookAllowances: hookExtSum,
  };
  const declared = evalExpr(archetype.totalLengthExpr, exprScope);
  if (Math.abs(declared - cutLength) > 0.01) {
    throw new Error(
      `shape "${archetype.id}": totalLengthExpr (${declared.toFixed(3)}) disagrees with ` +
        `generated cutLength (${cutLength.toFixed(3)}) — check the manifest formula (§5.2.1e)`,
    );
  }

  // --- H3 ([v1.0.4]): positive-finite cutLength guard. A degenerate/negative/NaN cut length is
  // physically meaningless and would poison the BBS/DXF/splice downstream, so reject it here in the
  // core generator (not just the editor) — every consumer is now protected (D-P1-1). ---
  if (!Number.isFinite(cutLength) || cutLength <= 0) {
    throw new Error(
      `shape "${archetype.id}": non-positive cut length (${cutLength}) — check the params/legs`,
    );
  }

  // --- v1.0.3 G5 ([REF-SYS-756b], §5): render the end-hook (crochet) geometry on OPEN shapes so
  // the hook is VISIBLE in 3D/coupe/PDF/DXF (épingles especially — their hooks anchor the bar pair).
  // The hook is appended/prepended as a short return leg (the join becomes a filleted bend below);
  // its angle is the resolved hook angle (so the cross-tie `hook_angle` shows). Geometry only — the
  // cutLength/totalLengthExpr cross-check above already accounts for the hook allowance + bend, so
  // it is untouched here. CLOSED shapes (cadre/étrier) keep their welded loop (hooks internal), and
  // a no-hook end (ext 0 → DROITE & friends) adds nothing → byte-identical to pre-G5.
  if (!archetype.closed && vertices.length >= 2) {
    const h0 = firstHeading ?? 0;
    const endHook = hooks.find((h) => h.end === "end");
    const startHook = hooks.find((h) => h.end === "start");
    if (endHook && endHook.extension > 0) {
      const last = vertices[vertices.length - 1]!;
      vertices.push(advance(last, heading + endHook.angle, endHook.extension));
    }
    if (startHook && startHook.extension > 0) {
      const v0 = vertices[0]!;
      vertices.unshift(advance(v0, h0 + 180 - startHook.angle, startHook.extension));
    }
  }

  // --- build the sampled centerline (straights + fillet arcs) for the 3D tube ---
  const { points, geomLength } = sampleCenterline(vertices, archetype.closed, filletRadius);

  // --- fiche: labelled legs + bends ---
  const ficheLegs: FicheLeg[] = legs.map((length, i) => ({
    label: LABELS[i] ?? `s${i}`,
    length,
  }));
  const ficheBends: FicheBend[] = bodyBends.map((b) => ({
    angle: b.angle,
    filletRadius,
    mandrelDiameter,
    isHook: b.isHook,
  }));

  return {
    archetypeId: archetype.id,
    centerline3D: points,
    cutLength,
    geomLength,
    closed: archetype.closed,
    closes,
    mandrelDiameter,
    fiche: { legs: ficheLegs, bends: ficheBends, hooks },
  };
}

/**
 * Sample a vertex polyline into a fillet-rounded centerline. Each interior vertex is
 * replaced by a tangent circular arc of `r` (centerline radius = mandrelØ/2 + φ/2, §5.2.1e).
 * Returns flat [x,y,z,…] (z=0 for 2D archetypes) and the true centerline length.
 */
function sampleCenterline(
  vertices: Vec2[],
  closed: boolean,
  r: number,
): { points: number[]; geomLength: number } {
  // ring of vertices to corner over: for closed shapes drop the duplicated closing vertex
  const ring: Vec2[] = closed
    ? dedupeClosing(vertices)
    : vertices.slice();

  const out: number[] = [];
  let length = 0;
  const push = (p: Vec2) => {
    out.push(p.u, p.v, 0);
  };

  if (ring.length < 2) {
    if (ring.length === 1) push(ring[0]!);
    return { points: out, geomLength: 0 };
  }

  // For an open polyline endpoints are sharp; interior vertices get fillet arcs.
  // Build a simple straight polyline through fillet tangent points + sampled arcs.
  const n = ring.length;
  const first = ring[0]!;
  push(first);
  let prevPoint = first;

  const interiorCount = closed ? n : n - 1; // closed: every vertex is a corner
  for (let idx = 1; idx <= interiorCount; idx++) {
    const cur = ring[idx % n]!;
    const next = ring[(idx + 1) % n]!;
    const isLastOpen = !closed && idx === n - 1;
    if (isLastOpen) {
      length += dist(prevPoint, cur);
      push(cur);
      prevPoint = cur;
      break;
    }
    const inDir = unit(sub(cur, ring[idx - 1]!));
    const outDir = unit(sub(next, cur));
    const turn = angleBetween(inDir, outDir);
    if (turn < 1e-6 || r <= 0) {
      length += dist(prevPoint, cur);
      push(cur);
      prevPoint = cur;
      continue;
    }
    const tangent = r * Math.tan(turn / 2);
    const pIn = add(cur, scale(inDir, -tangent));
    const pOut = add(cur, scale(outDir, tangent));
    // straight up to the fillet start
    length += dist(prevPoint, pIn);
    push(pIn);
    // sample the arc from pIn to pOut
    const arcLen = r * turn;
    const steps = Math.max(1, Math.ceil(arcLen / ARC_CHORD_MM));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const p = arcPoint(pIn, pOut, cur, inDir, outDir, t, r, turn);
      push(p);
    }
    length += arcLen;
    prevPoint = pOut;
  }

  if (closed) {
    length += dist(prevPoint, first);
  }
  return { points: out, geomLength: length };
}

function dedupeClosing(vertices: Vec2[]): Vec2[] {
  if (vertices.length < 2) return vertices.slice();
  const first = vertices[0]!;
  const last = vertices[vertices.length - 1]!;
  if (Math.hypot(last.u - first.u, last.v - first.v) < 1e-6) {
    return vertices.slice(0, -1);
  }
  return vertices.slice();
}

// --- small vector helpers (local u–v plane) ---
function sub(a: Vec2, b: Vec2): Vec2 {
  return { u: a.u - b.u, v: a.v - b.v };
}
function add(a: Vec2, b: Vec2): Vec2 {
  return { u: a.u + b.u, v: a.v + b.v };
}
function scale(a: Vec2, k: number): Vec2 {
  return { u: a.u * k, v: a.v * k };
}
function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.u - b.u, a.v - b.v);
}
function unit(a: Vec2): Vec2 {
  const m = Math.hypot(a.u, a.v) || 1;
  return { u: a.u / m, v: a.v / m };
}
function angleBetween(a: Vec2, b: Vec2): number {
  const dot = Math.max(-1, Math.min(1, a.u * b.u + a.v * b.v));
  return Math.acos(dot);
}

/** Parametric point along the corner fillet arc (t ∈ [0,1] from pIn to pOut). */
function arcPoint(
  pIn: Vec2,
  pOut: Vec2,
  corner: Vec2,
  inDir: Vec2,
  outDir: Vec2,
  t: number,
  r: number,
  turn: number,
): Vec2 {
  // center of the fillet: offset from the corner along the interior bisector
  const bis = unit(add(scale(inDir, -1), outDir));
  const centerDist = r / Math.sin((Math.PI - turn) / 2 || 1);
  const center = add(corner, scale(bis, centerDist));
  const a0 = Math.atan2(pIn.v - center.v, pIn.u - center.u);
  const a1 = Math.atan2(pOut.v - center.v, pOut.u - center.u);
  let da = a1 - a0;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const a = a0 + da * t;
  return { u: center.u + r * Math.cos(a), v: center.v + r * Math.sin(a) };
}
