/**
 * G1 — continuous-coil placement (spec §1.2, [REF-SYS-960]; plan P1). A spiral/helix is a single
 * continuous bar of `coilLength`, so `placeBars` must emit it ONCE (a member-length helix), never
 * instanced + flattened at every transverse station as the pre-v1.0.3 loop did.
 */
import { describe, it, expect } from "vitest";
import { solveCircular, placeBars, type SolveResult } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const H = 3000;

function spiralColumn(): SolveResult {
  return solveCircular({
    element: "E-COL-02",
    profile: "CIRCULAR_COLUMN",
    geometry: { D: 600, H },
    material: { f_c28: 25, f_e: 500 },
    cover: 50,
    exposure: "EXTERIOR",
    longitudinal: [
      { zone: "As_total", groupId: "L1", shape: loadShape("droite"), params: { L: H }, diameter: 20, count: 8, asReq: 1500, primary: true },
    ],
    transverse: [
      { zone: "Asw_spiral", groupId: "SP1", shape: loadShape("spirale_helice"), params: { pitch: 60, helix_diameter: 500, turns: 50 }, diameter: 8, spacing: 60, nLegs: 2, aswReqPerM: 0 },
    ],
    code,
  });
}

describe("spiral coil is placed once, spanning the member", () => {
  const placed = placeBars(spiralColumn());
  const coils = placed.filter((p) => p.groupId === "SP1");

  it("emits exactly ONE coil bar for the spiral group (not N flattened loops)", () => {
    expect(coils).toHaveLength(1);
  });

  it("the coil is a long 3D helix polyline spanning 0..member length", () => {
    const c = coils[0]!;
    const ys: number[] = [];
    for (let i = 1; i + 1 < c.points.length; i += 3) ys.push(c.points[i]!);
    // ~36 samples per turn × 50 turns ⇒ a dense polyline (far more than a 4-point flat loop)
    expect(ys.length).toBeGreaterThan(100);
    expect(Math.min(...ys)).toBeCloseTo(0, 3);
    expect(Math.max(...ys)).toBeCloseTo(H, 3); // axialHeight = turns·pitch = 50·60 = 3000
  });

  it("the coil sweeps a circle in the section X–Z plane (radius ≈ helix_diameter/2)", () => {
    const c = coils[0]!;
    const radii: number[] = [];
    for (let i = 0; i + 2 < c.points.length; i += 3) radii.push(Math.hypot(c.points[i]!, c.points[i + 2]!));
    expect(Math.min(...radii)).toBeCloseTo(250, 0);
    expect(Math.max(...radii)).toBeCloseTo(250, 0);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(placeBars(spiralColumn()))).toBe(JSON.stringify(placeBars(spiralColumn())));
  });
});
