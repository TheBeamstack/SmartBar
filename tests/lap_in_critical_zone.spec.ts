/**
 * RPS seismic overlay — laps forbidden in critical zones (spec §7.10c, §7.13, plan P4b).
 * A lap whose extent intersects an END_* (l_c) segment is 🔴 FAIL under ND2/ND3, 🟠 WARN under ND1.
 * A lap steered to mid-height (clear of l_c) PASSes. Provisional — gate G-RPS.
 */
import { describe, it, expect } from "vitest";
import { solveColumn } from "@rebarconfig/core";
import { makeBaelPack, makeRpsOverlay } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");

// l_c = max(400, 3000/6=500, 450) = 500 ⇒ critical zones [0,500] and [2500,3000].
function col(lapStart: number, lapEnd: number, ductility: "ND1" | "ND2" | "ND3") {
  const overlay = makeRpsOverlay({ code: "RPS-2011", zone: 3, ductility });
  return solveColumn({
    element: "E-COL-01",
    geometry: { b: 400, h: 400, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    longitudinal: { groupId: "L1", shape: droite, diameter: 20, layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 }, asReq: 1800 },
    tie: { groupId: "T1", shape: cadre, diameter: 8, spacing: 100, nLegs: 4, aswReqPerM: 300, hookAngle: 135, hookExtFactor: 10 },
    confinementPresent: ["SUPP_EPINGLE_CROSSTIE", "SUPP_DIAMANT_TIE"],
    seismic: { overlay, longBarsTotal: 8, longBarsEngaged: 8, laps: [{ groupId: "L1", start: lapStart, end: lapEnd }] },
    code,
  });
}

describe("lap_in_critical_zone (§7.13)", () => {
  it("lap at the base (0–700) ∩ l_c → 🔴 FAIL under ND2", () => {
    const v = col(0, 700, "ND2").validation.find((x) => x.rule === "lap_in_critical_zone")!;
    expect(v.status).toBe("FAIL");
    expect(v.symbol).toBe("🔴");
  });

  it("same lap under ND1 → 🟠 WARN (relaxed)", () => {
    const v = col(0, 700, "ND1").validation.find((x) => x.rule === "lap_in_critical_zone")!;
    expect(v.status).toBe("WARN");
    expect(v.tier).toBe(2);
  });

  it("lap steered to mid-height (1200–1800, clear of l_c) → PASS", () => {
    const v = col(1200, 1800, "ND3").validation.find((x) => x.rule === "lap_in_critical_zone")!;
    expect(v.status).toBe("PASS");
  });
});
