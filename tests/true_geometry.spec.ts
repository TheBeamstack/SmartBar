/**
 * G1 — true bar geometry rendering (spec §1, [REF-SYS-960]; plan P1). `placeBars` now orients each
 * longitudinal bar's REAL bent `centerline3D` onto the member frame at its `(u,v)`:
 *   - a straight DROITE bar is byte-identical to the old straight 2-point line `[u,0,v, u,L,v]`;
 *   - a cranked/relevé bar bends into the section DEPTH plane (its return varies world Z = the
 *     section `v` direction), so façonnage finally renders in 3D / coupe / PDF / DXF.
 */
import { describe, it, expect } from "vitest";
import {
  solveElement,
  placeBars,
  type ElementSolveInput,
  type ShapeArchetype,
  type SolveResult,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const H = 3000;

/** A reference tied column whose longitudinal group carries the given shape + params. */
function column(shape: ShapeArchetype, params: Record<string, number>): SolveResult {
  const b = 400, h = 400, cover = 30, phiT = 8, diameter = 20;
  const input: ElementSolveInput = {
    element: "E-COL-01",
    profile: "BAEL_COLUMN",
    section: "RECT",
    geometry: { b, h, H },
    material: { f_c28: 25, f_e: 500 },
    cover,
    exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT,
    phiLInset: diameter,
    longitudinal: [
      { zone: "As_total", groupId: "L1", shape, params, diameter, faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"], asReq: 1000, tensionFace: "BOTTOM" },
    ],
    transverse: [
      { zone: "Asw", groupId: "T1", shape: loadShape("cadre_rect"), params: { w: b - 2 * cover - phiT, h: h - 2 * cover - phiT }, diameter: phiT, spacing: 200, nLegs: 2, aswReqPerM: 0 },
    ],
    code,
  };
  return solveElement(input);
}

const longBars = (r: SolveResult) => placeBars(r).filter((p) => p.groupId === "L1");

describe("straight bars are byte-identical to the old straight line", () => {
  const bars = longBars(column(loadShape("droite"), { L: H }));

  it("places every DROITE bar as a 2-point run [u,0,v → u,H,v]", () => {
    expect(bars.length).toBe(6); // 3T/3B/2L/2R with shared corners (corner-sharing layout)
    for (const bar of bars) {
      const p = bar.points;
      expect(p).toHaveLength(6);
      expect(p[0]).toBe(p[3]); // constant u
      expect(p[1]).toBe(0); // run starts at axis 0
      expect(p[4]).toBe(H); // …ends at the member length
      expect(p[2]).toBe(p[5]); // constant depth v (no bend)
    }
  });
});

describe("a cranked (baïonnette) bar bends into the section depth plane", () => {
  // a lateral crank: lower run → crank offset → upper run (offset in local v = world Z).
  const bars = longBars(column(loadShape("baionnette"), { lower: 1200, crank: 300, upper: 1200, angle: 11 }));

  it("emits a multi-vertex polyline (not a straight 2-point line)", () => {
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) expect(bar.points.length).toBeGreaterThan(6);
  });

  it("the bend varies world Z (the section v / depth direction), and u stays constant", () => {
    const bar = bars[0]!;
    const xs: number[] = [], zs: number[] = [];
    for (let i = 0; i + 2 < bar.points.length; i += 3) {
      xs.push(bar.points[i]!);
      zs.push(bar.points[i + 2]!);
    }
    // u (world X) is constant for a longitudinal bar; the crank lives in the depth plane (Z)
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1e-9);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(50); // a real ~300·sin(11°)+ offset
  });

  it("the run still advances monotonically along the member axis +Y", () => {
    const bar = bars[0]!;
    let prev = -Infinity;
    for (let i = 1; i + 2 < bar.points.length; i += 3) {
      const y = bar.points[i]!;
      expect(y).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = y;
    }
  });

  it("is deterministic", () => {
    const a = JSON.stringify(longBars(column(loadShape("baionnette"), { lower: 1200, crank: 300, upper: 1200, angle: 11 })));
    const b = JSON.stringify(longBars(column(loadShape("baionnette"), { lower: 1200, crank: 300, upper: 1200, angle: 11 })));
    expect(a).toBe(b);
  });
});
