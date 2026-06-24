/**
 * RPS seismic overlay — 135°/≥10φ hook geometry (spec §7.10c, plan P4b).
 * 135° with ext ≥ 10φ is mandatory on ties/cross-ties in a seismic member; a 90° hook FAILs.
 * Provisional — gate G-RPS.
 */
import { describe, it, expect } from "vitest";
import { solveColumn } from "@rebarconfig/core";
import { makeBaelPack, makeRpsOverlay } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");

function col(hookAngle: number, hookExtFactor: number) {
  const overlay = makeRpsOverlay({ code: "RPS-2011", zone: 2, ductility: "ND2" });
  return solveColumn({
    element: "E-COL-01",
    geometry: { b: 400, h: 400, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    longitudinal: { groupId: "L1", shape: droite, diameter: 20, layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 }, asReq: 1800 },
    tie: { groupId: "T1", shape: cadre, diameter: 8, spacing: 100, nLegs: 4, aswReqPerM: 300, hookAngle, hookExtFactor },
    confinementPresent: ["SUPP_EPINGLE_CROSSTIE", "SUPP_DIAMANT_TIE"],
    seismic: { overlay, longBarsTotal: 8, longBarsEngaged: 8 },
    code,
  });
}

describe("seismic hook geometry (§7.10c)", () => {
  it("135°/10φ → PASS", () => {
    const h = col(135, 10).validation.find((v) => v.rule === "seismic_hook:Asw_confinement")!;
    expect(h.status).toBe("PASS");
  });

  it("90° hook → 🔴 FAIL in a seismic member", () => {
    const h = col(90, 10).validation.find((v) => v.rule === "seismic_hook:Asw_confinement")!;
    expect(h.status).toBe("FAIL");
    expect(h.tier).toBe(1);
  });

  it("135° but ext < 10φ → FAIL", () => {
    const h = col(135, 6).validation.find((v) => v.rule === "seismic_hook:Asw_confinement")!;
    expect(h.status).toBe("FAIL");
  });
});
