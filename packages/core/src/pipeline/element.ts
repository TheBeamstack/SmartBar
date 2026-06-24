/**
 * Generic element pipeline (spec §6; closes P1 decision D-P1-4).
 *
 * `solveElement` is the ONE orchestrator for every rectangular element: it assembles the
 * cross-section layout, generates each group's shape, computes per-zone effective depth, and
 * validates through the profile registry (validation/profiles.ts) chosen by the manifest's
 * `validationProfile`. There is NO `if (elementType === …)` branch here — the column and the
 * beam differ only in their manifests + registered profile (golden rule §0.1).
 *
 * `solveColumn` (solve.ts) is now a thin, convention-applying shim over this function so the
 * proven P1 column path and the new beam path share a single engine.
 *
 * Pure + deterministic; pack-agnostic.
 */
import type { ShapeArchetype } from "../types/shape";
import type { BarRole } from "../types/reinforcing-element";
import type { BarPosition, ZoneGeometry, LayoutDescriptor } from "../types/layout";
import type { RectLayout } from "../types/placement";
import type { MaterialContext, ValidationStatus } from "../types/codepack";
import { generateBarShape, type BarShapeResult } from "../geometry/segment-grammar";
import {
  solveRectLayout,
  computeZoneGeometry,
  type TensionFace,
} from "../layout/rect";
import {
  rollupStatus,
  barArea,
  type ValidationItem,
  type ExtendedCodePack,
} from "../validation/index";
import {
  getValidationProfile,
  type SolvedLongZone,
  type SolvedTransZone,
} from "../validation/profiles";

export interface SolvedGroup {
  groupId: string;
  role: BarRole;
  diameter: number;
  /** bars in the cross-section (longitudinal) or 1 representative (transverse set). */
  count: number;
  zone?: string;
  shape: BarShapeResult;
}

export interface SolveResult {
  element: string;
  bars: BarPosition[];
  zones: ZoneGeometry[];
  groups: SolvedGroup[];
  validation: ValidationItem[];
  status: ValidationStatus;
  /** true when the active pack ships provisional (unsigned) constants (G-BAEL etc.). */
  provisional: boolean;
}

/** One longitudinal group as fed to the generic pipeline (shape + section binding). */
export interface ElementLongInput {
  zone: string;
  groupId: string;
  role?: BarRole;
  shape: ShapeArchetype;
  params: Record<string, number>;
  diameter: number;
  /** faces this zone occupies — its provided area + clear-spacing are taken over these. */
  faces: TensionFace[];
  asReq: number;
  /** tension face for the computed effective depth `d` ([REF-SYS-611]). */
  tensionFace: TensionFace;
  /** fraction of this zone's bars carried past the support (§7.7 end-support anchorage). */
  continuedToSupport?: number;
}

export interface ElementTransInput {
  zone: string;
  groupId: string;
  shape: ShapeArchetype;
  params: Record<string, number>;
  diameter: number;
  spacing: number;
  nLegs: number;
  aswReqPerM: number;
  userMandrel?: number;
}

/** A pre-resolved supplemental group (already positioned by the scheme/placement resolver). */
export interface ElementSupplementInput {
  groupId: string;
  role: BarRole;
  shape: ShapeArchetype;
  params: Record<string, number>;
  diameter: number;
  count: number;
}

export interface ElementSolveInput {
  element: string;
  /** the registered validation profile id, e.g. "BAEL_COLUMN" | "BAEL_BEAM". */
  profile: string;
  section: "RECT";
  geometry: { b: number; h: number; H?: number; L?: number };
  material: MaterialContext;
  cover: number;
  exposure: string;
  fire?: string;
  dg?: number;
  /** assembled per-face longitudinal counts for the whole section. */
  layout: RectLayout;
  /** transverse ø used for the cover-to-centroid inset d'. */
  phiT: number;
  /** representative (governing/largest) longitudinal ø used for the inset d'. */
  phiLInset: number;
  longitudinal: ElementLongInput[];
  transverse: ElementTransInput[];
  supplements?: ElementSupplementInput[];
  code: ExtendedCodePack;
}

const FACES: TensionFace[] = ["TOP", "BOTTOM", "LEFT", "RIGHT"];

/** Solve any rectangular element generically (spec §6). */
export function solveElement(input: ElementSolveInput): SolveResult {
  const { geometry, code } = input;
  const dg = input.dg ?? 20;

  // --- step 1: cross-section layout (shared by all longitudinal zones) ---
  const descriptor: LayoutDescriptor = {
    section: "RECT",
    geometry: { b: geometry.b, h: geometry.h },
    cover: input.cover,
    phiT: input.phiT,
    phiL: input.phiLInset,
    rect: input.layout,
  };
  const layout = solveRectLayout(descriptor);

  // --- per longitudinal zone: provided count over its faces + computed d + shape ---
  const groups: SolvedGroup[] = [];
  const zones: ZoneGeometry[] = [];
  const solvedLong: SolvedLongZone[] = [];
  let phiLMax = 0;

  for (const lz of input.longitudinal) {
    phiLMax = Math.max(phiLMax, lz.diameter);
    const faceSet = new Set(lz.faces);
    const providedCount = layout.bars.filter((bp) =>
      faceSet.has(bp.faceTag as TensionFace),
    ).length;
    const zoneGeom = computeZoneGeometry(
      lz.zone,
      layout.bars,
      { b: geometry.b, h: geometry.h },
      lz.tensionFace,
      barArea(lz.diameter),
    );
    zones.push(zoneGeom);
    const shape = generateBarShape(lz.shape, lz.params, lz.diameter, code);
    groups.push({
      groupId: lz.groupId,
      role: lz.role ?? "PRIMARY_LONGITUDINAL",
      diameter: lz.diameter,
      count: providedCount,
      zone: lz.zone,
      shape,
    });
    solvedLong.push({
      zone: lz.zone,
      groupId: lz.groupId,
      diameter: lz.diameter,
      providedCount,
      asReq: lz.asReq,
      asProv: providedCount * barArea(lz.diameter),
      geometry: zoneGeom,
      tensionFace: lz.tensionFace,
      faces: lz.faces,
      ...(lz.continuedToSupport !== undefined ? { continuedToSupport: lz.continuedToSupport } : {}),
    });
  }

  // --- per transverse zone: representative shape (1 per set) ---
  const solvedTrans: SolvedTransZone[] = [];
  for (const tz of input.transverse) {
    const shape = generateBarShape(tz.shape, tz.params, tz.diameter, code);
    groups.push({
      groupId: tz.groupId,
      role: "TRANSVERSE",
      diameter: tz.diameter,
      count: 1,
      zone: tz.zone,
      shape,
    });
    solvedTrans.push({
      zone: tz.zone,
      groupId: tz.groupId,
      diameter: tz.diameter,
      spacing: tz.spacing,
      nLegs: tz.nLegs,
      aswReqPerM: tz.aswReqPerM,
      ...(tz.userMandrel !== undefined ? { userMandrel: tz.userMandrel } : {}),
    });
  }

  // --- supplemental groups (already positioned by the placement resolver) ---
  for (const sup of input.supplements ?? []) {
    const shape = generateBarShape(sup.shape, sup.params, sup.diameter, code);
    groups.push({
      groupId: sup.groupId,
      role: sup.role,
      diameter: sup.diameter,
      count: sup.count,
      shape,
    });
  }

  // --- validation via the profile registry (no element branching) ---
  const validate = getValidationProfile(input.profile);
  const validation = validate({
    element: input.element,
    geometry,
    cover: input.cover,
    exposure: input.exposure,
    ...(input.fire !== undefined ? { fire: input.fire } : {}),
    dg,
    material: input.material,
    layout,
    longitudinal: solvedLong,
    transverse: solvedTrans,
    phiLMax: phiLMax || input.phiLInset,
    code,
  });

  return {
    element: input.element,
    bars: layout.bars,
    zones,
    groups,
    validation,
    status: rollupStatus(validation),
    provisional: (code as { _provisional?: boolean })._provisional === true,
  };
}

export type { TensionFace };
