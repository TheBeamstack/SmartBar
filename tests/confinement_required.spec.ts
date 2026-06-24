/**
 * RPS seismic overlay — required confinement add-ons (spec §7.10b/c, §0.1, plan P4b).
 * Under RPS the confinement cross-ties/diamond ties become REQUIRED; absent → 🔴 FAIL, which the
 * validity layer treats as export-blocking. crosstie_engagement: ND3 every bar, ND2 alternate.
 * Provisional — gate G-RPS.
 */
import { describe, it, expect } from "vitest";
import { solveColumn } from "@rebarconfig/core";
import { makeBaelPack, makeRpsOverlay } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");

function col(opts: {
  ductility: "ND1" | "ND2" | "ND3";
  confinementPresent: string[];
  engaged?: number;
}) {
  const overlay = makeRpsOverlay({ code: "RPS-2011", zone: 3, ductility: opts.ductility });
  return solveColumn({
    element: "E-COL-01",
    geometry: { b: 400, h: 400, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    longitudinal: { groupId: "L1", shape: droite, diameter: 20, layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 }, asReq: 1800 },
    tie: { groupId: "T1", shape: cadre, diameter: 8, spacing: 100, nLegs: 4, aswReqPerM: 300, hookAngle: 135, hookExtFactor: 10 },
    confinementPresent: opts.confinementPresent,
    seismic: { overlay, longBarsTotal: 8, longBarsEngaged: opts.engaged ?? 8 },
    code,
  });
}

describe("confinement_required (§7.10b/c)", () => {
  it("required confinement absent → 🔴 FAIL (export blocked) and element status FAIL", () => {
    const r = col({ ductility: "ND2", confinementPresent: [] });
    const v = r.validation.find((x) => x.rule === "confinement_required")!;
    expect(v.status).toBe("FAIL");
    expect(v.tier).toBe(1);
    expect(r.status).toBe("FAIL");
  });

  it("required confinement present → PASS", () => {
    const v = col({ ductility: "ND2", confinementPresent: ["SUPP_EPINGLE_CROSSTIE", "SUPP_DIAMANT_TIE"] }).validation.find(
      (x) => x.rule === "confinement_required",
    )!;
    expect(v.status).toBe("PASS");
  });
});

describe("crosstie_engagement (§7.13)", () => {
  it("ND3 requires every bar engaged → 🔴 FAIL when short", () => {
    const v = col({ ductility: "ND3", confinementPresent: ["SUPP_EPINGLE_CROSSTIE", "SUPP_DIAMANT_TIE"], engaged: 4 }).validation.find(
      (x) => x.rule === "crosstie_engagement",
    )!;
    expect(v.status).toBe("FAIL");
  });

  it("ND2 requires alternate bars → 🟠 WARN when short", () => {
    const v = col({ ductility: "ND2", confinementPresent: ["SUPP_EPINGLE_CROSSTIE", "SUPP_DIAMANT_TIE"], engaged: 2 }).validation.find(
      (x) => x.rule === "crosstie_engagement",
    )!;
    expect(v.status).toBe("WARN");
  });

  it("ND3 with every bar engaged → PASS", () => {
    const v = col({ ductility: "ND3", confinementPresent: ["SUPP_EPINGLE_CROSSTIE", "SUPP_DIAMANT_TIE"], engaged: 8 }).validation.find(
      (x) => x.rule === "crosstie_engagement",
    )!;
    expect(v.status).toBe("PASS");
  });
});
