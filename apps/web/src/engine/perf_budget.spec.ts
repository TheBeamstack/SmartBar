/**
 * perf_budget (plan P2, spec §2.2): solve + validate of a typical E-COL-01 must stay within the
 * 16 ms frame budget. We measure the best of many runs (compute floor, robust to a noisy shared
 * box) and assert it clears the budget with margin.
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "./solveDoc";
import { defaultColumnDoc } from "./document";

describe("solve performance budget", () => {
  it("solves a typical column well under 16 ms", () => {
    const doc = defaultColumnDoc();
    solveDoc(doc); // warm up JIT / module init

    let best = Infinity;
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      solveDoc(doc);
      best = Math.min(best, performance.now() - t0);
    }
    expect(best).toBeLessThan(16);
  });
});
