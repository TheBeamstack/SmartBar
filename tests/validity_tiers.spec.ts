/**
 * Construction-logic validity layer tiers (spec §0.1, §7.12). Hard-invalid states → 🔴
 * (under-min steel, spacing < min, ratio out of range, mandrel below min); near-limit → 🟠.
 */
import { describe, it, expect } from "vitest";
import { solveColumn, tierFor } from "@rebarconfig/core";
import type { ColumnSolveInput } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();

function column(overrides: Partial<ColumnSolveInput> = {}): ColumnSolveInput {
  return {
    element: "E-COL-01",
    geometry: { b: 300, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    dg: 20,
    longitudinal: {
      groupId: "L1",
      shape: loadShape("droite"),
      diameter: 20,
      layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
      asReq: 1800,
    },
    tie: { groupId: "T1", shape: loadShape("cadre_rect"), diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    code,
    ...overrides,
  };
}

const ruleStatus = (input: ColumnSolveInput, rule: string) =>
  solveColumn(input).validation.find((v) => v.rule === rule);

describe("tier mapping", () => {
  it("FAIL→1/🔴, WARN→2/🟠, PASS→3/🟢", () => {
    expect(tierFor("FAIL")).toBe(1);
    expect(tierFor("WARN")).toBe(2);
    expect(tierFor("PASS")).toBe(3);
  });
});

describe("hard-invalid (🔴) states", () => {
  it("insufficient steel vs As,req", () => {
    const r = ruleStatus(column({ longitudinal: { ...column().longitudinal, asReq: 1e6 } }), "provided_area");
    expect(r?.status).toBe("FAIL");
    expect(r?.symbol).toBe("🔴");
  });

  it("clear spacing below the minimum (too many bars per face)", () => {
    const r = ruleStatus(
      column({ longitudinal: { ...column().longitudinal, diameter: 32, layout: { principle: "SYMMETRIC", nTop: 9, nBottom: 9, nLeft: 2, nRight: 2 } } }),
      "clear_spacing",
    );
    expect(r?.status).toBe("FAIL");
    expect(r?.tier).toBe(1);
  });

  it("steel ratio above A_max", () => {
    const r = ruleStatus(
      column({ longitudinal: { ...column().longitudinal, diameter: 40, layout: { principle: "SYMMETRIC", nTop: 9, nBottom: 9, nLeft: 9, nRight: 9 } } }),
      "ratio_limits",
    );
    expect(r?.status).toBe("FAIL");
  });

  it("mandrel below the code minimum", () => {
    const r = ruleStatus(
      column({ tie: { ...column().tie, userMandrel: 10 } }), // < max(4·8=32, φℓ=20)
      "mandrel_feasibility",
    );
    expect(r?.status).toBe("FAIL");
    expect(r?.symbol).toBe("🔴");
  });
});

describe("near-limit (🟠) states", () => {
  it("tie spacing just under the maximum warns", () => {
    // s_t,max = min(15·φℓ, 400, b_min+100) = min(300, 400, 400) = 300; 290 is within the 5% band
    const r = ruleStatus(column({ tie: { ...column().tie, spacing: 290 } }), "tie_spacing");
    expect(r?.status).toBe("WARN");
    expect(r?.symbol).toBe("🟠");
    expect(r?.tier).toBe(2);
  });
});
