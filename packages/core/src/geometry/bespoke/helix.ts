/**
 * Bespoke generator — SPIRALE_HELICE (3D helix), spec §5.2.1g.
 *
 * The helix centerline is NOT a planar polyline, so it cannot be expressed in the segment
 * grammar — it is one of exactly two v1.0 bespoke registered generators (the other is the mesh).
 * Parameters: `pitch` (mm/turn), `helix_diameter` (centerline ø of the coil, mm), and either
 * `turns` or `height` (mm). Used by circular spiral columns and piles.
 *
 * One coil's slant length is `√((π·helix_diameter)² + pitch²)`; the wire length is
 * `turns · slantPerTurn`. The axis runs along local +v (so a PlacementRule stands it up along the
 * member). Pure + deterministic: no DOM/three, no Date.now()/Math.random().
 */
import type { ShapeArchetype } from "../../types/shape";
import type { CodePack } from "../../types/codepack";
import type { BarShapeResult } from "../segment-grammar";

export interface HelixResult extends BarShapeResult {
  /** number of full turns. */
  turns: number;
  /** pitch (mm per turn). */
  pitch: number;
  /** coil centerline radius (mm). */
  helixRadius: number;
  /** axial height covered by the coil (mm) = turns · pitch. */
  axialHeight: number;
  /** slant length of one full turn (mm). */
  slantPerTurn: number;
  /** total wire (coil) length (mm). */
  coilLength: number;
}

/** Chord sampling for the helix centerline (samples per turn). */
const SAMPLES_PER_TURN = 36;

export function generateHelix(
  archetype: ShapeArchetype,
  params: Record<string, number>,
  diameter: number,
  code: CodePack,
): HelixResult {
  const pitch = num(params, "pitch");
  const helix_diameter = num(params, "helix_diameter");
  const turns =
    params["turns"] !== undefined
      ? params["turns"]
      : params["height"] !== undefined && pitch > 0
      ? params["height"] / pitch
      : 0;
  if (!(turns > 0)) throw new Error(`SPIRALE_HELICE: needs turns>0 (or height + pitch>0)`);

  const R = helix_diameter / 2;
  const circumference = Math.PI * helix_diameter;
  const slantPerTurn = Math.hypot(circumference, pitch);
  const coilLength = turns * slantPerTurn;
  const axialHeight = turns * pitch;
  const mandrelDiameter = code.mandrelMin(diameter);

  // sample the 3D centerline: axis along +v, coil in the u–w plane
  const points: number[] = [];
  const totalSamples = Math.max(2, Math.ceil(turns * SAMPLES_PER_TURN));
  for (let i = 0; i <= totalSamples; i++) {
    const f = i / totalSamples;
    const theta = f * turns * 2 * Math.PI;
    points.push(R * Math.cos(theta), f * axialHeight, R * Math.sin(theta));
  }

  return {
    archetypeId: archetype.id,
    centerline3D: points,
    cutLength: coilLength,
    geomLength: coilLength,
    closed: false,
    closes: true,
    mandrelDiameter,
    fiche: {
      legs: [{ label: "coil", length: coilLength }],
      bends: [],
      hooks: [],
    },
    turns,
    pitch,
    helixRadius: R,
    axialHeight,
    slantPerTurn,
    coilLength,
  };
}

function num(params: Record<string, number>, key: string): number {
  const v = params[key];
  if (v === undefined) throw new Error(`SPIRALE_HELICE: missing param "${key}"`);
  return v;
}
