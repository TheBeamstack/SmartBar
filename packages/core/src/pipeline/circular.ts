/**
 * Circular-section element pipeline (spec §6, §6.1) — circular spiral column (E-COL-02) and
 * drilled-shaft pile (E-FND-01). Like `solveColumn`, this is a section-specific orchestrator that
 * shares the engine's seams: it builds the EQUAL_PERIMETER pitch-circle layout, generates each
 * group's shape through the shape registry (the spiral via the bespoke SPIRALE_HELICE generator),
 * and dispatches to the profile registry (`CIRCULAR_COLUMN`). No `if (elementType === …)` branch.
 *
 * Pure + deterministic; pack-agnostic (BAEL/EC2 swap behind code.*).
 */
import type { ShapeArchetype } from "../types/shape";
import type { BarRole } from "../types/reinforcing-element";
import type { ZoneGeometry, LayoutDescriptor } from "../types/layout";
import type { MaterialContext } from "../types/codepack";
import { generateShape } from "../geometry/registry";
import { solveCircularLayout } from "../layout/circular";
import { rollupStatus, barArea, type ExtendedCodePack } from "../validation/index";
import {
  getValidationProfile,
  type SolvedLongZone,
  type SolvedTransZone,
} from "../validation/profiles";
import type { PlacedBarInput } from "../types/placed-bar";
import { resolvePlacedBars, analyzePlacedBarLaps } from "../section/resolvePlacedBars";
import { spliceBar, autoSplices, type Splice, type SpliceResult } from "../geometry/splice";
import { validatePlacedBarRules } from "../validation/placedBarRules";
import type { SolveResult, SolvedGroup } from "./element";

export interface CircularLongInput {
  zone: string;
  groupId: string;
  role?: BarRole;
  shape: ShapeArchetype;
  params: Record<string, number>;
  diameter: number;
  /** bar count for this zone (pitch-circle count for the primary zone). */
  count: number;
  asReq: number; // mm²
  /** the pitch-circle longitudinal zone (gets min-bars/ratio/arc-spacing checks). */
  primary?: boolean;
  /**
   * v1.0.5 M5 (Track S, [REF-SYS-770]): manual lap/coupler splice stations along this zone's cage bars
   * (a long pile/column cage). Absent → unspliced.
   */
  splices?: Splice[];
  /** v1.0.5 M5: auto-split this zone's bars at the stock length (> 12 m cages). */
  autoSplice?: boolean;
}

export interface CircularTransInput {
  zone: string;
  groupId: string;
  shape: ShapeArchetype; // SPIRALE_HELICE (or a hoop)
  params: Record<string, number>;
  diameter: number;
  /** spiral pitch / hoop spacing (mm). */
  spacing: number;
  /** legs crossing the confinement plane (spiral/hoop = 2). */
  nLegs: number;
  aswReqPerM: number; // mm²/m
}

export interface CircularSolveInput {
  element: string;
  profile: string; // "CIRCULAR_COLUMN"
  geometry: { D: number; H?: number; L?: number };
  material: MaterialContext;
  cover: number;
  exposure: string;
  fire?: string;
  dg?: number;
  longitudinal: CircularLongInput[];
  transverse?: CircularTransInput[];
  /**
   * v1.0.5 M2 (P-B): freely placed bars — an extra pitch-circle bar or a free interior `(u,v)` bar
   * (e.g. a bundle at the centre of a large pile). Resolved by the shared placement pass + appended to
   * `SolveResult.longBars` (rendered + scheduled + shown in the coupe). Absent → none (byte-identical).
   */
  placed?: PlacedBarInput[];
  code: ExtendedCodePack;
}

const FLAT_ZONE = (zone: string): ZoneGeometry => ({
  zone,
  d: 0,
  dPrime: 0,
  tensionCentroid: { u: 0, v: 0 },
});

/** Solve a circular-section element (E-COL-02, E-FND-01). */
export function solveCircular(input: CircularSolveInput): SolveResult {
  const { geometry, code } = input;
  const dg = input.dg ?? 20;
  const primary = input.longitudinal.find((z) => z.primary) ?? input.longitudinal[0];
  const phiT = input.transverse?.[0]?.diameter ?? 0;
  const phiL = primary?.diameter ?? 0;

  const descriptor: LayoutDescriptor = {
    section: "CIRCULAR",
    geometry: { D: geometry.D },
    cover: input.cover,
    phiT,
    phiL,
    circularCount: primary?.count ?? 0,
  };
  const circular = solveCircularLayout(descriptor);

  const groups: SolvedGroup[] = [];
  const zones: ZoneGeometry[] = [];
  const solvedLong: SolvedLongZone[] = [];
  let phiLMax = 0;

  for (const lz of input.longitudinal) {
    phiLMax = Math.max(phiLMax, lz.diameter);
    const zoneGeom = FLAT_ZONE(lz.zone);
    zones.push(zoneGeom);
    const shape = generateShape(lz.shape, lz.params, lz.diameter, code);
    // v1.0.5 M5 (Track S): split a long cage's bars at their lap/coupler stations (or auto at the stock
    // length — pile cages routinely exceed 12 m). The overlap comes from `code.l0`; the segments feed the
    // schedule (BBS) and the group-level stagger WARN below. Absent → unspliced (byte-identical).
    let splice: SpliceResult | undefined;
    const splicePts: Splice[] = [
      ...(lz.splices ?? []),
      ...(lz.autoSplice ? autoSplices(shape.cutLength) : []),
    ];
    if (splicePts.length > 0) {
      splice = spliceBar(shape.cutLength, splicePts, code, {
        diameter: lz.diameter,
        material: input.material,
        fractionLapped: 1,
      });
    }
    groups.push({
      groupId: lz.groupId,
      role: lz.role ?? "PRIMARY_LONGITUDINAL",
      diameter: lz.diameter,
      count: lz.count,
      zone: lz.zone,
      shape,
      ...(splice ? { splice } : {}),
    });
    solvedLong.push({
      zone: lz.zone,
      groupId: lz.groupId,
      diameter: lz.diameter,
      providedCount: lz.count,
      asReq: lz.asReq,
      asProv: lz.count * barArea(lz.diameter),
      geometry: zoneGeom,
      tensionFace: "BOTTOM",
      faces: [],
      ...(lz.primary ? { primary: true } : {}),
    });
  }

  const solvedTrans: SolvedTransZone[] = [];
  for (const tz of input.transverse ?? []) {
    groups.push({
      groupId: tz.groupId,
      role: "TRANSVERSE",
      diameter: tz.diameter,
      count: 1,
      zone: tz.zone,
      shape: generateShape(tz.shape, tz.params, tz.diameter, code),
    });
    solvedTrans.push({
      zone: tz.zone,
      groupId: tz.groupId,
      diameter: tz.diameter,
      spacing: tz.spacing,
      nLegs: tz.nLegs,
      aswReqPerM: tz.aswReqPerM,
    });
  }

  // v1.0.5 M2 (P-B): resolve any freely placed bars through the shared pass, APPENDED to the base
  // pitch-circle mat (kept in `bars`). placeBars/computeBBS/sectionAt read `longBars` additively.
  // v1.0.6-fix R3 (F-B): resolved BEFORE the profile runs, so the placed steel can be CREDITED below —
  // it used to resolve after `validate()`, which is why an extra cage bar never moved As,prov.
  const memberLength = geometry.H ?? geometry.L ?? geometry.D;
  const longBars =
    input.placed && input.placed.length > 0
      ? resolvePlacedBars(input.placed, {
          memberLength,
          code,
          material: input.material,
          layoutBars: circular.bars,
          groups,
          section: "CIRCULAR",
          startIndex: circular.bars.length,
          // R5 (O-3c): the round section's descriptor — a `Layer` here is an inner pitch circle. Without
          // it a placed layer expanded to ZERO bars, silently (it was unreachable before R5's canvas).
          sectionD: geometry.D,
        })
      : undefined;

  // R3 (F-B): a freely placed cage bar IS steel — credit it to the zone it reinforces. A circular zone is
  // COUNT-based (not per-metre), so the credit is direct: `As += Σ barArea(Ø)` over the placed bars, and
  // the provided count rises with them. The zone is the cage's primary longitudinal one (a round section
  // has a single longitudinal family — there is no face to disambiguate, unlike RECT).
  if (longBars && longBars.length > 0 && solvedLong.length > 0) {
    const target = solvedLong.find((z) => z.primary) ?? solvedLong[0]!;
    let asAdd = 0;
    let nAdd = 0;
    for (const b of longBars) {
      if (b.removed || !b.standalone) continue; // an override bar is already counted in its group
      asAdd += barArea(b.diameter); // PHYSICAL Ø (φₙ is a rule diameter, never a steel quantity)
      nAdd += 1;
    }
    if (asAdd > 0) {
      target.asProv += asAdd;
      target.providedCount += nAdd;
    }
  }

  const validate = getValidationProfile(input.profile);
  const validation = validate({
    element: input.element,
    section: "CIRCULAR",
    geometry: { D: geometry.D, ...(geometry.H !== undefined ? { H: geometry.H } : {}), ...(geometry.L !== undefined ? { L: geometry.L } : {}) },
    cover: input.cover,
    exposure: input.exposure,
    ...(input.fire !== undefined ? { fire: input.fire } : {}),
    dg,
    material: input.material,
    circular,
    longitudinal: solvedLong,
    transverse: solvedTrans,
    phiLMax: phiLMax || phiL,
    code,
  });

  // v1.0.5 M5 (Track S, §4.2): a group-level lap lands every cage bar's splice at the same station
  // (coincident), so WARN to stagger them (WARN-only). Mirrors the RECT group-splice WARN in element.ts.
  for (const g of groups) {
    if (!g.splice || !g.splice.segments.some((s) => s.lapForward)) continue;
    validation.push({
      rule: `lap_stagger:${g.zone ?? g.groupId}`,
      status: "WARN",
      value: g.splice.lapLength,
      limit: null,
      codeRef: (code as { codeRef?: string }).codeRef ?? code.id,
      message_fr: `Recouvrements alignés (l_r=${Math.round(g.splice.lapLength)} mm) — décaler (quinconce) les barres adjacentes`,
      message_en: `Laps coincident (l_r=${Math.round(g.splice.lapLength)} mm) — stagger adjacent bars`,
      affectedGroupIds: [g.groupId],
      tier: 2,
      symbol: "🟠",
    });
  }

  // (the placed bars were resolved + credited BEFORE `validate()` above — R3/F-B.)

  // v1.0.5 M4 (Track V): honest tiers for freely placed steel in this round section — bundle count/cover
  // (φₙ radial cover), curtailment anchorage + the element-agnostic geometry (axial-extent / radial
  // section-bounds). A face `Layer`/`skin` row is not a round-section concept (skipped upstream).
  if (longBars && input.placed) {
    validation.push(
      ...validatePlacedBarRules(input.placed, longBars, {
        section: "CIRCULAR",
        b: geometry.D,
        h: geometry.D,
        circularD: geometry.D,
        cover: input.cover,
        memberLength,
        dg: input.dg ?? 20,
        codeRef: (code as { codeRef?: string }).codeRef ?? code.id,
        material: input.material,
        bands: { spacing: code.warnBands?.spacing ?? 0.05, anchorage: code.warnBands?.anchorage ?? 0.05 },
        includeGeometry: true,
      }, code),
    );
  }

  // v1.0.5 M5 (Track S): a freely placed cage bar carrying its OWN splices gets the per-bar stagger check
  // (no seismic overlay is composed on the circular pipeline, so `lap_in_critical_zone` is inherently N/A
  // here — flagged). Fires only when a placed bar actually laps → legacy byte-identical.
  if (longBars) {
    validation.push(...analyzePlacedBarLaps(longBars, code).staggerItems);
  }

  return {
    element: input.element,
    bars: circular.bars,
    zones,
    groups,
    validation,
    status: rollupStatus(validation),
    provisional: (code as { _provisional?: boolean })._provisional === true,
    member: {
      envelope: "CIRCULAR",
      length: memberLength,
      D: geometry.D,
      transverse: (input.transverse ?? []).map((tz) => ({ groupId: tz.groupId, spacing: tz.spacing })),
    },
    ...(longBars ? { longBars, hasUserAddressableContent: true } : {}),
  };
}
