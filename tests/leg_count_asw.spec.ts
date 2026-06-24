/**
 * Leg-counted provided transverse area (spec §7.5, normative). A 2-leg CADRE_RECT vs a
 * 4-leg arrangement (+cross-tie) doubles Asw/s at the same spacing.
 */
import { describe, it, expect } from "vitest";
import { aswProvidedPerMetre, barArea, solveColumn } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

describe("leg-counted Asw/m", () => {
  it("4 legs provide exactly 2× the 2-leg Asw/s at fixed spacing", () => {
    const two = aswProvidedPerMetre(2, 8, 200);
    const four = aswProvidedPerMetre(4, 8, 200);
    expect(four / two).toBeCloseTo(2, 9);
    // sanity: Asw/m = nLegs·(πφ²/4)·1000/s
    expect(two).toBeCloseTo((2 * barArea(8) * 1000) / 200, 6);
  });

  it("the column solver consumes nLegs from the resolved arrangement", () => {
    const code = makeBaelPack();
    const mk = (nLegs: number) =>
      solveColumn({
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
        tie: { groupId: "T1", shape: loadShape("cadre_rect"), diameter: 8, spacing: 200, nLegs, aswReqPerM: 600 },
        code,
      });
    const asw2 = mk(2).validation.find((v) => v.rule === "asw_leg_count")!;
    const asw4 = mk(4).validation.find((v) => v.rule === "asw_leg_count")!;
    // reported values are rounded to 2 dp for display; ratio is 2 within that resolution
    expect(Number(asw4.value) / Number(asw2.value)).toBeCloseTo(2, 3);
  });
});
