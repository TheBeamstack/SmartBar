/**
 * Section / Coupe engine — public types (spec §9.5, [REF-SYS-950]).
 *
 * A *coupe* is a user-placed cross-section drawing. The engine is a pure function of
 * `(SolveResult, SectionCut) → CoupeView`; the SAME `CoupeView` feeds the live 3D preview, the
 * DXF section view, and the PDF view box (written once). All geometry is in core — no DOM/three.
 *
 * Frames. World axes: `X = u`, `Y = member axis (0..length)`, `Z = v` (see `MemberPlacement`).
 * A cut is a plane (`origin` + `normal`) in world mm. `CoupeView` primitives live in the plane's
 * own 2D frame `(s, t)` (mm): `s` along the plane's first in-plane basis `e1`, `t` along `e2`.
 */

/** A 3D point / vector in world millimetres. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A 2D point in the cut plane's own frame (mm). */
export interface Pt2 {
  s: number;
  t: number;
}

/**
 * Cut descriptor — persisted in `.rcfg` (spec §9.5 / §10). `origin` + `normal` define the cutting
 * plane (free position and direction). Index signature keeps unknown cut fields on round-trip
 * (forward-compat, §10).
 */
export interface SectionCut {
  id: string;
  label_fr?: string;
  /** plane origin in world mm. */
  origin: Vec3;
  /** plane normal in world mm (need not be unit; normalised internally). */
  normal: Vec3;
  /** depth-of-field shown behind the plane (mm); omitted → convention default. */
  lookBehind_mm?: number;
  /** the seeded representative coupe (exactly one per element by default). */
  isDefault?: boolean;
  /** forward-compat: unknown cut fields are preserved on `.rcfg` round-trip (§10). */
  [k: string]: unknown;
}

/** Concrete outline polygon where the plane meets the envelope (layer COFFRAGE). */
export interface CoupeConcrete {
  /** convex polygon, ordered CCW in the plane frame (mm). */
  outline: Pt2[];
}

/** A bar the plane crosses, drawn as a nominal circle of its Ø (layer ARMATURES). */
export interface CoupeBarCircle {
  groupId: string;
  diameter: number;
  center: Pt2;
}

/** A bar nearly parallel to the plane, drawn as a run/line (reads like an elevation). */
export interface CoupeBarLine {
  groupId: string;
  diameter: number;
  a: Pt2;
  b: Pt2;
}

/** Group annotation `n Ø d` (layer TEXTE). */
export interface CoupeAnnotation {
  groupId: string;
  count: number;
  diameter: number;
  /** anchor near the group's circle centroid (mm). */
  at: Pt2;
}

/** A dimension line (layer COTATION) — templated placement (§9.2 collision solver applies later). */
export interface CoupeDimension {
  kind: "WIDTH" | "HEIGHT" | "DIAMETER" | "COVER";
  from: Pt2;
  to: Pt2;
  value: number;
  label: string;
}

/** The cutting-line + tag drawn on the longitudinal elevation, keyed to this coupe (§9.5.5). */
export interface ElevationCut {
  /** tag letter, e.g. "A". */
  tag: string;
  /** full label, e.g. "Coupe A-A". */
  label: string;
  /** station along the member axis (+Y, mm) where the cut crosses the elevation. */
  axisStation: number;
  /** viewing-arrow direction in the elevation (axis, lateral) — unit. */
  arrow: { axis: number; lateral: number };
}

/** The reproducible plane frame used (origin + orthonormal basis), for the DXF/PDF transform. */
export interface CoupeFrame {
  origin: Vec3;
  /** unit normal (viewing-arrow direction). */
  normal: Vec3;
  /** in-plane basis vectors (unit, orthogonal): `s` along e1, `t` along e2. */
  e1: Vec3;
  e2: Vec3;
}

/** The pure output of `sectionAt` — drives 3D preview + DXF + PDF (spec §9.5). */
export interface CoupeView {
  cutId: string;
  label: string;
  isDefault: boolean;
  concrete: CoupeConcrete;
  circles: CoupeBarCircle[];
  lines: CoupeBarLine[];
  annotations: CoupeAnnotation[];
  dimensions: CoupeDimension[];
  elevation: ElevationCut;
  frame: CoupeFrame;
  /** the look-behind depth actually used (mm). */
  lookBehind_mm: number;
}

/** One placed bar in world space (mm) — a polyline `[x,y,z, …]` + its group metadata. */
export interface PlacedBar {
  groupId: string;
  diameter: number;
  /** "PRIMARY_LONGITUDINAL" | "TRANSVERSE" | supplements — drives elevation vs section reading. */
  role: string;
  /** world polyline, flat `[x,y,z, …]` (mm). */
  points: number[];
  closed: boolean;
  /** index into `SolveResult.bars` for a longitudinal bar (v1.0.2 F7 picker ↔ 3D sync); omitted for loops. */
  barIndex?: number;
}
