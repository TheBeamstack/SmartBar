/**
 * G1 — stair main bars follow the waist + landing profile (spec §1.2, [REF-SYS-960]; plan P1).
 * The MARCHE_PALIER bend lives in `group.shape.centerline3D`; with G1's longitudinal mapping the
 * flight runs along the member axis (+Y) and the landing bend rises into the section depth (±Z), so
 * the cage finally reads as a stair (pairs with G8's stepped concrete).
 */
import { describe, it, expect } from "vitest";
import { solveStair, placeBars, type SolveResult } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const N = 14, G = 280, LANDING = 1000;
const FLIGHT = N * G; // 3920 mm = the member axis length

function stair(): SolveResult {
  return solveStair({
    element: "E-STR-01",
    profile: "STAIR",
    geometry: { g: G, r: 170, n_steps: N, waist_t: 180, flight_width: 1200, landing_L: LANDING },
    material: { f_c28: 25, f_e: 500 },
    cover: 25,
    exposure: "INTERIOR",
    zones: [
      { zone: "As_main", groupId: "SM", slabRole: "MAIN", shape: loadShape("marche_palier"), params: { flight: FLIGHT, landing: LANDING, bend: 30 }, diameter: 12, spacing: 150, asReqPerM: 450 },
    ],
    code,
  });
}

describe("stair main bar bends at the waist↔landing kink", () => {
  const mains = placeBars(stair()).filter((p) => p.groupId === "SM");

  it("places one bent main bar per distribution line across the flight width", () => {
    expect(mains.length).toBeGreaterThan(1);
    for (const bar of mains) expect(bar.points.length).toBeGreaterThan(6); // multi-vertex (bent)
  });

  it("the flight runs along the axis, then the landing bends up into the section depth", () => {
    const bar = mains[0]!;
    const Y: number[] = [], Z: number[] = [];
    for (let i = 0; i + 2 < bar.points.length; i += 3) {
      Y.push(bar.points[i + 1]!); // world Y = member axis
      Z.push(bar.points[i + 2]!); // world Z = section depth
    }
    // the flight section spans 0..FLIGHT; the landing pushes the run BEYOND the flight along +Y
    expect(Math.min(...Y)).toBeCloseTo(0, 2);
    expect(Math.max(...Y)).toBeGreaterThan(FLIGHT); // landing extends axially past the flight
    // the bend rises into depth (≈ sin30°·landing = 500 mm of Z swing)
    expect(Math.max(...Z) - Math.min(...Z)).toBeGreaterThan(100);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(placeBars(stair()))).toBe(JSON.stringify(placeBars(stair())));
  });
});
