/**
 * Supplement rebind on broken reference (spec §5.5). When a base bar a supplement references
 * is deleted (or the host no longer satisfies `requires.min_bars`), the supplement is flagged
 * WARN and the user is prompted to rebind or remove it.
 */
import { describe, it, expect } from "vitest";
import { solveColumn, resolveSupplement, type BarPosition } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape, loadSupplement } from "./p3-helpers";

const code = makeBaelPack();
const sup = loadSupplement("SUPP_EPINGLE_CROSSTIE"); // requires min_bars 4, LINK_BAR_PAIR

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

const bind = (barIndices: number[]) => ({
  supplementId: sup.id,
  instanceId: "e1",
  group: "L1",
  barIndices,
});

describe("supplement rebind / broken-ref WARN (§5.5)", () => {
  it("flags WARN with a rebind prompt when a referenced bar no longer exists", () => {
    const bars = columnBars(); // 6 bars
    const fewer = bars.slice(0, 4); // base layout shrank — index 4/5 gone
    const r = resolveSupplement(sup, bind([1, 4]), fewer, "L1");
    expect(r.status).toBe("WARN");
    expect(r.brokenIndices).toContain(4);
    expect(r.message_en).toMatch(/rebind/i);
    expect(r.message_fr).toMatch(/re-lier|retirer/i);
  });

  it("flags WARN when the host drops below requires.min_bars", () => {
    const two = columnBars().slice(0, 2);
    const r = resolveSupplement(sup, bind([0, 1]), two, "L1");
    expect(r.status).toBe("WARN");
    expect(r.message_en).toMatch(/insufficient|remove|change/i);
  });

  it("a valid rebind to existing bars restores PASS", () => {
    const bars = columnBars();
    const r = resolveSupplement(sup, bind([0, 2]), bars, "L1");
    expect(r.status).toBe("PASS");
    expect(r.brokenIndices).toBeUndefined();
  });
});
