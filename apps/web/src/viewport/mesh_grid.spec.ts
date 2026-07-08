/**
 * v1.0.4 D2 (spec Part V D2) — the welded MESH renders as its true orthogonal wire grid (indicative→
 * faithful), not a single panel outline. Headless geometry test on the pure `meshGridBars` +
 * `buildScene`; the GPU look is the owner's acceptance pass (§D-3).
 */
import { describe, it, expect } from "vitest";
import { solveSlab, solveColumn, type SolveResult } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "../engine/manifests";
import { meshGridBars, buildScene } from "./rebarProps";

const code = makeBaelPack();
const mesh = loadShape("TREILLIS_MESH");
const droite = loadShape("DROITE");
const cadre = loadShape("CADRE_RECT");

const LX = 5000, LY = 4000, PITCH_X = 150, PITCH_Y = 200;

function twoWaySlab(): SolveResult {
  return solveSlab({
    element: "E-SLB-02",
    profile: "SLAB_TWOWAY",
    geometry: { Lx: LX, Ly: LY, t: 200 },
    material: { f_c28: 25, f_e: 500 },
    cover: 25,
    exposure: "INTERIOR",
    zones: [
      { zone: "As_main_x", groupId: "MX", slabRole: "MAIN", shape: mesh, params: { pitch_x: PITCH_X, pitch_y: PITCH_Y, Lx: LX, Ly: LY }, diameter: 10, spacing: PITCH_X, asReqPerM: 400, v: -70 },
    ],
    code,
  });
}

function column(): SolveResult {
  return solveColumn({
    element: "E-COL-01",
    geometry: { b: 300, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500, f_ck: 25, f_yk: 500 },
    cover: 30,
    exposure: "INTERIOR",
    dg: 20,
    longitudinal: { groupId: "L1", shape: droite, diameter: 20, layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 }, asReq: 1800 },
    tie: { groupId: "T1", shape: cadre, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    code,
  });
}

const yOf = (p: number[], i = 1) => p[i]!;

describe("D2 — welded mesh renders as an orthogonal wire grid", () => {
  const wires = meshGridBars(twoWaySlab());

  it("emits X-wires (across width) + Y-wires (along span) at the mat pitches", () => {
    const xWires = wires.filter((w) => w.points[0] !== w.points[3]); // varying X → runs across width
    const yWires = wires.filter((w) => w.points[1] !== w.points[4]); // varying Y → runs along span
    expect(xWires.length).toBe(Math.floor(LX / PITCH_Y) + 1); // spaced along span (Y) at pitchY
    expect(yWires.length).toBe(Math.floor(LY / PITCH_X) + 1); // spaced across width (X) at pitchX
  });

  it("X-wires span the full width at one span station + one depth", () => {
    const xw = wires.filter((w) => w.points[0] !== w.points[3]);
    for (const w of xw) {
      expect(w.points[0]).toBeCloseTo(-LY / 2, 6);
      expect(w.points[3]).toBeCloseTo(LY / 2, 6);
      expect(w.points[1]).toBeCloseTo(w.points[4]!, 6); // constant Y
      expect(w.points[2]).toBeCloseTo(-70, 6); // the mat layer depth (v)
      expect(w.points[5]).toBeCloseTo(-70, 6);
    }
  });

  it("Y-wires span the full length along the span", () => {
    const yw = wires.filter((w) => w.points[1] !== w.points[4]);
    for (const w of yw) {
      expect(yOf(w.points, 1)).toBeCloseTo(0, 6);
      expect(yOf(w.points, 4)).toBeCloseTo(LX, 6);
    }
  });

  it("is deterministic", () => {
    expect(meshGridBars(twoWaySlab())).toEqual(wires);
  });

  it("returns nothing for a non-mesh element (a column)", () => {
    expect(meshGridBars(column())).toEqual([]);
  });
});

describe("D2 — buildScene swaps the mat outline for the grid", () => {
  it("every mesh-group bar in the scene is a straight 2-point wire (no bent outline)", () => {
    const scene = buildScene(twoWaySlab(), {}, false);
    const meshBars = scene.bars.filter((b) => b.groupId === "MX");
    expect(meshBars.length).toBeGreaterThan(2);
    for (const b of meshBars) expect(b.points.length).toBe(6); // exactly two vertices → a straight wire
  });

  it("leaves a non-mesh element's bars untouched", () => {
    const scene = buildScene(column(), {}, false);
    expect(scene.bars.length).toBeGreaterThan(0);
  });
});
