/**
 * Bar-bending (façonnage) table (spec §7.2 point 6 [REF-SYS-930], v1.0.3 G7, plan P7). One row per
 * DISTINCT scheduled shape — mark · shape sketch (fiche legs/bends/hooks) · Ø · cut length · count
 * per element · total = count × element quantity — the standard-BBS table on the shop drawing.
 */
import { describe, it, expect } from "vitest";
import { shopDrawing, computeBBS } from "@rebarconfig/exporters";
import { referenceBeam } from "./bbs-helpers";

describe("bending_table — one row per distinct shape (§7.2.6)", () => {
  const result = referenceBeam();

  it("has one row per distinct scheduled bar (same set as the BBS lines)", () => {
    const shop = shopDrawing(result);
    const bbs = computeBBS(result);
    expect(shop.bendingTable.length).toBe(bbs.lines.length);
    expect(shop.bendingTable.map((r) => r.mark)).toEqual(bbs.lines.map((l) => l.mark));
    // each row carries the fiche sketch (legs) for the shape thumbnail
    for (const row of shop.bendingTable) expect(row.fiche.legs.length).toBeGreaterThan(0);
  });

  it("carries the count per element from the schedule", () => {
    const shop = shopDrawing(result);
    const bbs = computeBBS(result);
    const byMark = new Map(bbs.lines.map((l) => [l.mark, l]));
    for (const row of shop.bendingTable) {
      const line = byMark.get(row.mark)!;
      expect(row.countPerElement).toBe(line.count);
      expect(row.cutLength_mm).toBe(line.cutLength_mm);
      expect(row.diameter).toBe(line.diameter);
    }
  });

  it("scales the total by the element fabrication quantity (count × quantity)", () => {
    const q = 4;
    const shop1 = shopDrawing(result, { quantity: 1 });
    const shopQ = shopDrawing(result, { quantity: q });
    for (let i = 0; i < shop1.bendingTable.length; i++) {
      const r1 = shop1.bendingTable[i]!, rq = shopQ.bendingTable[i]!;
      expect(r1.totalCount).toBe(r1.countPerElement); // quantity defaults to 1
      expect(rq.totalCount).toBe(rq.countPerElement * q);
    }
  });

  it("defaults quantity to 1 when omitted", () => {
    const shop = shopDrawing(result);
    for (const row of shop.bendingTable) expect(row.totalCount).toBe(row.countPerElement);
  });
});
