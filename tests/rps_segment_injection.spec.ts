/**
 * RPS seismic overlay — critical-zone segment injection (spec §7.10a, §5.1.1, plan P4b).
 *
 * Enabling RPS writes END_* (extent = l_c) + MIDDLE segments into the column's transverse
 * distribution; the user's single spacing becomes the MIDDLE value. Validation runs PER SEGMENT:
 * a mid-span (MIDDLE) spacing PASSes while a critical-zone (END_*) spacing FAILs.
 * Provisional — gate G-RPS (constants unsigned).
 */
import { describe, it, expect } from "vitest";
import { solveColumn } from "@rebarconfig/core";
import { makeBaelPack, makeRpsOverlay } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");

function seismicColumn(tieSpacing: number, ductility: "ND1" | "ND2" | "ND3" = "ND2") {
  const overlay = makeRpsOverlay({ code: "RPS-2011", zone: 2, ductility });
  return solveColumn({
    element: "E-COL-01",
    geometry: { b: 400, h: 400, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    longitudinal: {
      groupId: "L1",
      shape: droite,
      diameter: 20,
      layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
      asReq: 1800,
    },
    tie: { groupId: "T1", shape: cadre, diameter: 8, spacing: tieSpacing, nLegs: 4, aswReqPerM: 300, hookAngle: 135, hookExtFactor: 10 },
    confinementPresent: ["SUPP_EPINGLE_CROSSTIE", "SUPP_DIAMANT_TIE"],
    seismic: { overlay, longBarsTotal: 8, longBarsEngaged: 8 },
    code,
  });
}

describe("RPS critical-zone segment injection (§7.10a)", () => {
  it("writes END_BOTTOM + MIDDLE + END_TOP with END extent = l_c", () => {
    const r = seismicColumn(200);
    expect(r.seismic).toBeDefined();
    // l_c = max(h_section=400, H/6=500, 450) = 500 mm
    expect(r.seismic!.l_c).toBe(500);
    const regions = r.seismic!.segments.map((s) => s.region);
    expect(regions).toEqual(["END_BOTTOM", "MIDDLE", "END_TOP"]);
    const ends = r.seismic!.segments.filter((s) => s.critical);
    expect(ends).toHaveLength(2);
    for (const e of ends) expect(e.extent).toBe(500);
    const middle = r.seismic!.segments.find((s) => s.region === "MIDDLE")!;
    expect(middle.critical).toBe(false);
    expect(middle.extent).toBe(2000); // 3000 − 2·500
  });

  it("per-segment validation: critical zone FAILs while mid-span PASSes (s=200, ND2)", () => {
    const r = seismicColumn(200, "ND2"); // s_crit ND2 = min(8·20, 0.5·400, 150) = 150
    const crit = r.validation.find((v) => v.rule === "crit_zone_spacing:Asw_confinement:END_BOTTOM")!;
    expect(crit.status).toBe("FAIL");
    expect(crit.symbol).toBe("🔴");
    // base (mid-span) tie spacing is within the gravity max → PASS
    const base = r.validation.find((v) => v.rule === "tie_spacing")!;
    expect(base.status).toBe("PASS");
  });

  it("densified critical zone (s=100 ≤ s_crit) PASSes", () => {
    const r = seismicColumn(100, "ND2");
    const crit = r.validation.find((v) => v.rule === "crit_zone_spacing:Asw_confinement:END_BOTTOM")!;
    expect(crit.status).toBe("PASS");
  });

  it("no seismic regime → no segments injected (gravity detailing)", () => {
    const r = solveColumn({
      element: "E-COL-01",
      geometry: { b: 400, h: 400, H: 3000 },
      material: { f_c28: 25, f_e: 500 },
      cover: 30,
      exposure: "EXTERIOR",
      longitudinal: { groupId: "L1", shape: droite, diameter: 20, layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 }, asReq: 1800 },
      tie: { groupId: "T1", shape: cadre, diameter: 8, spacing: 200, nLegs: 4, aswReqPerM: 300 },
      code,
    });
    expect(r.seismic).toBeUndefined();
    expect(r.validation.some((v) => v.rule.startsWith("crit_zone_spacing"))).toBe(false);
  });
});
