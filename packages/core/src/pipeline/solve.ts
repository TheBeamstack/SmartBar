/**
 * Pipeline orchestrator (spec §6): params + reinforcement → layout → shape-gen → assembly
 * → validation → outputs. Pure function returning a plain SolveResult. Headless (no UI).
 *
 * v1.0 / P1 implements the rectangular tied column (E-COL-01) path. The orchestration is
 * generic (layout → per-group shape → validation profile); adding the beam (P3) reuses it
 * with a different validation profile and layout descriptor — NO element branching here.
 */
import type { ShapeArchetype } from "../types/shape";
import type { BarRole } from "../types/reinforcing-element";
import type { BarPosition, ZoneGeometry, LayoutDescriptor } from "../types/layout";
import type { RectLayout } from "../types/placement";
import type { MaterialContext, ValidationStatus } from "../types/codepack";
import { generateBarShape, type BarShapeResult } from "../geometry/segment-grammar";
import { solveRectLayout, computeZoneGeometry } from "../layout/rect";
import {
  validateColumn,
  rollupStatus,
  barArea,
  type ValidationItem,
  type ExtendedCodePack,
} from "../validation/index";

export interface SolvedGroup {
  groupId: string;
  role: BarRole;
  diameter: number;
  /** bars in the cross-section (longitudinal) or 1 representative (transverse set). */
  count: number;
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

export interface ColumnSolveInput {
  element: string;
  geometry: { b: number; h: number; H: number };
  material: MaterialContext;
  cover: number;
  exposure: string;
  fire?: string;
  dg?: number;
  longitudinal: {
    groupId: string;
    shape: ShapeArchetype; // DROITE
    diameter: number;
    layout: RectLayout;
    asReq: number; // mm²
  };
  tie: {
    groupId: string;
    shape: ShapeArchetype; // CADRE_RECT
    diameter: number;
    spacing: number; // mm
    /** legs crossing the confinement plane (CADRE_RECT=2; +cross-ties add legs). */
    nLegs: number;
    aswReqPerM: number; // mm²/m
    /** optional user-set tie bend mandrel ø (mm) for the §7.6 feasibility check. */
    userMandrel?: number;
  };
  code: ExtendedCodePack;
}

/** Solve a rectangular tied column (E-COL-01, BAEL profile). */
export function solveColumn(input: ColumnSolveInput): SolveResult {
  const { geometry, code } = input;
  const phiL = input.longitudinal.diameter;
  const phiT = input.tie.diameter;
  const dg = input.dg ?? 20;

  // --- step 1: layout solver (cross-section) ---
  const descriptor: LayoutDescriptor = {
    section: "RECT",
    geometry: { b: geometry.b, h: geometry.h },
    cover: input.cover,
    phiT,
    phiL,
    rect: input.longitudinal.layout,
  };
  const layout = solveRectLayout(descriptor);

  // --- computed effective depth d/d' per flexural zone ([REF-SYS-611]) ---
  // column default flexure: tension face BOTTOM (strong-axis bending)
  const zone = computeZoneGeometry(
    "As_total",
    layout.bars,
    { b: geometry.b, h: geometry.h },
    "BOTTOM",
    barArea(phiL),
  );
  const zones: ZoneGeometry[] = [zone];

  // --- step 2: shape generation per group ---
  // longitudinal straight bars run the column height H
  const longShape = generateBarShape(
    input.longitudinal.shape,
    { L: geometry.H },
    phiL,
    code,
  );
  // closed tie wraps the bars: centreline at cover + φ_t/2 from each face
  const wTie = geometry.b - 2 * input.cover - phiT;
  const hTie = geometry.h - 2 * input.cover - phiT;
  const tieShape = generateBarShape(input.tie.shape, { w: wTie, h: hTie }, phiT, code);

  const groups: SolvedGroup[] = [
    {
      groupId: input.longitudinal.groupId,
      role: "PRIMARY_LONGITUDINAL",
      diameter: phiL,
      count: layout.count,
      shape: longShape,
    },
    {
      groupId: input.tie.groupId,
      role: "TRANSVERSE",
      diameter: phiT,
      count: 1,
      shape: tieShape,
    },
  ];

  // --- step 4: validation ---
  const validation = validateColumn({
    geometry,
    cover: input.cover,
    exposure: input.exposure,
    fire: input.fire,
    dg,
    material: input.material,
    layout,
    zones,
    inputs: {
      longGroupId: input.longitudinal.groupId,
      phiL,
      phiLMax: phiL,
      asReq: input.longitudinal.asReq,
      tieGroupId: input.tie.groupId,
      phiT,
      tieSpacing: input.tie.spacing,
      nLegs: input.tie.nLegs,
      aswReqPerM: input.tie.aswReqPerM,
      ...(input.tie.userMandrel !== undefined ? { userTieMandrel: input.tie.userMandrel } : {}),
    },
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
