/**
 * Shared placed-bar resolution pass (v1.0.5 M2 / P-B, [REF-SYS-530]).
 *
 * ONE function turns a `PlacedBarInput[]` (the canonical `SingleBar` family, `types/placed-bar.ts`)
 * into resolved `PlacedLongBar[]` — each bar's own shape geometry, curtailment clip, splice
 * segmentation and anchorage. It is the **single long-steel truth** for freely placed bars, called by
 * `solveElement` (RECT, for its independent/extra bars) AND by the four generic shims
 * (`pipeline/{circular,slab,stair,joist}.ts`) so free placement works on all 8 elements — not just
 * column/beam. The section-specific base-bar reconstruction for RECT (distributing a face's bars
 * across its zones, the two-support-chapeau expansion) stays in `element.ts buildLongBars`, which
 * shares this module's per-bar primitives (`clipToStations`, `barSplice`).
 *
 * Two placement modes (audit B3):
 *   - **free** — a `SingleBar` at `(u,v)` resolves section-agnostically (a standalone bar).
 *   - **override** — a `SingleBar` with `overrideBarIndex` modifies the native layout bar at that index;
 *     its section position comes from `ctx.layoutBars[idx]` (the section's own bar convention — RECT
 *     face/zone, SLAB/JOIST `byZone`, CIRCULAR pitch-circle index), so the resolution is section-aware.
 *
 * Pure + deterministic; pack-agnostic (BAEL/EC2 swap behind `code.*`). No DOM/three.
 */
import type { ShapeArchetype } from "../types/shape";
import type { BarRole } from "../types/reinforcing-element";
import type { BarPosition, SectionKind } from "../types/layout";
import type { MaterialContext } from "../types/codepack";
import {
  type PlacedBarInput,
  type PlacedBarBody,
  type SingleBar,
  type BarRow,
  type Bundle,
  type Layer,
  isSingleBar,
  isBarRow,
  isBundle,
  isLayer,
} from "../types/placed-bar";
import type { BarShapeResult, UserHook } from "../geometry/segment-grammar";
import { generateShape } from "../geometry/registry";
import { spliceBar, autoSplices, evaluateLapStagger, type Splice, type SpliceResult } from "../geometry/splice";
import type { LapExtent } from "../types/seismic";
import type { ExtendedCodePack, ValidationItem } from "../validation/index";
import type { PlacedLongBar, SolvedGroup } from "../pipeline/element";

/** Default commercial stock length (mm) for per-bar auto-splitting — ⚠ PROVISIONAL, G-BAEL. */
const DEFAULT_STOCK = 12000;

/**
 * Clip a bar to `[start, end]` (v1.0.5 P2 ([REF-SYS-260], D3)): re-generate its shape with the run
 * shortened, its cut length following. The principal length param (`totalLengthParam`, else the DROITE
 * `L` slot) carries the clipped run; hooks/Ø are preserved. The linear inversion mirrors the adapter's
 * H2 `applyUniqueLength` (a leg's contribution is unit, the hook/bend allowances depend only on Ø+angle)
 * so `cutLength == run + fixed part`. Pure. Shared by `element.ts buildLongBars` (base bars) + the
 * free-bar path here, so curtailment behaves identically wherever a bar is placed.
 */
export function clipToStations(
  arch: ShapeArchetype,
  params: Record<string, number>,
  dia: number,
  hooks: { start?: UserHook; end?: UserHook } | undefined,
  start: number,
  end: number,
  code: ExtendedCodePack,
): { shape: BarShapeResult; axisStart: number } {
  const run = Math.max(1, end - start);
  const opts = hooks ? { hooks } : undefined;
  const tlp = arch.totalLengthParam;
  const p =
    tlp && params[tlp] !== undefined
      ? { ...params, [tlp]: params[tlp] + (run - generateShape(arch, params, dia, code, opts).cutLength) }
      : { ...params, L: run };
  return { shape: generateShape(arch, p, dia, code, opts), axisStart: start };
}

/**
 * Per-bar splice — explicit lap/coupler stations + optional auto-split at the stock length. The
 * segments feed the schedule (BBS) + the stagger/seismic checks; an unspliced bar → `undefined`.
 * Shared with `element.ts` (v1.0.4 H14/B1).
 */
export function barSplice(
  shape: BarShapeResult,
  dia: number,
  splices: Splice[] | undefined,
  autoSplice: boolean | undefined,
  code: ExtendedCodePack,
  material: MaterialContext,
  stockLength?: number,
): SpliceResult | undefined {
  const stock = stockLength ?? DEFAULT_STOCK;
  const pts: Splice[] = [...(splices ?? []), ...(autoSplice ? autoSplices(shape.cutLength, stock) : [])];
  if (pts.length === 0) return undefined;
  return spliceBar(shape.cutLength, pts, code, { diameter: dia, material, fractionLapped: 1 });
}

/** Context for the shared pass: what a section needs to resolve a placed bar's geometry + position. */
export interface ResolvePlacedContext {
  /** member length along the run axis (mm) — a curtailment `endStation` defaults to it. */
  memberLength: number;
  code: ExtendedCodePack;
  material: MaterialContext;
  /** commercial stock length (mm) for auto-split; default 12 000 (⚠ PROVISIONAL, G-BAEL). */
  stockLength?: number;
  /** native layout bars — an OVERRIDE bar's section position is read from here (audit B3, section-aware). */
  layoutBars?: BarPosition[];
  /** solved groups — an OVERRIDE bar inherits its target bar's group shape/Ø when it does not replace them. */
  groups?: SolvedGroup[];
  /** first `barIndex` for appended FREE bars (default 0) — the generic shims pass `bars.length`. */
  startIndex?: number;
  /** section kind (RECT/CIRCULAR/SLAB) — carried for the override resolver's section-awareness. */
  section?: SectionKind;
  /**
   * v1.0.5 M3 (P-D): section width `b` × depth `h` (mm) — needed to place a `Layer`'s bars inboard of a
   * face. Present for RECT + slab-family (`b=Ly, h=t`); absent for CIRCULAR, which supplies `sectionD`
   * instead. Row/Bundle placement is section-agnostic and needs neither.
   */
  sectionDims?: { b: number; h: number };
  /**
   * v1.0.6-fix R5 (owner **O-3c**): CIRCULAR overall diameter `D` (mm). A round section has no face, so a
   * `Layer` there is an inner concentric **pitch circle** (`expandRadialLayer`) rather than a face band.
   * Present for CIRCULAR; absent for RECT/slab-family, which supply `sectionDims`. The `Layer` expander
   * dispatches on the SECTION descriptor — never on the element (invariant 3).
   */
  sectionD?: number;
}

/** The group owning the layout bar at `idx` (for an override that inherits its shape). */
function groupForLayoutBar(idx: number, ctx: ResolvePlacedContext): SolvedGroup | undefined {
  const bp = ctx.layoutBars?.[idx];
  if (!bp || !ctx.groups) return undefined;
  const byZone = ctx.groups.find((g) => g.zone === bp.faceTag);
  return byZone ?? ctx.groups.find((g) => g.role === "PRIMARY_LONGITUDINAL" || g.role === "DISTRIBUTION");
}

/**
 * Resolve ONE `SingleBar` → a `PlacedLongBar`. Free bars are `standalone` (their own `id`); an override
 * bar (`overrideBarIndex` set) is section-aware — its position comes from the target layout bar and it
 * may inherit that bar's group shape/Ø.
 */
export function resolveSingleBar(
  sb: import("../types/placed-bar").SingleBar,
  assignedIndex: number,
  ctx: ResolvePlacedContext,
): PlacedLongBar {
  const target = sb.overrideBarIndex !== undefined ? ctx.layoutBars?.[sb.overrideBarIndex] : undefined;
  const isOverride = target !== undefined;
  const g = isOverride ? groupForLayoutBar(sb.overrideBarIndex!, ctx) : undefined;
  const position = target ? target.position : sb.position;
  const barIndex = isOverride ? sb.overrideBarIndex! : assignedIndex;
  const role: BarRole = sb.role ?? g?.role ?? "PRIMARY_LONGITUDINAL";
  // v1.0.6-fix R1 (F-A): TWO diameters, deliberately.
  //   `diameter` = the PHYSICAL bar → area, mass, the BBS Ø column, the section dot. Never φₙ (a bundle
  //                must not gain phantom steel).
  //   `codeDia`  = the diameter the CODE rules judge → lap length + mandrel/bend radius (and, via
  //                `equivDiameter` on the view, clear-spacing to neighbours). For a bundled bar this is
  //                φₙ = φ·√n (spec P-E, owner O-1); for every other bar it IS the physical Ø, so the
  //                resolved bar is byte-identical to pre-R1.
  const diameter = sb.diameter;
  const codeDia = sb.equivDiameter ?? sb.diameter;
  const hooksOpt = sb.hooks ? { hooks: sb.hooks } : undefined;

  let shape = generateShape(sb.shape, sb.params, codeDia, ctx.code, hooksOpt);
  let axisStart = sb.axisStart ?? 0;
  let startStation: number | undefined;
  let endStation: number | undefined;
  if (sb.startStation !== undefined || sb.endStation !== undefined) {
    startStation = sb.startStation ?? axisStart;
    endStation = sb.endStation ?? ctx.memberLength;
    const clipped = clipToStations(sb.shape, sb.params, codeDia, sb.hooks, startStation, endStation, ctx.code);
    shape = clipped.shape;
    axisStart = clipped.axisStart;
  }
  const removed = sb.removed === true;
  const splice = removed
    ? undefined
    : barSplice(shape, codeDia, sb.splices, sb.autoSplice, ctx.code, ctx.material, ctx.stockLength);

  return {
    barIndex,
    groupId: sb.id,
    role,
    position,
    shape,
    diameter,
    axisStart,
    removed,
    standalone: !isOverride,
    // R1 (F-A): carry φₙ to the rules that live downstream of the pipeline (clear-spacing).
    ...(sb.equivDiameter !== undefined ? { equivDiameter: sb.equivDiameter } : {}),
    ...(startStation !== undefined ? { startStation } : {}),
    ...(endStation !== undefined ? { endStation } : {}),
    ...(sb.anchorage ? { anchorage: sb.anchorage } : {}),
    ...(splice ? { splice } : {}),
  };
}

/**
 * Copy a placed bar's `PlacedBarBody` (shape/params/Ø/hooks/role/curtailment/splice/removed) onto a
 * fresh `SingleBar` at `position` with the derived `id`. The single spot every expanded row/bundle/layer
 * bar is minted, so they curtail + splice + schedule exactly like a first-class `SingleBar`.
 */
function toSingle(id: string, position: { u: number; v: number }, body: PlacedBarBody): SingleBar {
  return {
    kind: "single",
    id,
    position,
    shape: body.shape,
    params: body.params,
    diameter: body.diameter,
    ...(body.hooks ? { hooks: body.hooks } : {}),
    ...(body.role ? { role: body.role } : {}),
    ...(body.axisStart !== undefined ? { axisStart: body.axisStart } : {}),
    ...(body.startStation !== undefined ? { startStation: body.startStation } : {}),
    ...(body.endStation !== undefined ? { endStation: body.endStation } : {}),
    ...(body.anchorage ? { anchorage: body.anchorage } : {}),
    ...(body.splices ? { splices: body.splices } : {}),
    ...(body.autoSplice ? { autoSplice: body.autoSplice } : {}),
    ...(body.removed ? { removed: body.removed } : {}),
  };
}

/** P-C: a `BarRow` → N `SingleBar`s from `anchor` along `direction`, by `count` (even) or `spacing`. */
function expandRow(row: BarRow): SingleBar[] {
  const n = row.count ?? (row.spacing && row.spacing > 0 ? Math.max(1, Math.floor(row.extent / row.spacing) + 1) : 1);
  // count → spread evenly over the extent (inclusive ends); spacing → step by the given spacing.
  const step = n > 1 ? (row.count ? row.extent / (n - 1) : row.spacing!) : 0;
  const out: SingleBar[] = [];
  for (let i = 0; i < n; i++) {
    const off = step * i;
    const position =
      row.direction === "u"
        ? { u: row.anchor.u + off, v: row.anchor.v }
        : { u: row.anchor.u, v: row.anchor.v + off };
    out.push(toSingle(`${row.id}#${i}`, position, row));
  }
  return out;
}

/**
 * P-E: a `Bundle` → `n` touching `SingleBar`s in a line centred at `position` (centre-to-centre = Ø).
 *
 * **v1.0.6-fix R1 (F-A):** expanding a bundle into N independent bars destroys the fact that they act as
 * ONE bar for the code rules. Each expanded bar therefore carries `equivDiameter = φₙ` (from the PACK —
 * `code.bundleEquivDiameter`, never recomputed inline, so BAEL and EC2 stay free to differ, D-P1-3), and
 * `resolveSingleBar` spends it on the **lap** + **mandrel** while area/mass stay on the physical Ø.
 * Before R1 the lap was computed on the bare Ø: a 4×Ø20 bundle lapped at l0(20)=1323 mm where l0(φₙ=40)
 * requires 2646 mm — 50 % short, and NO rule fired. Owner decision O-1 (2026-07-11). ⚠ G-BAEL/G-EC2.
 */
function expandBundle(b: Bundle, ctx: ResolvePlacedContext): SingleBar[] {
  const n = Math.max(1, Math.round(b.n));
  const phiN = ctx.code.bundleEquivDiameter?.(b.diameter, n) ?? b.diameter;
  const start = -((n - 1) / 2) * b.diameter; // centre the touching cluster on the bundle position
  const out: SingleBar[] = [];
  for (let i = 0; i < n; i++) {
    const sb = toSingle(`${b.id}#${i}`, { u: b.position.u + start + i * b.diameter, v: b.position.v }, b);
    // a 1-bar "bundle" is not a bundle → φₙ === Ø → leave the field absent (byte-identical).
    if (phiN !== b.diameter) sb.equivDiameter = phiN;
    out.push(sb);
  }
  return out;
}

/** the centre-to-centre step between consecutive layers (P-D) — shared by both section geometries. */
function layerStep(l: Layer): number {
  return l.diameter + (l.layerGap ?? Math.max(l.diameter, 20));
}

/** P-D: a `Layer` → `count` `SingleBar`s spread across a FACE, offset `layerIndex` steps inboard. */
function expandFaceLayer(l: Layer, dims: { b: number; h: number }): SingleBar[] {
  const step = layerStep(l);
  const vertical = l.face === "TOP" || l.face === "BOTTOM"; // fixed axis = v, spread axis = u
  const D = vertical ? dims.h : dims.b;
  const outward = l.face === "TOP" || l.face === "RIGHT" ? 1 : -1; // +v/+u faces vs −v/−u faces
  const fixed = outward * (D / 2 - l.inset - l.layerIndex * step); // inboard of the cover face
  const n = Math.max(1, l.count);
  const half = l.span / 2;
  const spreadStep = n > 1 ? (2 * half) / (n - 1) : 0;
  const out: SingleBar[] = [];
  for (let i = 0; i < n; i++) {
    const c = n > 1 ? -half + spreadStep * i : 0;
    const position = vertical ? { u: c, v: fixed } : { u: fixed, v: c };
    out.push(toSingle(`${l.id}#${i}`, position, l));
  }
  return out;
}

/**
 * v1.0.6-fix R5 (owner decision **O-3c**, 2026-07-11): a `Layer` on a **CIRCULAR** section is an inner,
 * concentric **pitch circle** — a round section has no face to hang a flexural layer off, so the layer is
 * radial. `count` bars at the equal angular step `2π/n` from the **+u datum**, matching the native layout
 * (`solveCircularLayout`), so an inner layer sits radially aligned with the cage when the counts agree.
 *
 * The radius uses the SAME formula shape as the face layer (`R = D/2 − inset − layerIndex·step`), so the
 * two section geometries stay one convention — including its edge behaviour: an `inset` driven past the
 * section centre mirrors the ring onto the |R| circle, exactly as the face layer flips to the opposite
 * face (M3). In both cases the steel is drawn, credited and scheduled where it actually lands, so the user
 * sees the consequence of the number they typed — visible, not silent.
 *
 * `face` and `span` are meaningless on a closed circle and are ignored (a circle has no face and no end).
 *
 * Before R5 this returned `[]`: placing a layer on a pile/circular column created a doc entry and **zero
 * steel**, silently. It was unreachable only because the section canvas did not exist on those elements.
 */
function expandRadialLayer(l: Layer, D: number): SingleBar[] {
  const R = D / 2 - l.inset - l.layerIndex * layerStep(l);
  const n = Math.max(1, l.count);
  const out: SingleBar[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (i * 2 * Math.PI) / n; // datum +u — the native pitch circle's datum (§6.1)
    out.push(toSingle(`${l.id}#${i}`, { u: R * Math.cos(theta), v: R * Math.sin(theta) }, l));
  }
  return out;
}

/** Dispatch a `Layer` by the SECTION descriptor (never by element type — invariant 3). */
function expandLayer(l: Layer, ctx: ResolvePlacedContext): SingleBar[] {
  if (ctx.sectionD !== undefined) return expandRadialLayer(l, ctx.sectionD); // round → inner pitch circle
  if (ctx.sectionDims) return expandFaceLayer(l, ctx.sectionDims); // rect/slab → a face layer
  return []; // no section descriptor at all → nothing to place against
}

/**
 * Expand a `PlacedBarInput` into the concrete `SingleBar`s the pass resolves. A `SingleBar` is itself; a
 * `BarRow`/`Bundle`/`Layer` (M3) fans out to N bars (each edited/persisted as the one parent object).
 */
function expandPlaced(p: PlacedBarInput, ctx: ResolvePlacedContext): SingleBar[] {
  if (isSingleBar(p)) return [p];
  if (isBarRow(p)) return expandRow(p);
  if (isBundle(p)) return expandBundle(p, ctx);
  if (isLayer(p)) return expandLayer(p, ctx);
  return [];
}

/**
 * Resolve a list of placed bars → `PlacedLongBar[]`. Each input is first expanded (a row/bundle/layer
 * fans out to N `SingleBar`s, M3); free bars then get sequential indices from `ctx.startIndex` and
 * override bars keep their target index. Identical expanded bars (a bundle, a row) merge to ONE mark in
 * the BBS (keyed by shape/Ø/cut, not position) with the real count.
 */
export function resolvePlacedBars(placed: PlacedBarInput[], ctx: ResolvePlacedContext): PlacedLongBar[] {
  const out: PlacedLongBar[] = [];
  let idx = ctx.startIndex ?? 0;
  for (const p of placed) {
    // v1.0.5 M4: tag every resolved bar with the parent input's id + kind so the Track V validation can
    // exempt intra-bundle touching pairs from clear-spacing and group bundle/layer members for their rules.
    const kind = p.kind;
    for (const sb of expandPlaced(p, ctx)) {
      const lb = resolveSingleBar(sb, idx++, ctx);
      lb.placedParentId = p.id;
      lb.placedKind = kind;
      out.push(lb);
    }
  }
  return out;
}

/** The result of analysing the lap splices carried by a set of resolved placed bars (v1.0.5 M5). */
export interface PlacedLapAnalysis {
  /** lap extents along the member — feed the seismic `lap_in_critical_zone` where an overlay is composed. */
  lapExtents: LapExtent[];
  /** per-zone STAGGER PASS/WARN items (EC2 §8.7.2). */
  staggerItems: ValidationItem[];
}

/** Absolute lap stations (mm from the member origin) of a spliced bar. */
function lapStationsOf(sp: SpliceResult, axisStart: number): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const seg of sp.segments) {
    acc += seg.cutLength - (seg.lapForward ? sp.lapLength : 0);
    if (seg.lapForward) out.push(axisStart + acc);
  }
  return out;
}

/**
 * v1.0.5 M5 (Track S, [REF-SYS-770] §B1): analyse the lap splices carried by a set of resolved placed
 * bars — the per-zone **STAGGER** check (EC2 §8.7.2: ≤ ½ of a zone's bars lapped within one 0.3·l0
 * section → PASS, else WARN) + the **lap extents** (which drive the seismic `lap_in_critical_zone` where
 * an overlay is composed, i.e. column/beam). Extracted from `pipeline/element.ts` so EVERY pipeline (RECT
 * + the four generic shims) judges a spliced free bar identically. Pure; a bar with no forward lap
 * contributes nothing (so a doc with no spliced placed bars yields empty → byte-identical).
 */
export function analyzePlacedBarLaps(longBars: PlacedLongBar[], code: ExtendedCodePack): PlacedLapAnalysis {
  const lapExtents: LapExtent[] = [];
  const staggerItems: ValidationItem[] = [];
  const byZone = new Map<string, { stations: number[][]; total: number; lapLength: number; anyLap: boolean }>();
  for (const pb of longBars) {
    if (pb.removed) continue;
    const z = byZone.get(pb.groupId) ?? { stations: [], total: 0, lapLength: 0, anyLap: false };
    z.total++;
    if (pb.splice && pb.splice.segments.some((s) => s.lapForward)) {
      const stations = lapStationsOf(pb.splice, pb.axisStart);
      z.stations.push(stations);
      z.lapLength = pb.splice.lapLength;
      z.anyLap = true;
      for (const at of stations) {
        lapExtents.push({ groupId: pb.groupId, start: at - pb.splice.lapLength / 2, end: at + pb.splice.lapLength / 2 });
      }
    }
    byZone.set(pb.groupId, z);
  }
  const codeRef = (code as { codeRef?: string }).codeRef ?? code.id;
  for (const [groupId, z] of byZone) {
    if (!z.anyLap) continue;
    const st = evaluateLapStagger(z.stations, z.lapLength, z.total);
    const pct = Math.round(st.worstFraction * 100);
    staggerItems.push({
      rule: `lap_stagger:${groupId}`,
      status: st.pass ? "PASS" : "WARN",
      value: pct,
      limit: 50,
      codeRef,
      message_fr: st.pass
        ? `Recouvrements décalés (${pct} % par section ≤ 50 %)`
        : `Recouvrements alignés (${pct} % > 50 % dans 0,3·l0=${Math.round(st.window)} mm) — décaler (quinconce)`,
      message_en: st.pass
        ? `Laps staggered (${pct} % per section ≤ 50 %)`
        : `Laps clustered (${pct} % > 50 % within 0.3·l0=${Math.round(st.window)} mm) — stagger`,
      affectedGroupIds: [groupId],
      tier: st.pass ? 3 : 2,
      symbol: st.pass ? "🟢" : "🟠",
    });
  }
  return { lapExtents, staggerItems };
}
