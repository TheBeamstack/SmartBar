/**
 * ViewCube pure camera-state module (spec v1.0.1 Feature A §1.8, [REF-SYS-810]). This is the
 * headless-testable core of the ViewCube: it maps
 *   - a clicked cube face / edge / corner → a named **view direction** (26 named views), and
 *   - an element family → its **default orientation** (the member-group rotation that makes a column
 *     stand upright and a beam lie horizontal — reusing the SAME `memberAttitude` map the elevation
 *     fiche uses, §1.4 / [REF-SYS-925]).
 *
 * No three/DOM here (it is unit-tested headlessly, like `rebarProps`/`sectionAt`). The R3F widget
 * (`ViewCube.tsx`) consumes this module and is the only GPU-dependent part.
 */
import { memberAttitude, type MemberAttitude } from "@rebarconfig/exporters";

export type Vec3 = [number, number, number];

/** A named camera view: a unit direction FROM the orbit target TOWARD the camera, + bilingual label. */
export interface NamedView {
  id: string;
  label_fr: string;
  label_en: string;
  /** unit direction from the target to the camera position. */
  dir: Vec3;
  /** 1 = orthographic face, 2 = edge, 3 = isometric corner. */
  kind: 1 | 2 | 3;
}

/** Per-axis face naming + labels (world: +X right, +Y up, +Z front). */
const AXES: ReadonlyArray<{ k: keyof typeof SIGN; sign: 1 | -1; face: string; fr: string; en: string }> = [
  { k: "y", sign: 1, face: "TOP", fr: "Haut", en: "Top" },
  { k: "y", sign: -1, face: "BOTTOM", fr: "Bas", en: "Bottom" },
  { k: "z", sign: 1, face: "FRONT", fr: "Avant", en: "Front" },
  { k: "z", sign: -1, face: "BACK", fr: "Arrière", en: "Back" },
  { k: "x", sign: 1, face: "RIGHT", fr: "Droite", en: "Right" },
  { k: "x", sign: -1, face: "LEFT", fr: "Gauche", en: "Left" },
];
const SIGN = { x: 0, y: 0, z: 0 };

function normalize([x, y, z]: Vec3): Vec3 {
  const m = Math.hypot(x, y, z) || 1;
  return [x / m, y / m, z / m];
}

/**
 * The 26 named view directions = every combination of axis signs in {−1,0,1}³ except the origin
 * (6 orthographic faces + 12 edges + 8 isometric corners). Built deterministically so the cube,
 * the a11y list, and the tests all agree.
 */
function buildNamedViews(): NamedView[] {
  const views: NamedView[] = [];
  for (const sy of [1, 0, -1]) {
    for (const sz of [1, 0, -1]) {
      for (const sx of [1, 0, -1]) {
        const nonzero = [sx, sy, sz].filter((s) => s !== 0).length;
        if (nonzero === 0) continue;
        const parts: { face: string; fr: string; en: string }[] = [];
        if (sy !== 0) parts.push(AXES.find((a) => a.k === "y" && a.sign === sy)!);
        if (sz !== 0) parts.push(AXES.find((a) => a.k === "z" && a.sign === sz)!);
        if (sx !== 0) parts.push(AXES.find((a) => a.k === "x" && a.sign === sx)!);
        views.push({
          id: parts.map((p) => p.face).join("_"),
          label_fr: parts.map((p) => p.fr).join("-"),
          label_en: parts.map((p) => p.en).join("-"),
          dir: normalize([sx, sy, sz]),
          kind: nonzero as 1 | 2 | 3,
        });
      }
    }
  }
  return views;
}

export const NAMED_VIEWS: readonly NamedView[] = buildNamedViews();

const VIEW_BY_ID = new Map(NAMED_VIEWS.map((v) => [v.id, v]));

/** Look up a named view by id (e.g. "FRONT", "TOP_FRONT_RIGHT"); undefined if unknown. */
export function viewById(id: string): NamedView | undefined {
  return VIEW_BY_ID.get(id);
}

/** The default 3/4 isometric: front-right-top (spec §1.4 proposed default). */
export const DEFAULT_VIEW_ID = "TOP_FRONT_RIGHT";

/** Default camera direction for any element — the front-right-top iso (element-awareness is the
 * model rotation, below, not the camera direction). */
export function defaultViewDir(): Vec3 {
  return viewById(DEFAULT_VIEW_ID)!.dir;
}

/**
 * Member-group rotation (Euler XYZ radians) that gives the element its drawing attitude — the 3D
 * twin of the elevation fiche's orientation (§1.4). The engine lays every member axis along world
 * +Y; this rotates the group so a VERTICAL member stays upright while a HORIZONTAL/FLAT member lies
 * down along the screen-x axis. Fixes the v1.0 placeholder that drew the beam "standing up" (D-P3-6).
 */
export function memberGroupRotation(attitude: MemberAttitude): Vec3 {
  // VERTICAL: member axis +Y stays up (identity). HORIZONTAL/FLAT: rotate −90° about Z so +Y → +X.
  return attitude === "VERTICAL" ? [0, 0, 0] : [0, 0, -Math.PI / 2];
}

/** Convenience: the member-group rotation for an element id (via the shared attitude map). */
export function memberGroupRotationFor(element: string): Vec3 {
  return memberGroupRotation(memberAttitude(element));
}

// ---------------------------------------------------------------------------
// F1 — in-plane view roll ([REF-SYS-811], spec §1). The pure, headless-testable core: given the
// view direction (camera↔target axis) and a roll angle, return the camera up-vector. The R3F frame
// loop (Viewport `RollController`) post-multiplies this onto `camera.up` after OrbitControls — orbit
// (X/Y) + zoom are untouched; roll is the missing rotation about the view axis (Z). Session-only.
// ---------------------------------------------------------------------------
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * The camera up-vector for an in-plane roll. `viewDir` is the axis between the camera and the orbit
 * target (either sense works — the roll axis is the same line); `rollRad` is the roll angle. With
 * `rollRad = 0` it returns the **level** up (world-up projected perpendicular to the view axis), so
 * the view is upright; a non-zero angle rotates that level up about the view axis (Rodrigues). When
 * the view axis is near-vertical (looking straight up/down) world-Z seeds the level up instead.
 */
export function rollUpVector(viewDir: Vec3, rollRad: number): Vec3 {
  const f = normalize(viewDir);
  const worldUp: Vec3 = [0, 1, 0];
  // level up = world up with its along-axis component removed (Gram–Schmidt)
  let up: Vec3 = [worldUp[0] - f[0] * dot(worldUp, f), worldUp[1] - f[1] * dot(worldUp, f), worldUp[2] - f[2] * dot(worldUp, f)];
  if (Math.hypot(up[0], up[1], up[2]) < 1e-6) {
    const altZ: Vec3 = [0, 0, 1];
    up = [altZ[0] - f[0] * dot(altZ, f), altZ[1] - f[1] * dot(altZ, f), altZ[2] - f[2] * dot(altZ, f)];
  }
  up = normalize(up);
  // Rodrigues: rotate `up` about the unit view axis `f` by rollRad
  const c = Math.cos(rollRad);
  const s = Math.sin(rollRad);
  const kxv = cross(f, up);
  const kdv = dot(f, up); // ≈0 (up ⟂ f) — kept for correctness
  return normalize([
    up[0] * c + kxv[0] * s + f[0] * kdv * (1 - c),
    up[1] * c + kxv[1] * s + f[1] * kdv * (1 - c),
    up[2] * c + kxv[2] * s + f[2] * kdv * (1 - c),
  ]);
}
