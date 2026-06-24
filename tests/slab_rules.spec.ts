/**
 * Slab topological predicates (spec §7.4, §7.13, plan P4a):
 *   - one-way: slab_distribution_min — As_dist < 0.20·As_main → 🔴 FAIL.
 *   - two-way: twoway_corner_torsion_missing — restrained corner + empty zone → 🟠 WARN.
 * Pack-agnostic (BAEL pack here; EC2 swaps the constants only).
 */
import { describe, it, expect } from "vitest";
import { solveSlab } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const mesh = loadShape("treillis_mesh");

function oneWay(distDiameter: number, distSpacing: number) {
  return solveSlab({
    element: "E-SLB-01",
    profile: "SLAB_ONEWAY",
    geometry: { Lx: 5000, Ly: 3000, t: 200 },
    material: { f_c28: 25, f_e: 500 },
    cover: 25,
    exposure: "INTERIOR",
    zones: [
      { zone: "As_main_bottom", groupId: "M", slabRole: "MAIN", shape: droite, params: { L: 5000 }, diameter: 12, spacing: 150, asReqPerM: 700 },
      { zone: "As_dist", groupId: "D", slabRole: "SECONDARY", shape: droite, params: { L: 3000 }, diameter: distDiameter, spacing: distSpacing, asReqPerM: 50 },
    ],
    code,
  });
}

function twoWay(restrained: boolean, cornerTorsionProvided: number) {
  return solveSlab({
    element: "E-SLB-02",
    profile: "SLAB_TWOWAY",
    geometry: { Lx: 5000, Ly: 5000, t: 200 },
    material: { f_c28: 25, f_e: 500 },
    cover: 25,
    exposure: "INTERIOR",
    zones: [
      { zone: "As_main_x_bot", groupId: "MX", slabRole: "MAIN", shape: mesh, params: { pitch_x: 150, pitch_y: 150, Lx: 5000, Ly: 5000 }, diameter: 10, spacing: 150, asReqPerM: 400 },
      { zone: "As_main_y_bot", groupId: "MY", slabRole: "MAIN", shape: mesh, params: { pitch_x: 150, pitch_y: 150, Lx: 5000, Ly: 5000 }, diameter: 10, spacing: 150, asReqPerM: 400 },
    ],
    restrainedCorner: restrained,
    cornerTorsionProvided,
    code,
  });
}

describe("one-way slab — distribution-steel minimum (§7.13)", () => {
  it("As_dist < 0.20·As_main → 🔴 FAIL", () => {
    const r = oneWay(6, 400); // ~70.7 mm²/m vs 0.2·753.98 = 150.8
    const d = r.validation.find((v) => v.rule === "slab_distribution_min")!;
    expect(d.status).toBe("FAIL");
    expect(d.tier).toBe(1);
    expect(d.symbol).toBe("🔴");
  });

  it("As_dist ≥ 0.20·As_main → PASS", () => {
    const r = oneWay(8, 250); // ~201 mm²/m ≥ 150.8
    const d = r.validation.find((v) => v.rule === "slab_distribution_min")!;
    expect(d.status).toBe("PASS");
  });
});

describe("two-way slab — corner-torsion predicate (§7.13)", () => {
  it("restrained discontinuous corner + empty torsion zone → 🟠 WARN", () => {
    const c = twoWay(true, 0).validation.find((v) => v.rule === "twoway_corner_torsion_missing")!;
    expect(c.status).toBe("WARN");
    expect(c.tier).toBe(2);
    expect(c.symbol).toBe("🟠");
  });

  it("corner-torsion steel present → PASS", () => {
    const c = twoWay(true, 300).validation.find((v) => v.rule === "twoway_corner_torsion_missing")!;
    expect(c.status).toBe("PASS");
  });

  it("corner not restrained → torsion steel not required (PASS)", () => {
    const c = twoWay(false, 0).validation.find((v) => v.rule === "twoway_corner_torsion_missing")!;
    expect(c.status).toBe("PASS");
  });
});
