/**
 * Steel unit-mass (spec §9.1) — `unitMass(φ) = 0.006165·φ²` kg/m, and reproducible totals.
 */
import { describe, it, expect } from "vitest";
import { unitMass, computeBBS } from "@rebarconfig/exporters";
import { referenceBeam } from "./bbs-helpers";

describe("unitMass (§9.1)", () => {
  it("matches the standard kg/m values per Ø", () => {
    expect(unitMass(20)).toBeCloseTo(2.466, 3); // the plan's worked value
    expect(unitMass(8)).toBeCloseTo(0.395, 3);
    expect(unitMass(16)).toBeCloseTo(1.578, 3);
    expect(unitMass(12)).toBeCloseTo(0.888, 3);
    expect(unitMass(25)).toBeCloseTo(3.853, 3);
  });

  it("a BBS line weight is count × cutLength × unitMass (reproducible)", () => {
    const bbs = computeBBS(referenceBeam());
    for (const l of bbs.lines) {
      expect(l.unitMass_kg_m).toBeCloseTo(unitMass(l.diameter), 9);
      expect(l.weight_kg).toBeCloseTo((l.count * l.cutLength_mm * unitMass(l.diameter)) / 1000, 6);
    }
    // total weight = Σ line weights
    const sum = bbs.lines.reduce((s, l) => s + l.weight_kg, 0);
    expect(bbs.summary.totalWeight_kg).toBeCloseTo(sum, 9);
  });
});
