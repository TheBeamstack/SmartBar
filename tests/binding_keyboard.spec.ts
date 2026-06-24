/**
 * Accessibility — keyboard/index binding parity (spec §8). Picking two base bars by 3D click
 * and picking them by index in a list must produce the identical supplement, so the feature is
 * fully operable without a pointer. `nearestBarIndex` is the shared pure backbone of both paths.
 */
import { describe, it, expect } from "vitest";
import {
  solveColumn,
  resolveSupplement,
  nearestBarIndex,
  type BarPosition,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape, loadSupplement } from "./p3-helpers";

const code = makeBaelPack();
const sup = loadSupplement("SUPP_EPINGLE_CROSSTIE");

function columnBars(): BarPosition[] {
  return solveColumn({
    element: "E-COL-01",
    geometry: { b: 300, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    longitudinal: {
      groupId: "L1",
      shape: loadShape("droite"),
      diameter: 20,
      layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
      asReq: 1800,
    },
    tie: { groupId: "T1", shape: loadShape("cadre_rect"), diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    code,
  }).bars;
}

describe("keyboard/click binding parity (§8 a11y)", () => {
  it("a click (raycast → nearest bar) maps to the same index a user would type", () => {
    const bars = columnBars();
    // simulate a 3D click landing near bar 4 (a small jitter off its true position)
    const target = 4;
    const p = bars[target]!.position;
    const clicked = nearestBarIndex(bars, { u: p.u + 1.3, v: p.v - 0.8 });
    expect(clicked).toBe(target);
  });

  it("index-list binding produces a byte-identical supplement to click binding", () => {
    const bars = columnBars();
    const i = 0;
    const j = 2;
    // click path: two raycast points near bars i and j → indices via nearestBarIndex
    const clickIdx = [
      nearestBarIndex(bars, { u: bars[i]!.position.u + 0.5, v: bars[i]!.position.v + 0.5 }),
      nearestBarIndex(bars, { u: bars[j]!.position.u - 0.5, v: bars[j]!.position.v - 0.5 }),
    ];
    const keyboardIdx = [i, j]; // typed directly in the index list

    const rClick = resolveSupplement(
      sup,
      { supplementId: sup.id, instanceId: "e1", group: "L1", barIndices: clickIdx },
      bars,
      "L1",
    );
    const rKeyboard = resolveSupplement(
      sup,
      { supplementId: sup.id, instanceId: "e1", group: "L1", barIndices: keyboardIdx },
      bars,
      "L1",
    );
    expect(clickIdx).toEqual(keyboardIdx);
    expect(rClick).toEqual(rKeyboard);
    expect(rClick.status).toBe("PASS");
  });
});
