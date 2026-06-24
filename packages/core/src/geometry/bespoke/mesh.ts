/**
 * Bespoke generator — TREILLIS_MESH (orthogonal welded mat), spec §5.2.1g.
 *
 * A welded mesh mat is not a single bent bar, so it is the second of the two v1.0 bespoke
 * generators. Parameters: `pitch_x`/`pitch_y` (wire spacing, mm), panel extents `Lx`/`Ly` (mm),
 * and optional `overhang_x`/`overhang_y` (mm). It emits per-direction wire counts + lengths and a
 * total wire length; the rendered centerline3D is the panel outline (the mat's presence — exact
 * per-wire 3D is a viewport-polish item, like supplements D-P3-6).
 *
 * Wires running in X are spaced along Y at `pitch_y` → count = floor(Ly/pitch_y)+1, length
 * Lx+2·overhang_x; wires running in Y are spaced along X at `pitch_x`. Pure + deterministic.
 */
import type { ShapeArchetype } from "../../types/shape";
import type { CodePack } from "../../types/codepack";
import type { BarShapeResult } from "../segment-grammar";

export interface MeshResult extends BarShapeResult {
  /** wires running in the X direction (spaced along Y at pitch_y). */
  nWiresX: number;
  /** wires running in the Y direction (spaced along X at pitch_x). */
  nWiresY: number;
  /** length of one X-direction wire (mm). */
  wireLengthX: number;
  /** length of one Y-direction wire (mm). */
  wireLengthY: number;
  /** total wire length of the whole mat (mm). */
  totalLength: number;
  pitchX: number;
  pitchY: number;
}

export function generateMesh(
  archetype: ShapeArchetype,
  params: Record<string, number>,
  diameter: number,
  code: CodePack,
): MeshResult {
  const pitch_x = num(params, "pitch_x");
  const pitch_y = num(params, "pitch_y");
  const Lx = num(params, "Lx");
  const Ly = num(params, "Ly");
  const overhang_x = params["overhang_x"] ?? 0;
  const overhang_y = params["overhang_y"] ?? 0;
  if (!(pitch_x > 0 && pitch_y > 0)) throw new Error("TREILLIS_MESH: pitch_x/pitch_y must be > 0");

  const nWiresX = Math.floor(Ly / pitch_y) + 1; // along Y at pitch_y, each runs in X
  const nWiresY = Math.floor(Lx / pitch_x) + 1; // along X at pitch_x, each runs in Y
  const wireLengthX = Lx + 2 * overhang_x;
  const wireLengthY = Ly + 2 * overhang_y;
  const totalLength = nWiresX * wireLengthX + nWiresY * wireLengthY;

  // panel outline (u across Lx, v across Ly) for an indicative 3D render
  const ox = overhang_x;
  const oy = overhang_y;
  const centerline3D = [
    -ox, -oy, 0,
    Lx + ox, -oy, 0,
    Lx + ox, Ly + oy, 0,
    -ox, Ly + oy, 0,
    -ox, -oy, 0,
  ];

  return {
    archetypeId: archetype.id,
    centerline3D,
    cutLength: totalLength,
    geomLength: totalLength,
    closed: false,
    closes: true,
    mandrelDiameter: code.mandrelMin(diameter),
    fiche: {
      legs: [
        { label: "wireX", length: wireLengthX },
        { label: "wireY", length: wireLengthY },
      ],
      bends: [],
      hooks: [],
    },
    nWiresX,
    nWiresY,
    wireLengthX,
    wireLengthY,
    totalLength,
    pitchX: pitch_x,
    pitchY: pitch_y,
  };
}

function num(params: Record<string, number>, key: string): number {
  const v = params[key];
  if (v === undefined) throw new Error(`TREILLIS_MESH: missing param "${key}"`);
  return v;
}
