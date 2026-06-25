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
    groups.push({
      groupId: lz.groupId,
      role: lz.role ?? "PRIMARY_LONGITUDINAL",
      diameter: lz.diameter,
      count: lz.count,
      zone: lz.zone,
      shape: generateShape(lz.shape, lz.params, lz.diameter, code),
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
      length: geometry.H ?? geometry.L ?? geometry.D,
      D: geometry.D,
      transverse: (input.transverse ?? []).map((tz) => ({ groupId: tz.groupId, spacing: tz.spacing })),
    },
  };
}
