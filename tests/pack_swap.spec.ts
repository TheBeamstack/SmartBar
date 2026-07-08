/**
 * Pack swap = data swap (spec §7.11, plan P4a). The SAME element through the SAME pipeline +
 * profile produces DIFFERENT limits under BAEL vs EC2, with NOTHING else changing — selecting a
 * pack swaps the `code.*` implementations only. Reference column E-COL-01 (b300×h600, 6Ø20, Ø8@200).
 */
import { describe, it, expect } from "vitest";
import { solveColumn, barArea } from "@rebarconfig/core";
import { makeBaelPack, makeEc2Pack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");

function solveWith(code: ReturnType<typeof makeBaelPack> | ReturnType<typeof makeEc2Pack>) {
  return solveColumn({
    element: "E-COL-01",
    geometry: { b: 300, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500, f_ck: 25, f_yk: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    dg: 20,
    longitudinal: {
      groupId: "L1",
      shape: droite,
      diameter: 20,
      layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
      asReq: 1800,
    },
    tie: { groupId: "T1", shape: cadre, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    code,
  });
}

const bael = solveWith(makeBaelPack());
const ec2 = solveWith(makeEc2Pack());
const find = (res: typeof bael, rule: string) => res.validation.find((v) => v.rule === rule)!;

describe("pack swap — BAEL vs EC2, identical pipeline", () => {
  it("identical geometry/pipeline: same provided area + bar layout", () => {
    expect(find(bael, "provided_area").value).toBe(find(ec2, "provided_area").value);
    expect(Number(find(bael, "provided_area").value)).toBeCloseTo(6 * barArea(20), 2);
    expect(bael.bars).toHaveLength(ec2.bars.length);
  });

  it("ρ-limits differ (BAEL perimeter+5%·B vs EC2 0.2%/4%·Ac)", () => {
    expect(find(bael, "ratio_limits").limit).toBe("[720, 9000]");
    expect(find(ec2, "ratio_limits").limit).toBe("[360, 7200]");
    expect(find(bael, "ratio_limits").limit).not.toBe(find(ec2, "ratio_limits").limit);
  });

  it("cover requirement differs (BAEL EXTERIOR 30 vs EC2 EXTERIOR 25+Δ=35) → differing status at c=30", () => {
    expect(Number(find(bael, "cover").limit)).toBeCloseTo(30, 6);
    expect(Number(find(ec2, "cover").limit)).toBeCloseTo(35, 6);
    // v1.0.4: c=30 meets the BAEL minimum (30) but sits AT the bare minimum, below the §7.12
    // comfort target 30·1.1=33 → 🟠 WARN (the new comfort band); EC2 requires 35 so 30 < 35 → 🔴 FAIL.
    expect(find(bael, "cover").status).toBe("WARN");
    expect(find(ec2, "cover").status).toBe("FAIL"); // 30 < 35
  });

  it("tie-ø minimum differs (BAEL φℓ/3 vs EC2 φℓ/4)", () => {
    expect(Number(find(bael, "tie_diameter").limit)).toBeCloseTo(6.67, 2); // round(20/3)
    expect(Number(find(ec2, "tie_diameter").limit)).toBeCloseTo(6, 6); // max(6, 20/4=5)
  });

  it("codeRef cites the active pack", () => {
    expect(find(bael, "provided_area").codeRef).toContain("BAEL");
    expect(find(ec2, "provided_area").codeRef).toContain("1992");
  });
});
