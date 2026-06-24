/**
 * Column entry point (spec §6) — now a thin, convention-applying shim over the generic
 * `solveElement` (element.ts). It marshals the column's element-specific conventions
 * (longitudinal bars run the height H; the closed tie centreline insets cover+φ_t/2 from each
 * face; tension face = BOTTOM for strong-axis flexure) into the generic zone model and
 * dispatches through the `BAEL_COLUMN` profile. No validation/geometry math lives here.
 *
 * Keeping this shim preserves the P1/P2 public surface (`solveColumn`, `SolveResult`,
 * `SolvedGroup`) while proving the engine is one generic machine (D-P1-4).
 */
import type { ShapeArchetype } from "../types/shape";
import type { RectLayout } from "../types/placement";
import type { MaterialContext } from "../types/codepack";
import type { SeismicOverlay, LapExtent } from "../types/seismic";
import type { ExtendedCodePack } from "../validation/index";
import { solveElement, type SolveResult } from "./element";

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
    /** tie hook angle (90/135/180); seismic overlay FAILs 90° (§7.10c). Default 135. */
    hookAngle?: number;
    /** tie hook extension as a multiple of φ; seismic requires ≥10φ. Default 10. */
    hookExtFactor?: number;
  };
  /** pre-resolved confinement add-ons present (catalog ids satisfy seismic requirements). */
  confinementPresent?: string[];
  /** optional RPS seismic overlay (§7.10) — see ColumnSeismicInput. */
  seismic?: ColumnSeismicInput;
  code: ExtendedCodePack;
}

/** Column-level seismic-overlay inputs (the overlay + the member's arrangement facts, §7.10). */
export interface ColumnSeismicInput {
  overlay: SeismicOverlay;
  /** total longitudinal bars / number laterally engaged by a tie corner or cross-tie (§7.13). */
  longBarsTotal: number;
  longBarsEngaged: number;
  /** lap / splice extents along the column height (lap_in_critical_zone, §7.13). */
  laps?: LapExtent[];
}

/** Solve a rectangular tied column (E-COL-01, BAEL profile). */
export function solveColumn(input: ColumnSolveInput): SolveResult {
  const { geometry, code } = input;
  const phiL = input.longitudinal.diameter;
  const phiT = input.tie.diameter;
  // closed tie wraps the bars: centreline at cover + φ_t/2 from each face (§6.1)
  const wTie = geometry.b - 2 * input.cover - phiT;
  const hTie = geometry.h - 2 * input.cover - phiT;

  return solveElement({
    element: input.element,
    profile: "BAEL_COLUMN",
    section: "RECT",
    geometry: { b: geometry.b, h: geometry.h, H: geometry.H },
    material: input.material,
    cover: input.cover,
    exposure: input.exposure,
    ...(input.fire !== undefined ? { fire: input.fire } : {}),
    ...(input.dg !== undefined ? { dg: input.dg } : {}),
    layout: input.longitudinal.layout,
    phiT,
    phiLInset: phiL,
    longitudinal: [
      {
        zone: "As_total",
        groupId: input.longitudinal.groupId,
        role: "PRIMARY_LONGITUDINAL",
        shape: input.longitudinal.shape,
        params: { L: geometry.H },
        diameter: phiL,
        faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"],
        asReq: input.longitudinal.asReq,
        tensionFace: "BOTTOM",
      },
    ],
    transverse: [
      {
        zone: "Asw_confinement",
        groupId: input.tie.groupId,
        shape: input.tie.shape,
        params: { w: wTie, h: hTie },
        diameter: phiT,
        spacing: input.tie.spacing,
        nLegs: input.tie.nLegs,
        aswReqPerM: input.tie.aswReqPerM,
        ...(input.tie.userMandrel !== undefined ? { userMandrel: input.tie.userMandrel } : {}),
        ...(input.tie.hookAngle !== undefined ? { hookAngle: input.tie.hookAngle } : {}),
        ...(input.tie.hookExtFactor !== undefined ? { hookExtFactor: input.tie.hookExtFactor } : {}),
      },
    ],
    ...(input.seismic
      ? {
          seismic: {
            overlay: input.seismic.overlay,
            member: {
              kind: "COLUMN" as const,
              length: geometry.H,
              bMin: Math.min(geometry.b, geometry.h),
              hSectionMax: Math.max(geometry.b, geometry.h),
            },
            phiL,
            longBarsTotal: input.seismic.longBarsTotal,
            longBarsEngaged: input.seismic.longBarsEngaged,
            ...(input.confinementPresent !== undefined ? { confinementPresent: input.confinementPresent } : {}),
            ...(input.seismic.laps !== undefined ? { laps: input.seismic.laps } : {}),
          },
        }
      : {}),
    code,
  });
}
