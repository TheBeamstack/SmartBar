/**
 * Adapter: ElementDoc → engine ElementSolveInput → SolveResult. Pure (no React/DOM/three) so it
 * is exercised headlessly (store_resolve / perf_budget / beam tests) and reused by the store.
 *
 * The engine is consumed UNCHANGED: this adapter marshals each element's conventions (column tie
 * inset; beam span/chapeau/stirrup; chapeau curtailment extension §7.7), injects the BAEL pack +
 * referenced archetypes, and dispatches the generic `solveElement` (which picks the validation
 * profile from the input). Supplements (§5.5) are resolved against the first-pass base bars and
 * folded back in. No geometry/validation math lives here — that all stays in @rebarconfig/core.
 */
import {
  solveElement,
  solveCircular,
  solveSlab,
  solveStair,
  solveJoist,
  computeCurtailment,
  resolveSupplement,
  type SolveResult,
  type ElementSolveInput,
  type SeismicElementInput,
  resolveBarPairPlacement,
  type ElementSupplementInput,
  type ElementTransInput,
  type ValidationItem,
  type BarPosition,
  type CircularSolveInput,
  type SlabSolveInput,
  type StairSolveInput,
  type JoistSolveInput,
  type LongBarOverride,
  type ExtraLongBar,
  generateBarShape,
  type ShapeArchetype,
} from "@rebarconfig/core";
import { makeBaelPack, makeEc2Pack, makeRpsOverlay, type BaelPack } from "@rebarconfig/codepacks";
import {
  type ElementDoc,
  type ColumnDoc,
  type BeamDoc,
  type GenericDoc,
  type ZoneEdit,
  type SeismicEdit,
  type CrossTie,
  type TransverseRegion,
  type BarFaconnage,
  type BarOverrideEdit,
  type AddressableBar,
  type CodePackId,
  isColumnDoc,
  isGenericDoc,
} from "./document";
import type { UserHook } from "@rebarconfig/core";
import { loadShape, supplementManifest } from "./manifests";

/** The BAEL-FR pack — the default. Built once; pure data+fns. */
export const baelPack: BaelPack = makeBaelPack();

/**
 * A3/H13 ([v1.0.4]): the two reachable code packs, built once. `makeEc2Pack()` returns `Ec2Pack`
 * which is structurally `CodePack & PackExtras` — the SAME shape as `BaelPack` (identical `code.*` +
 * `PackExtras` members, only the numbers differ, D-P1-3) — so the whole adapter stays typed against
 * `BaelPack` and the engine (which never imports a pack) is untouched. `packFor` maps the doc's
 * `codePack` (default BAEL) to the active pack; a single seam threads it into every generator call.
 */
const PACKS: Record<CodePackId, BaelPack> = { BAEL: baelPack, EC2: makeEc2Pack() };
export function packFor(id: CodePackId | undefined): BaelPack {
  return PACKS[id ?? "BAEL"];
}

// ---------------------------------------------------------------------------
// seismic overlay (§7.10) — composed on top of the base profile when a regime is set
// ---------------------------------------------------------------------------
function seismicBlock(
  edit: SeismicEdit | undefined,
  member: SeismicElementInput["member"],
  longBarsTotal: number,
  longBarsEngaged: number,
): { seismic?: SeismicElementInput } {
  if (!edit) return {};
  const overlay = makeRpsOverlay({ code: edit.code, zone: edit.zone, ductility: edit.ductility });
  return { seismic: { overlay, member, longBarsTotal, longBarsEngaged } };
}

/**
 * v1.0.2 F2 ([REF-SYS-756]): the transverse reinforcement of a column/beam is the perimeter cadre
 * PLUS a user list of cross-ties (épingles), each engaging two real longitudinal bars. The shared
 * config (group id / Ø / spacing / cross-ties / hook angle) is read polymorphically so columns
 * (`tie`) and beams (`stirrup`) reuse the SAME model — no element branching in core.
 */
interface TransverseConfig {
  groupId: string;
  diameter: number;
  spacing: number;
  crossTies: CrossTie[];
  hookAngle: number;
  /** F5 per-region spacing along the member axis; undefined → uniform `spacing`. */
  regions?: TransverseRegion[];
}
function transverseConfig(doc: ColumnDoc | BeamDoc): TransverseConfig {
  const t = isColumnDoc(doc) ? doc.tie : doc.stirrup;
  return {
    groupId: t.groupId,
    diameter: t.diameter,
    spacing: t.spacing,
    crossTies: t.crossTies ?? [],
    hookAngle: t.crossTieHookAngle ?? 135,
    ...(t.regions !== undefined ? { regions: t.regions } : {}),
  };
}

/**
 * Effective leg count for the Asw check = perimeter cadre (2) + 2 legs per cross-tie épingle —
 * the inverse of the v1.0.1 `nLegs ↔ (nLegs−2)/2 épingles` convention, so Asw now equals what is
 * drawn and scheduled (number = model = schedule, §2.2).
 */
function effectiveNLegs(cfg: TransverseConfig): number {
  return 2 + 2 * cfg.crossTies.length;
}

/**
 * Real seismic engaged-bar count (§2.4, replaces the hardcoded 4/2): the corner bars (always
 * engaged by the cadre) plus every distinct longitudinal bar a cross-tie binds.
 */
function engagedCount(bars: BarPosition[], crossTies: CrossTie[], total: number): number {
  const set = new Set<number>();
  bars.forEach((b, i) => {
    if (b.isCorner) set.add(i);
  });
  for (const ct of crossTies) {
    if (ct.barA >= 0 && ct.barA < bars.length) set.add(ct.barA);
    if (ct.barB >= 0 && ct.barB < bars.length) set.add(ct.barB);
  }
  return Math.min(total, set.size);
}

/**
 * Build one ANCHORED épingle transverse group per cross-tie: the loop is placed ON the midpoint of
 * the two engaged bars and rotated to their A→B line (D-P3-6 → anchored by F2), with `hook_angle`
 * driving the end-hook geometry. Broken bindings (a deleted bar) are skipped (the rebind WARN flow
 * is unchanged). Reuses `resolveBarPairPlacement` (D-P3-4 stable indices).
 */
function resolveCrossTies(cfg: TransverseConfig, bars: BarPosition[]): ElementTransInput[] {
  const out: ElementTransInput[] = [];
  cfg.crossTies.forEach((ct, k) => {
    const placed = resolveBarPairPlacement(bars, ct.barA, ct.barB);
    if (!placed.valid || !placed.position) return;
    out.push({
      zone: `${cfg.groupId}_xtie`,
      groupId: `${cfg.groupId}_X${k + 1}`,
      shape: loadShape("EPINGLE"),
      params: { span: placed.span ?? 0, hook_angle: cfg.hookAngle },
      diameter: ct.diameter ?? cfg.diameter,
      spacing: cfg.spacing,
      nLegs: 2,
      aswReqPerM: 0,
      anchor: { u: placed.position.u, v: placed.position.v, angleDeg: placed.angleDeg ?? 0 },
      // cross-ties densify WITH the cadre — share its F5 spacing regions (consistent placement/BBS).
      ...(cfg.regions !== undefined ? { regions: cfg.regions } : {}),
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// F6 façonnage ([REF-SYS-520]): a longitudinal group's user shape params + end hooks pass straight
// through to the generic generator (the engine already accepts any shape+params). Absent → the
// computed default params + the shape manifest's own hooks (legacy byte-identical).
// ---------------------------------------------------------------------------
function faconnageParams(f: BarFaconnage | undefined, fallback: Record<string, number>): Record<string, number> {
  return f?.shapeParams && Object.keys(f.shapeParams).length > 0 ? f.shapeParams : fallback;
}
function faconnageHooks(f: BarFaconnage | undefined): { start?: UserHook; end?: UserHook } | undefined {
  if (!f?.hooks) return undefined;
  const toHook = (c: "none" | 90 | 135 | 180): UserHook => (c === "none" ? "none" : { angle: c });
  return { start: toHook(f.hooks.start), end: toHook(f.hooks.end) };
}

/**
 * H11 ([v1.0.4]): seed a shape's params from the manifest `default`s — no positional guessing. A
 * length param with no authored default (only DROITE's `L`) tracks the member length (H12 coupling);
 * everything else is 0. Shared by the adapter (extra-bar fallback) and the FaconnageEditor UI so the
 * seed a picked shape gets and the seed the solve computes are identical.
 */
export function defaultParams(shape: ShapeArchetype, memberLength: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of shape.params) {
    out[p.key] = p.default ?? (p.type === "length" ? memberLength : 0);
  }
  return out;
}

/**
 * H2 ([v1.0.4], owner A-1/A-2): map a user "unique length" onto the shape's principal leg
 * (`totalLengthParam`) so the fabricated `cutLength == length`. Every open shape's cutLength is
 * `Σ legs + hookAllowances − bendDeductions`; the principal leg appears once with unit coefficient and
 * hookAllowances/bendDeductions depend only on Ø+angle (prep P0.5), so the linear inversion is exactly
 * `principalLeg_target = principalLeg_current + (length − cutLength_current)`. Computing the current
 * cutLength with the SAME Ø + hooks the pipeline will use makes it exact. A shape with no
 * `totalLengthParam` (or a missing leg value) falls back to the legacy `L` slot (DROITE) so nothing
 * regresses. If `length` is shorter than the shape's fixed part the target leg goes ≤0 and the core H3
 * guard rejects it downstream (surfaced by the store's keep-last-good banner).
 */
function applyUniqueLength(
  shape: ShapeArchetype,
  params: Record<string, number>,
  diameter: number,
  hooks: { start?: UserHook; end?: UserHook } | undefined,
  length: number,
  pack: BaelPack,
): Record<string, number> {
  const tlp = shape.totalLengthParam;
  if (!tlp || params[tlp] === undefined) return { ...params, L: length };
  const base = generateBarShape(shape, params, diameter, pack, hooks ? { hooks } : undefined);
  return { ...params, [tlp]: params[tlp] + (length - base.cutLength) };
}

// ---------------------------------------------------------------------------
// G2 addressable bars ([REF-SYS-530]): per-bar overrides + independent extra bars flow into the
// engine's `longOverrides`/`extraBars` channels (the pipeline emits a per-bar `longBars[]` that the
// 3D/coupe/PDF/DXF placement + the BBS consume). The adapter passes the FULL resolved shape+params
// (group default merged with the user edit + an optional unique length) so the engine regenerates
// each bar's geometry exactly. Empty lists → grouped fast path (legacy byte-identical).
// ---------------------------------------------------------------------------
function buildLongOverrides(
  edits: BarOverrideEdit[] | undefined,
  group: { shapeId: string; diameter: number },
  groupParams: Record<string, number>,
  code: BaelPack,
): LongBarOverride[] {
  if (!edits || edits.length === 0) return [];
  return edits.map((e) => {
    // H1 ([v1.0.4]): an axial-only / removed-only edit does NOT change this bar's geometry — omit
    // `shape`/`params` so the pipeline reuses the group's already-generated shape (byte-identical,
    // no regen). A change to shape/façonnage/Ø/length DOES affect the geometry (Ø & length feed the
    // cutLength invariant, D-P1-1) → regenerate.
    // v1.0.5 P2 ([REF-SYS-260], D3): per-bar curtailment stations + per-end anchorage pass straight to
    // the engine (which clips the run + shortens the cut length). They do NOT force a shape regen — the
    // engine re-generates from the zone archetype when clipping a base bar.
    const curtail = {
      ...(e.startStation !== undefined ? { startStation: e.startStation } : {}),
      ...(e.endStation !== undefined ? { endStation: e.endStation } : {}),
      ...(e.anchorage !== undefined ? { anchorage: { end: e.anchorage } } : {}),
    };
    const regen = e.shapeId !== undefined || e.faconnage !== undefined
      || e.length !== undefined || e.diameter !== undefined;
    if (!regen) {
      return {
        barIndex: e.index,
        ...(e.axialPos !== undefined ? { axisStart: e.axialPos } : {}),
        ...curtail,
        ...(e.autoSplice ? { autoSplice: true } : {}), // H14
        ...(e.splices !== undefined ? { splices: e.splices } : {}), // B1
        ...(e.removed ? { removed: true } : {}),
      };
    }
    const shapeId = e.shapeId ?? group.shapeId;
    const shapeArch = loadShape(shapeId);
    const diameter = e.diameter ?? group.diameter;
    const hooks = faconnageHooks(e.faconnage);
    // H1 ([v1.0.4]): a partial override (e.g. Ø-only) inherits the GROUP's resolved façonnage params
    // — NOT `{L:memberLen}`. Without this a bent group (BAIONNETTE, …) regenerated with its legs
    // missing and threw `Undefined symbol …` (prep_results P0.2). `faconnageParams` prefers the
    // edit's own params when present, else the group's.
    const baseParams = faconnageParams(e.faconnage, groupParams);
    // H2 ([v1.0.4]): a unique `length` drives the shape's principal leg (`totalLengthParam`) so the
    // fabricated cutLength == length on EVERY open shape — not a raw `L` symbol a bent shape ignores.
    const params = e.length !== undefined
      ? applyUniqueLength(shapeArch, baseParams, diameter, hooks, e.length, code)
      : baseParams;
    return {
      barIndex: e.index,
      shape: shapeArch,
      params,
      diameter,
      ...(hooks ? { hooks } : {}),
      ...(e.axialPos !== undefined ? { axisStart: e.axialPos } : {}),
      ...curtail,
      ...(e.autoSplice ? { autoSplice: true } : {}), // H14
      ...(e.splices !== undefined ? { splices: e.splices } : {}), // B1
      ...(e.removed ? { removed: true } : {}),
    };
  });
}

function buildExtraBars(bars: AddressableBar[] | undefined, memberLen: number, code: BaelPack): ExtraLongBar[] {
  if (!bars || bars.length === 0) return [];
  return bars.map((eb) => {
    const shapeArch = loadShape(eb.shapeId);
    const hooks = faconnageHooks(eb.faconnage);
    // H11 ([v1.0.4]): an extra bar with no explicit façonnage seeds from the manifest defaults (not a
    // bare `{L}`, which a bent shape would ignore). H2: a unique length drives the principal leg.
    const base = faconnageParams(eb.faconnage, defaultParams(shapeArch, memberLen));
    const params = eb.length !== undefined
      ? applyUniqueLength(shapeArch, base, eb.diameter, hooks, eb.length, code)
      : base;
    return {
      id: eb.id,
      position: { u: eb.u, v: eb.v },
      shape: shapeArch,
      params,
      diameter: eb.diameter,
      ...(hooks ? { hooks } : {}),
      ...(eb.axialPos !== undefined ? { axisStart: eb.axialPos } : {}),
      ...(eb.startStation !== undefined ? { startStation: eb.startStation } : {}), // P2 curtailment
      ...(eb.endStation !== undefined ? { endStation: eb.endStation } : {}),
      ...(eb.anchorage !== undefined ? { anchorage: { end: eb.anchorage } } : {}),
      ...(eb.autoSplice ? { autoSplice: true } : {}), // H14
      ...(eb.splices !== undefined ? { splices: eb.splices } : {}), // B1
    };
  });
}

/**
 * v1.0.3 G3 ([REF-SYS-260], spec §3.2): a beam relevé — a bent-up (`RELEVE`) bottom bar near a
 * support — expanded into G2 addressable bars (one per `count`). It rides the `extraBars` channel so
 * it renders its true bent shape (G1) and is scheduled (its own RELEVE cutLength), without entering
 * the layout/As (a detailing add-on, like a supplement). Placed on the bottom-bar level `v`, spread
 * across the inner width, axially near its support.
 */
function releveExtraBars(doc: BeamDoc, phiT: number): ExtraLongBar[] {
  const releves = doc.releves ?? [];
  if (releves.length === 0) return [];
  const L = doc.geometry.L;
  const phiSpan = doc.span.diameter;
  const innerH = Math.max(40, doc.geometry.h - 2 * doc.cover - 40);
  const vBottom = -(doc.geometry.h / 2 - doc.cover - phiT - phiSpan / 2);
  const innerHalfW = Math.max(0, doc.geometry.b / 2 - doc.cover - phiT - phiSpan / 2);
  const out: ExtraLongBar[] = [];
  for (const rz of releves) {
    const bottom = L * 0.25, top = L * 0.15, incline = innerH, angle = 45;
    const run = bottom + top + incline * Math.cos((angle * Math.PI) / 180);
    const axisStart = rz.support === "left" ? 0 : Math.max(0, L - run);
    const params = { bottom, incline, top, angle };
    const n = Math.max(1, rz.count);
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0 : -innerHalfW + (2 * innerHalfW * k) / (n - 1);
      out.push({
        id: `${rz.id}_${k + 1}`,
        position: { u, v: vBottom },
        shape: loadShape("RELEVE"),
        params,
        diameter: rz.diameter,
        axisStart,
        role: "PRIMARY_LONGITUDINAL",
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// element-specific conventions → generic ElementSolveInput
// ---------------------------------------------------------------------------
function columnInput(
  doc: ColumnDoc,
  supplements: ElementSupplementInput[],
  crossTieGroups: ElementTransInput[],
  longBarsEngaged: number,
  code: BaelPack,
): ElementSolveInput {
  const phiL = doc.longitudinal.diameter;
  const phiT = doc.tie.diameter;
  const wTie = doc.geometry.b - 2 * doc.cover - phiT;
  const hTie = doc.geometry.h - 2 * doc.cover - phiT;
  const cfg = transverseConfig(doc);
  const longOverrides = buildLongOverrides(doc.longitudinal.barOverrides, { shapeId: doc.longitudinal.shapeId, diameter: phiL }, faconnageParams(doc.longitudinal.faconnage, { L: doc.geometry.H }), code);
  const extraBars = buildExtraBars(doc.extraBars, doc.geometry.H, code);
  return {
    element: "E-COL-01",
    profile: "BAEL_COLUMN",
    section: "RECT",
    geometry: { b: doc.geometry.b, h: doc.geometry.h, H: doc.geometry.H },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    layout: {
      principle: doc.longitudinal.principle,
      nTop: doc.longitudinal.nTop,
      nBottom: doc.longitudinal.nBottom,
      nLeft: doc.longitudinal.nLeft,
      nRight: doc.longitudinal.nRight,
    },
    phiT,
    phiLInset: phiL,
    longitudinal: [
      {
        zone: "As_total",
        groupId: doc.longitudinal.groupId,
        role: "PRIMARY_LONGITUDINAL",
        shape: loadShape(doc.longitudinal.shapeId),
        params: faconnageParams(doc.longitudinal.faconnage, { L: doc.geometry.H }),
        diameter: phiL,
        faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"],
        asReq: doc.longitudinal.asReq,
        tensionFace: "BOTTOM",
        ...(faconnageHooks(doc.longitudinal.faconnage) ? { hooks: faconnageHooks(doc.longitudinal.faconnage) } : {}),
        ...(doc.longitudinal.splices !== undefined ? { splices: doc.longitudinal.splices } : {}),
        ...(doc.longitudinal.autoSplice ? { autoSplice: true } : {}),
      },
    ],
    transverse: [
      {
        zone: "Asw_confinement",
        groupId: doc.tie.groupId,
        shape: loadShape(doc.tie.shapeId),
        params: { w: wTie, h: hTie },
        diameter: phiT,
        spacing: doc.tie.spacing,
        nLegs: effectiveNLegs(cfg),
        aswReqPerM: doc.tie.aswReqPerM,
        ...(cfg.regions !== undefined ? { regions: cfg.regions } : {}),
      },
      ...crossTieGroups,
    ],
    ...(longOverrides.length > 0 ? { longOverrides } : {}),
    ...(extraBars.length > 0 ? { extraBars } : {}),
    ...seismicBlock(
      doc.seismic,
      { kind: "COLUMN", length: doc.geometry.H, bMin: Math.min(doc.geometry.b, doc.geometry.h), hSectionMax: Math.max(doc.geometry.b, doc.geometry.h) },
      doc.longitudinal.nTop + doc.longitudinal.nBottom + doc.longitudinal.nLeft + doc.longitudinal.nRight,
      longBarsEngaged,
    ),
    supplements,
    code,
  };
}

function beamInput(
  doc: BeamDoc,
  supplements: ElementSupplementInput[],
  crossTieGroups: ElementTransInput[],
  longBarsEngaged: number,
  code: BaelPack,
): ElementSolveInput {
  const cfg = transverseConfig(doc);
  const phiSpan = doc.span.diameter;
  const supL = doc.supports.left, supR = doc.supports.right;
  const phiTop = supL.chapeau.enabled ? supL.chapeau.diameter : supR.chapeau.enabled ? supR.chapeau.diameter : phiSpan;
  const phiLInset = Math.max(phiSpan, phiTop, doc.topBars.enabled ? doc.topBars.diameter : 0);
  const phiT = doc.stirrup.diameter;
  const wStir = doc.geometry.b - 2 * doc.cover - phiT;
  const hStir = doc.geometry.h - 2 * doc.cover - phiT;
  // single bottom layer ⇒ d = h − (cover + φ_t + φ_ℓ/2) exactly (§6.1)
  const dApprox = doc.geometry.h - (doc.cover + phiT + phiLInset / 2);
  const longOverrides = buildLongOverrides(doc.span.barOverrides, { shapeId: doc.span.shapeId, diameter: phiSpan }, faconnageParams(doc.span.faconnage, { L: doc.geometry.L }), code);
  // G3 ([REF-SYS-260]): relevés ride the G2 addressable-bar channel (a RELEVE-shaped bottom bar that
  // bends up near its support) — rendered + scheduled, the layout/As untouched (detailing add-on).
  const extraBars = [...buildExtraBars(doc.extraBars, doc.geometry.L, code), ...releveExtraBars(doc, phiT)];

  const longitudinal: ElementSolveInput["longitudinal"] = [
    {
      zone: "As_span_bottom",
      groupId: doc.span.groupId,
      role: "PRIMARY_LONGITUDINAL",
      shape: loadShape(doc.span.shapeId),
      params: faconnageParams(doc.span.faconnage, { L: doc.geometry.L }),
      diameter: phiSpan,
      faces: ["BOTTOM"],
      asReq: doc.span.asReq,
      tensionFace: "BOTTOM",
      ...(faconnageHooks(doc.span.faconnage) ? { hooks: faconnageHooks(doc.span.faconnage) } : {}),
      ...(doc.span.splices !== undefined ? { splices: doc.span.splices } : {}),
      ...(doc.span.autoSplice ? { autoSplice: true } : {}),
    },
  ];

  // Top face physically carries (8b, D-P6-1): full-length montage bars + over-support chapeaux.
  // Each top zone declares an EXPLICIT providedCount so they never double-count on the TOP face.
  // G3 ([REF-SYS-260]): the single chapeau is now TWO independent supports V1 (left) / V2 (right),
  // each its own validated zone with its own §7.7 curtailment length (asymmetric is just data).
  // A representative cross-section sits over ONE support, so the layout's TOP face carries the montage
  // PLUS the governing (larger) single support's chapeau — NOT the sum of both (the left & right
  // chapeaux never share a section). Each support is still validated independently via its explicit
  // providedCount; the under-placed support's bars are emitted as addressable bars (buildLongBars).
  const nMontage = doc.topBars.enabled ? doc.topBars.nTop : 0;
  const nChapeauL = supL.chapeau.enabled ? supL.chapeau.nTop : 0;
  const nChapeauR = supR.chapeau.enabled ? supR.chapeau.nTop : 0;
  const nTop = Math.max(2, nMontage + Math.max(nChapeauL, nChapeauR));

  if (doc.topBars.enabled) {
    longitudinal.push({
      zone: "As_top_montage",
      groupId: doc.topBars.groupId,
      role: "PRIMARY_LONGITUDINAL",
      shape: loadShape("DROITE"),
      params: { L: doc.geometry.L },
      diameter: doc.topBars.diameter,
      faces: ["TOP"],
      asReq: 0, // montage / compression steel — no flexural As,req of its own
      tensionFace: "TOP",
      providedCount: nMontage,
    });
  }
  const pushChapeau = (sup: BeamDoc["supports"]["left"], side: "left" | "right", n: number): void => {
    const cur = computeCurtailment(code, {
      diameter: phiTop,
      material: doc.material,
      supportZone: sup.chapeau.length,
      d: dApprox,
      goodBond: false, // top bars over a support cast poor-bond (§7.7)
    });
    // B2 ([REF-SYS-260]): place each chapeau over ITS support — left starts at 0, right ends at L
    // (axisStart = L − its own length). The addressable channel honours this; the grouped fast path
    // renders it representatively (unchanged) when a beam has no relevés/overrides.
    const axisStart = side === "right" ? Math.max(0, doc.geometry.L - cur.extension) : 0;
    longitudinal.push({
      zone: `As_top_support_${side}`,
      groupId: `C_${side}`,
      role: "PRIMARY_LONGITUDINAL",
      shape: loadShape(doc.chapeauShapeId),
      params: { L: cur.extension },
      diameter: phiTop,
      faces: ["TOP"],
      asReq: sup.chapeau.asReq,
      tensionFace: "TOP",
      providedCount: n,
      axisStart,
    });
  };
  if (supL.chapeau.enabled) pushChapeau(supL, "left", nChapeauL);
  if (supR.chapeau.enabled) pushChapeau(supR, "right", nChapeauR);

  return {
    element: "E-BEM-01",
    profile: "BAEL_BEAM",
    section: "RECT",
    geometry: { b: doc.geometry.b, h: doc.geometry.h, L: doc.geometry.L },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    layout: { principle: "FREE", nTop, nBottom: doc.span.nBottom, nLeft: 2, nRight: 2 },
    phiT,
    phiLInset,
    longitudinal,
    transverse: [
      {
        zone: "Asw_shear",
        groupId: doc.stirrup.groupId,
        shape: loadShape(doc.stirrup.shapeId),
        params: { w: wStir, h: hStir },
        diameter: phiT,
        spacing: doc.stirrup.spacing,
        nLegs: effectiveNLegs(cfg),
        aswReqPerM: doc.stirrup.aswReqPerM,
        ...(cfg.regions !== undefined ? { regions: cfg.regions } : {}),
      },
      ...crossTieGroups,
    ],
    ...(longOverrides.length > 0 ? { longOverrides } : {}),
    ...(extraBars.length > 0 ? { extraBars } : {}),
    // B2 ([REF-SYS-260]): the two supports feed the per-support §7.7 anchorage check (each its own l_bd).
    supports: [
      { id: "left", anchorage: supL.anchorage, width: supL.width },
      { id: "right", anchorage: supR.anchorage, width: supR.width },
    ],
    ...seismicBlock(
      doc.seismic,
      { kind: "BEAM", length: doc.geometry.L, bMin: doc.geometry.b, hSectionMax: doc.geometry.h },
      doc.span.nBottom + nTop,
      longBarsEngaged,
    ),
    supplements,
    code,
  };
}

function buildInput(
  doc: ColumnDoc | BeamDoc,
  supplements: ElementSupplementInput[],
  crossTieGroups: ElementTransInput[],
  longBarsEngaged: number,
  code: BaelPack,
): ElementSolveInput {
  return isColumnDoc(doc)
    ? columnInput(doc, supplements, crossTieGroups, longBarsEngaged, code)
    : beamInput(doc, supplements, crossTieGroups, longBarsEngaged, code);
}

/** Total longitudinal bars (the seismic engagement denominator). */
function longBarsTotal(doc: ColumnDoc | BeamDoc): number {
  if (isColumnDoc(doc)) {
    const l = doc.longitudinal;
    return l.nTop + l.nBottom + l.nLeft + l.nRight;
  }
  const nMontage = doc.topBars.enabled ? doc.topBars.nTop : 0;
  const nChapeau =
    (doc.supports.left.chapeau.enabled ? doc.supports.left.chapeau.nTop : 0) +
    (doc.supports.right.chapeau.enabled ? doc.supports.right.chapeau.nTop : 0);
  return doc.span.nBottom + Math.max(2, nMontage + nChapeau);
}

// ---------------------------------------------------------------------------
// generic (non-rect) elements — circular / slab / joist / stair
// The editable doc (document.ts GenericDoc) is marshalled into the right section orchestrator's
// input. Shape params are computed from the geometry (UI-edge convention; the engine stays generic).
// ---------------------------------------------------------------------------
function num(geo: Record<string, number>, key: string, fallback: number): number {
  const v = geo[key];
  return typeof v === "number" ? v : fallback;
}

/** Member length (along the bars' run) for a generic element. */
function memberLength(doc: GenericDoc): number {
  const geo = doc.geometry;
  switch (doc.section) {
    case "CIRCULAR": return num(geo, "H", num(geo, "L", 3000));
    case "JOIST": return num(geo, "L", 4500);
    case "STAIR": return num(geo, "n_steps", 14) * num(geo, "g", 280);
    default: return num(geo, "Lx", 5000); // SLAB
  }
}

/** Compute the shape params for one zone of a generic element from its geometry. */
function genericShapeParams(doc: GenericDoc, z: ZoneEdit): Record<string, number> {
  const geo = doc.geometry;
  const len = memberLength(doc);
  switch (z.shapeId) {
    case "DROITE":
      // circular long bars → member length; slab distribution runs across the width.
      return { L: doc.section === "CIRCULAR" ? len : (z.slabRole === "SECONDARY" ? num(geo, "Ly", num(geo, "flight_width", num(geo, "joist_spacing", len))) : len) };
    case "CHAPEAU":
      return { L: Math.max(300, len * 0.25) };
    case "ATTENTE":
      return { foot: 300, h: Math.max(300, len * 0.05) };
    case "SPIRALE_HELICE": {
      const D = num(geo, "D", 600);
      const pitch = z.spacing ?? 100;
      const helix_diameter = Math.max(50, D - 2 * doc.cover - z.diameter);
      const turns = Math.max(1, Math.ceil(len / Math.max(1, pitch)));
      return { pitch, helix_diameter, turns, height: len };
    }
    case "TREILLIS_MESH": {
      const pitch = z.spacing ?? 150;
      const Lx = doc.section === "JOIST" ? num(geo, "L", 4500) : num(geo, "Lx", 5000);
      const Ly = doc.section === "JOIST" ? num(geo, "joist_spacing", 600) : num(geo, "Ly", 5000);
      return { pitch_x: pitch, pitch_y: pitch, Lx, Ly, overhang_x: 0, overhang_y: 0 };
    }
    case "MARCHE_PALIER":
      return { flight: num(geo, "n_steps", 14) * num(geo, "g", 280), landing: num(geo, "landing_L", 0), bend: 30 };
    default:
      return {};
  }
}

function circularInput(doc: GenericDoc, code: BaelPack): CircularSolveInput {
  const geo = doc.geometry;
  return {
    element: doc.element,
    profile: doc.profile,
    geometry: { D: num(geo, "D", 600), ...(geo["H"] !== undefined ? { H: geo["H"] } : {}), ...(geo["L"] !== undefined ? { L: geo["L"] } : {}) },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    longitudinal: doc.zones
      .filter((z) => z.kind === "longitudinal")
      .map((z) => ({
        zone: z.zone,
        groupId: z.groupId,
        role: z.role,
        shape: loadShape(z.shapeId),
        params: genericShapeParams(doc, z),
        diameter: z.diameter,
        count: z.count ?? 0,
        asReq: z.asReq ?? 0,
        ...(z.primary ? { primary: true } : {}),
      })),
    transverse: doc.zones
      .filter((z) => z.kind === "transverse")
      .map((z) => ({
        zone: z.zone,
        groupId: z.groupId,
        shape: loadShape(z.shapeId),
        params: genericShapeParams(doc, z),
        diameter: z.diameter,
        spacing: z.spacing ?? 100,
        nLegs: z.nLegs ?? 2,
        aswReqPerM: z.asReqPerM ?? 0,
        ...(z.regions !== undefined ? { regions: z.regions } : {}),
      })),
    code,
  };
}

function slabZoneV(doc: GenericDoc, z: ZoneEdit): number {
  const t = num(doc.geometry, "t", num(doc.geometry, "t_total", num(doc.geometry, "waist_t", 200)));
  const inset = t / 2 - doc.cover;
  return z.slabRole === "TOP" ? inset : -inset;
}

function slabInput(doc: GenericDoc, code: BaelPack): SlabSolveInput {
  const geo = doc.geometry;
  return {
    element: doc.element,
    profile: doc.profile,
    geometry: { Lx: num(geo, "Lx", 5000), Ly: num(geo, "Ly", 5000), t: num(geo, "t", 200) },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    zones: doc.zones.map((z) => ({
      zone: z.zone,
      groupId: z.groupId,
      role: z.role,
      slabRole: z.slabRole ?? "MAIN",
      shape: loadShape(z.shapeId),
      params: genericShapeParams(doc, z),
      diameter: z.diameter,
      spacing: z.spacing ?? 150,
      asReqPerM: z.asReqPerM ?? 0,
      v: slabZoneV(doc, z),
    })),
    ...(doc.restrainedCorner !== undefined ? { restrainedCorner: doc.restrainedCorner } : {}),
    ...(doc.cornerTorsionProvided !== undefined ? { cornerTorsionProvided: doc.cornerTorsionProvided } : {}),
    code,
  };
}

function joistInput(doc: GenericDoc, code: BaelPack): JoistSolveInput {
  const geo = doc.geometry;
  return {
    element: doc.element,
    profile: doc.profile,
    geometry: {
      L: num(geo, "L", 4500),
      t_total: num(geo, "t_total", 250),
      t_topping: num(geo, "t_topping", 50),
      b_joist: num(geo, "b_joist", 100),
      block_w: num(geo, "block_w", 500),
      block_h: num(geo, "block_h", 200),
      joist_spacing: num(geo, "joist_spacing", 600),
    },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    zones: doc.zones.map((z) => ({
      zone: z.zone,
      groupId: z.groupId,
      role: z.role,
      slabRole: z.slabRole ?? "MAIN",
      shape: loadShape(z.shapeId),
      params: genericShapeParams(doc, z),
      diameter: z.diameter,
      spacing: z.spacing ?? 600,
      asReqPerM: z.asReqPerM ?? 0,
      v: slabZoneV(doc, z),
    })),
    code,
  };
}

function stairInput(doc: GenericDoc, code: BaelPack): StairSolveInput {
  const geo = doc.geometry;
  return {
    element: doc.element,
    profile: doc.profile,
    geometry: {
      g: num(geo, "g", 280),
      r: num(geo, "r", 170),
      n_steps: num(geo, "n_steps", 14),
      waist_t: num(geo, "waist_t", 180),
      flight_width: num(geo, "flight_width", 1200),
      landing_L: num(geo, "landing_L", 1000),
    },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    ...(doc.mainBarWrapsCorner !== undefined ? { mainBarWrapsCorner: doc.mainBarWrapsCorner } : {}),
    zones: doc.zones.map((z) => ({
      zone: z.zone,
      groupId: z.groupId,
      role: z.role,
      slabRole: z.slabRole ?? "MAIN",
      shape: loadShape(z.shapeId),
      params: genericShapeParams(doc, z),
      diameter: z.diameter,
      spacing: z.spacing ?? 150,
      asReqPerM: z.asReqPerM ?? 0,
      v: slabZoneV(doc, z),
    })),
    code,
  };
}

function solveGeneric(doc: GenericDoc, code: BaelPack): SolveResult {
  switch (doc.section) {
    case "CIRCULAR": return solveCircular(circularInput(doc, code));
    case "SLAB": return solveSlab(slabInput(doc, code));
    case "JOIST": return solveJoist(joistInput(doc, code));
    case "STAIR": return solveStair(stairInput(doc, code));
  }
}

// ---------------------------------------------------------------------------
// supplement shape params (UI-edge convention — the engine stays generic)
// ---------------------------------------------------------------------------
function supplementShapeParams(
  shapeId: string,
  doc: ColumnDoc | BeamDoc,
  span: number | undefined,
): Record<string, number> {
  const memberLen = isColumnDoc(doc) ? doc.geometry.H : doc.geometry.L;
  const innerW = Math.max(40, doc.geometry.b - 2 * doc.cover - 40);
  const innerH = Math.max(40, doc.geometry.h - 2 * doc.cover - 40);
  switch (shapeId) {
    case "EPINGLE":
      return { span: span ?? innerW };
    case "DROITE":
      return { L: memberLen };
    case "CROCHET_L":
      return { a: innerH, b: 200 };
    case "RELEVE":
      return { bottom: memberLen * 0.3, incline: innerH * 1.4, top: memberLen * 0.3, angle: 45 };
    case "CADRE_RECT":
      return { w: innerW * 0.6, h: innerH * 0.6 };
    case "ETRIER":
      return { w: innerW, h: innerH };
    default:
      return {};
  }
}

function warnItem(instanceId: string, message_fr: string, message_en: string): ValidationItem {
  return {
    rule: `supplement:${instanceId}`,
    status: "WARN",
    value: null,
    limit: null,
    codeRef: "§5.5",
    message_fr,
    message_en,
    affectedGroupIds: [instanceId],
    tier: 2,
    symbol: "🟠",
  };
}

/** Resolve the doc's supplements against the base bars → engine inputs + rebind warnings (§5.5). */
function resolveDocSupplements(
  doc: ColumnDoc | BeamDoc,
  baseBars: BarPosition[],
): { inputs: ElementSupplementInput[]; warnings: ValidationItem[] } {
  const inputs: ElementSupplementInput[] = [];
  const warnings: ValidationItem[] = [];
  const baseGroupId = isColumnDoc(doc) ? doc.longitudinal.groupId : doc.span.groupId;

  for (const ed of doc.supplements) {
    const man = supplementManifest(ed.supplementId);
    const r = resolveSupplement(
      man,
      {
        supplementId: ed.supplementId,
        instanceId: ed.instanceId,
        group: ed.group,
        barIndices: ed.barIndices,
        params: { diameter: ed.diameter, ...(ed.params ?? {}) },
      },
      baseBars,
      baseGroupId,
    );
    if (r.status === "WARN") {
      warnings.push(warnItem(ed.instanceId, r.message_fr ?? "", r.message_en ?? ""));
      continue; // don't render a broken supplement
    }
    // B3 fanout: one engine input per resolved placement — a SIDE_FACES skin group is many bars
    // (`count_per_side` × both faces); a point-placed add-on is one. Each carries its own anchor so it
    // renders in its true (u,v) + orientation, and (skin/diamant) feeds A2's steel accounting.
    const shape = loadShape(man.shape);
    const shapeParams = supplementShapeParams(man.shape, doc, r.params.span);
    const anchors =
      r.anchors ?? (r.position !== undefined ? [{ u: r.position.u, v: r.position.v, angleDeg: r.angleDeg ?? 0 }] : [undefined]);
    anchors.forEach((anchor, k) => {
      inputs.push({
        groupId: k === 0 ? ed.instanceId : `${ed.instanceId}#${k}`,
        role: man.role,
        shape,
        params: shapeParams,
        diameter: r.diameter,
        count: 1,
        ...(anchor !== undefined ? { anchor } : {}),
      });
    });
  }
  return { inputs, warnings };
}

export function solveDoc(doc: ElementDoc, code: BaelPack = packFor(doc.codePack)): SolveResult {
  if (isGenericDoc(doc)) return solveGeneric(doc, code);
  const cfg = transverseConfig(doc);
  // pass 1: base layout (no supplements, no anchored cross-ties) → stable bar positions to bind to.
  // With no cross-ties the only laterally-engaged bars are the 4 section corners (held by the cadre).
  const pass1 = solveElement(buildInput(doc, [], [], 4, code));
  const hasWork = doc.supplements.length > 0 || cfg.crossTies.length > 0;
  if (!hasWork) return pass1;
  // pass 2: fold in the resolved supplements + anchored cross-ties + the real engaged-bar count.
  const { inputs, warnings } =
    doc.supplements.length > 0
      ? resolveDocSupplements(doc, pass1.bars)
      : { inputs: [] as ElementSupplementInput[], warnings: [] as ValidationItem[] };
  const crossTieGroups = resolveCrossTies(cfg, pass1.bars);
  const engaged = engagedCount(pass1.bars, cfg.crossTies, longBarsTotal(doc));
  const pass2 = solveElement(buildInput(doc, inputs, crossTieGroups, engaged, code));
  return { ...pass2, validation: [...pass2.validation, ...warnings] };
}

export type { SolveResult };
