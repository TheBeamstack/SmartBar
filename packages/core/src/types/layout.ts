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
  transverse: { groupId: string; spacing: number; anchor?: TransverseAnchor; regions?: TransverseRegion[] }[];
}

/**
 * One transverse region along the member axis with its own cadre/stirrup spacing (v1.0.2 F5,
 * [REF-SYS-757]). A transverse set carries an ORDERED, CONTIGUOUS list of these covering 0..length
 * (no gaps/overlaps). A single full-length region `[{from:0, to:length, spacing:s}]` is exactly the
 * pre-F5 uniform behaviour (the migration default) — `regionStations` reproduces it byte-identically.
 * Lets ends be denser than the middle without any element branching (a property of the set).
 */
export interface TransverseRegion {
  /** region start along the member axis (mm). */
  from: number;
  /** region end along the member axis (mm). */
  to: number;
  /** cadre/stirrup spacing within this region (mm). */
  spacing: number;
}

/**
 * Optional placement anchor for a transverse set (v1.0.2 F2 cross-ties, [REF-SYS-756]). When
 * present, the set's loop is placed at `(u,v)` in the section frame and rotated by `angleDeg`
 * (in the u–v plane) instead of being centred at the origin — so a cross-tie (épingle) sits ON
 * the line between the two longitudinal bars it engages. Absent → centred (the perimeter
 * cadre/stirrup behaviour, byte-identical to v1.0.1).
 */
export interface TransverseAnchor {
  /** loop centre in the section frame (mm). */
  u: number;
  v: number;
  /** rotation of the loop's local u-axis within the u–v plane (degrees). */
  angleDeg: number;
}
