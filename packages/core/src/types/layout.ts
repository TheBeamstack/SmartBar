/**
 * Contract #4 — Layout-solver I/O.
 * Spec: v1.0-Spec.md §6.1 ([REF-SYS-610], [REF-SYS-611]).
 *
 * Step 1 of the pipeline turns a layout descriptor into bar centroid positions in the
 * section frame, PLUS the computed effective depth `d` / `d'` per flexural zone
 * ([REF-SYS-611]) — `d` is computed from the resolved tension-bar centroid, not the
 * 0.9h rule of thumb. M0 pins the I/O TYPES only; the solver body is P1.
 */
import type { RectLayout } from "./placement";

export type SectionKind = "RECT" | "CIRCULAR" | "SLAB";

/** Input descriptor for the layout solver. */
export interface LayoutDescriptor {
  section: SectionKind;
  /** core-rect / pitch-circle inputs in the section frame (mm). */
  geometry: Record<string, number>;
  /** nominal cover (mm). */
  cover: number;
  /** transverse (tie/stirrup) diameter (mm). */
  phiT: number;
  /** longitudinal diameter (mm). */
  phiL: number;
  /** rectangular per-face counts + principle, OR a circular total. */
  rect?: RectLayout;
  /** circular bar count on the pitch circle (EQUAL_PERIMETER). */
  circularCount?: number;
}

export type FaceTag = "TOP" | "BOTTOM" | "LEFT" | "RIGHT" | "CIRC" | string;

/** One resolved bar centroid (consumed by shape generation and placement bindings). */
export interface BarPosition {
  /** centroid in the section frame (mm). */
  position: { u: number; v: number };
  faceTag: FaceTag;
  layerIndex: number;
  isCorner: boolean;
}

/** Computed flexural geometry per zone ([REF-SYS-611]). */
export interface ZoneGeometry {
  zone: string;
  /** effective depth (mm) = D_F − ȳ_t (area-weighted tension-bar centroid). */
  d: number;
  /** cover-to-centroid inset on the compression/other face (mm). */
  dPrime: number;
  /** area-weighted tension-bar centroid in the section frame (mm). */
  tensionCentroid: { u: number; v: number };
}

export interface LayoutResult {
  bars: BarPosition[];
  zones: ZoneGeometry[];
}

/**
 * 3D placement descriptor for a solved element (spec §9.5, [REF-SYS-950]).
 *
 * Every v1.0 element is a prismatic member along the world axis `+Y` (length 0..`length`),
 * with its cross-section in the world `X–Z` plane (engine `u → X`, `v → Z`). This descriptor
 * carries exactly what the pure Section/Coupe engine (`sectionAt`) and the 3D viewport need to
 * reconstruct world-space bar geometry from a `SolveResult` — so the placement convention lives
 * in core (D-P2-3), not the UI. Slab-family sections map to a `RECT` envelope (width × thickness,
 * bars running along the span). Pure data; no DOM/three.
 */
export interface MemberPlacement {
  /** concrete cross-section shape in the section (u–v) frame. */
  envelope: "RECT" | "CIRCULAR";
  /** member length along the world axis (+Y), mm (bars run 0..length). */
  length: number;
  /** RECT width (u/X extent), mm — section is centred at the origin. */
  b?: number;
  /** RECT depth (v/Z extent), mm. */
  h?: number;
  /** CIRCULAR overall diameter (mm). */
  D?: number;
  /** transverse-set spacing per group (mm) — drives station expansion + look-behind. */
  transverse: { groupId: string; spacing: number }[];
}
