/**
 * v1.0.5 M6 (Track O / Part V, `[OWNER-DEP §O-1]`) — BAEL / French façonnage schedule.
 *
 * The bar-bending schedule and the shop drawing speak the French façonnage convention: each internal
 * shape *archetype id* (the stable data key) is rendered under its French *façonnage designation*
 * (code + label) from `faconnageCodes.ts`. Only the rendered label changes — `shapeArchetypeId` stays
 * the merge key / data key everywhere. This proves:
 *   1. every scheduled line carries the designation from the owner (provisional) code table;
 *   2. an unknown shape falls back to its raw id (forward-compat, never throws);
 *   3. the NEW placed-bar steel — bundle / row / curtailed bar — schedules with the correct count + cut
 *      AND a faithful façonnage designation;
 *   4. PDF + DXF (the shop-drawing bending table) agree with the on-screen BBS by construction.
 *
 * ⚠ The designations are PROVISIONAL until the owner supplies the NF/BAEL nomenclature table (§O-1).
 */
import { describe, it, expect } from "vitest";
import {
  solveElement,
  type SolveResult,
  type Bundle,
  type BarRow,
  type SingleBar,
} from "@rebarconfig/core";
import {
  computeBBS,
  shopDrawing,
  faconnageFor,
  faconnageCoverage,
  FACONNAGE_PROVISIONAL,
} from "@rebarconfig/exporters";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { referenceBeam } from "./bbs-helpers";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");

/** A column with an optional placed bar (bundle / row / single) as `input.placed`. */
function column(placed?: (Bundle | BarRow | SingleBar)[]): SolveResult {
  return solveElement({
    element: "E-COL-01", profile: "BAEL_COLUMN", section: "RECT",
    geometry: { b: 400, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 }, cover: 30, exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT: 8, phiLInset: 20,
    longitudinal: [{ zone: "As_total", groupId: "L1", role: "PRIMARY_LONGITUDINAL", shape: droite, params: { L: 3000 }, diameter: 20, faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"], asReq: 1800, tensionFace: "BOTTOM" }],
    transverse: [{ zone: "Asw", groupId: "T1", shape: cadre, params: { w: 314, h: 524 }, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 }],
    ...(placed ? { placed } : {}),
    code,
  });
}

describe("M6 Track O — the schedule speaks French façonnage (code table)", () => {
  const bbs = computeBBS(referenceBeam());

  it("every scheduled line carries a façonnage designation for its shape archetype", () => {
    for (const l of bbs.lines) {
      expect(l.faconnage).toEqual(faconnageFor(l.shapeArchetypeId));
      expect(l.faconnage.archetypeId).toBe(l.shapeArchetypeId); // the data key is preserved
      expect(l.faconnage.provisional).toBe(true); // ⚠ PROVISIONAL until §O-1
    }
  });

  it("renders the owner (provisional) French designations, not the raw ids", () => {
    const byShape = new Map(bbs.lines.map((l) => [l.shapeArchetypeId, l.faconnage.label]));
    expect(byShape.get("ETRIER")).toBe("Étrier");
    expect(byShape.get("CHAPEAU")).toBe("Chapeau");
    expect(byShape.get("DROITE")).toBe("Droite");
    // the rendered label differs from the internal id (the whole point of Track O)
    expect(bbs.lines.every((l) => l.faconnage.label !== l.shapeArchetypeId || l.faconnage.code !== l.shapeArchetypeId)).toBe(true);
  });

  it("covers every shipped shape archetype + falls back for an unknown id (forward-compat)", () => {
    // the provisional table covers the 16 shipped shape manifests
    expect(faconnageCoverage()).toContain("DROITE");
    expect(faconnageCoverage()).toContain("SPIRALE_HELICE");
    expect(faconnageCoverage().length).toBeGreaterThanOrEqual(16);
    // an unknown/future shape id → the raw id (never throws), still flagged provisional
    const unknown = faconnageFor("FUTURE_SHAPE_X");
    expect(unknown.label).toBe("FUTURE_SHAPE_X");
    expect(unknown.code).toBe("FUTURE_SHAPE_X");
    expect(FACONNAGE_PROVISIONAL).toBe(true);
  });
});

describe("M6 Track O — the new placed-bar steel schedules faithfully (count + cut + façonnage)", () => {
  it("a bundle schedules the real count (one mark) with a façonnage designation", () => {
    const triple: Bundle = { kind: "bundle", id: "BND", position: { u: 100, v: -260 }, n: 3, shape: droite, params: { L: 3000 }, diameter: 25 };
    const bbs = computeBBS(column([triple]));
    const line = bbs.lines.find((l) => l.groupIds.some((g) => g.startsWith("BND")));
    expect(line).toBeDefined();
    expect(line!.count).toBe(3); // the real bar count, one merged mark
    expect(line!.cutLength_mm).toBeCloseTo(3000, 3);
    expect(line!.faconnage.label).toBe("Droite");
  });

  it("a counted row schedules N bars (one mark) with the correct cut + façonnage", () => {
    const row: BarRow = { kind: "row", id: "ROW", anchor: { u: -150, v: -260 }, direction: "u", extent: 300, count: 4, shape: droite, params: { L: 3000 }, diameter: 32 };
    const bbs = computeBBS(column([row]));
    const line = bbs.lines.find((l) => l.diameter === 32);
    expect(line).toBeDefined();
    expect(line!.count).toBe(4);
    expect(line!.cutLength_mm).toBeCloseTo(3000, 3);
    expect(line!.faconnage.label).toBe("Droite");
  });

  it("a curtailed bar schedules a shorter cut than its uncut twin, same façonnage", () => {
    const full: SingleBar = { kind: "single", id: "S1", position: { u: 120, v: -260 }, shape: droite, params: { L: 3000 }, diameter: 28 };
    const cut: SingleBar = { ...full, id: "S1", startStation: 500, endStation: 2500 };
    const fullCut = computeBBS(column([full])).lines.find((l) => l.diameter === 28)!;
    const curtailed = computeBBS(column([cut])).lines.find((l) => l.diameter === 28)!;
    expect(curtailed.cutLength_mm).toBeLessThan(fullCut.cutLength_mm);
    expect(curtailed.cutLength_mm).toBeCloseTo(2000, 3); // 2500 − 500
    expect(curtailed.faconnage.label).toBe("Droite");
  });
});

describe("M6 Track O — PDF + DXF agree with the on-screen BBS", () => {
  it("the shop-drawing bending table carries the SAME façonnage designation as the BBS line per mark", () => {
    const result = referenceBeam();
    const bbs = computeBBS(result);
    const shop = shopDrawing(result);
    const bbsByMark = new Map(bbs.lines.map((l) => [l.mark, l.faconnage]));
    expect(shop.bendingTable.length).toBe(bbs.lines.length);
    for (const row of shop.bendingTable) {
      expect(row.faconnage).toEqual(bbsByMark.get(row.mark)); // PDF/DXF table == on-screen schedule
      expect(row.faconnage.archetypeId).toBe(row.shapeArchetypeId);
    }
  });
});
