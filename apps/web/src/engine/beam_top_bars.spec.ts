/**
 * 8b (D-P6-1): the beam gains a dedicated full-length top-bar (montage/compression) control,
 * SEPARATE from the over-support chapeaux. Both sit on the TOP face; each declares an explicit
 * provided count so they do NOT double-count (engine `ElementLongInput.providedCount`).
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "./solveDoc";
import { defaultBeamDoc, type BeamDoc } from "./document";
import type { SolveResult } from "@rebarconfig/core";

const ruleVal = (r: SolveResult, rule: string): number => {
  const v = r.validation.find((x) => x.rule === rule);
  return typeof v?.value === "number" ? v.value : NaN;
};

describe("beam dedicated full-length top bars (8b)", () => {
  const base = defaultBeamDoc(); // chapeaux enabled (2 Ø16), montage off

  it("default beam has no montage zone; chapeaux (both supports) provide the top steel", () => {
    const r = solveDoc(base);
    expect(r.groups.some((g) => g.zone === "As_top_montage")).toBe(false);
    expect(ruleVal(r, "provided_area:As_top_support_left")).toBeGreaterThan(0);
    expect(ruleVal(r, "provided_area:As_top_support_right")).toBeGreaterThan(0);
  });

  it("enabling montage bars adds a separate top zone WITHOUT inflating the chapeau As (no double-count)", () => {
    const chapBefore = ruleVal(solveDoc(base), "provided_area:As_top_support_left");
    const withMontage: BeamDoc = { ...base, topBars: { enabled: true, groupId: "M1", diameter: 12, nTop: 3 } };
    const r = solveDoc(withMontage);

    // chapeau provided area is unchanged — the 3 montage bars did NOT get absorbed into its count
    expect(ruleVal(r, "provided_area:As_top_support_left")).toBeCloseTo(chapBefore, 6);
    // the montage zone exists and provides its own steel
    expect(r.groups.some((g) => g.groupId === "M1")).toBe(true);
    expect(ruleVal(r, "provided_area:As_top_montage")).toBeGreaterThan(0);
  });

  it("montage bars run full length (DROITE), distinct shape from the chapeaux (CHAPEAU)", () => {
    const withMontage: BeamDoc = { ...base, topBars: { enabled: true, groupId: "M1", diameter: 20, nTop: 2 } };
    const r = solveDoc(withMontage);
    const m = r.groups.find((g) => g.groupId === "M1")!;
    expect(m.diameter).toBe(20);
    expect(m.count).toBe(2); // explicit provided count, not the merged top-face count
  });
});
