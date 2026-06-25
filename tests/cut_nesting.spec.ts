/**
 * Stock-length cut-nesting (spec §9.1, optional). Nesting the reference beam's cut list against
 * 12 m stock yields the expected bar counts + waste %. First-Fit-Decreasing, per Ø.
 */
import { describe, it, expect } from "vitest";
import { computeBBS, nestCuts } from "@rebarconfig/exporters";
import { referenceBeam } from "./bbs-helpers";

describe("cut_nesting (§9.1)", () => {
  const bbs = computeBBS(referenceBeam());

  it("nests against the default 12 m stock with the golden waste", () => {
    const nest = nestCuts(bbs); // default 12000 mm
    expect(nest.stockLength_mm).toBe(12000);

    const d8 = nest.byDiameter.find((d) => d.diameter === 8)!;
    expect(d8.bars).toBe(5); // 30 × 1554.77 mm ≈ 46.6 m / 12 m → 5 stock bars
    expect(d8.wastePct).toBeCloseTo(22.2613, 3);

    const d16 = nest.byDiameter.find((d) => d.diameter === 16)!;
    expect(d16.bars).toBe(1); // 2 × 1.95 m fit in one stock bar

    const d20 = nest.byDiameter.find((d) => d.diameter === 20)!;
    expect(d20.bars).toBe(2); // 3 × 6 m → 2 stock bars (2 per bar)
    expect(d20.wastePct).toBeCloseTo(25, 6);

    expect(nest.wastePct).toBeCloseTo(28.6098, 3);
  });

  it("conserves total length and is deterministic", () => {
    const nest = nestCuts(bbs);
    const placed = bbs.lines.reduce((s, l) => s + l.count * l.cutLength_mm, 0);
    expect(nest.totalUsed_mm).toBeCloseTo(placed, 6); // every cut is nested exactly once
    expect(nest.totalStock_mm).toBe(nest.byDiameter.reduce((s, d) => s + d.stockUsed_mm, 0));
    expect(JSON.stringify(nestCuts(bbs))).toBe(JSON.stringify(nestCuts(bbs)));
  });
});
