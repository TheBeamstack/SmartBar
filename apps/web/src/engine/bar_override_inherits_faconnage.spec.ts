/**
 * H1 ([v1.0.4]) — a per-bar override on a *bent* longitudinal group inherits the GROUP's façonnage
 * params instead of falling back to `{L:memberLen}`. Before the fix a Ø-only (or axial/removed-only)
 * override on a BAIONNETTE group regenerated the shape with its legs missing and threw
 * `Undefined symbol lower` (prep_results P0.2). An axial-only / removed-only edit now skips regen
 * entirely (reuses the group's already-generated shape), and a Ø/length edit regenerates with the
 * group's legs present.
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "./solveDoc";
import { defaultColumnDoc } from "./document";

const bentColumn = () => {
  const doc = defaultColumnDoc();
  doc.longitudinal.shapeId = "BAIONNETTE";
  doc.longitudinal.faconnage = { shapeParams: { lower: 2000, crank: 200, upper: 800, angle: 11 } };
  return doc;
};

describe("H1 — override inherits the group's façonnage", () => {
  it("a Ø-only override on a bent group does not throw and takes the new Ø", () => {
    const doc = bentColumn();
    doc.longitudinal.barOverrides = [{ index: 0, diameter: 25 }];
    expect(() => solveDoc(doc)).not.toThrow();
    const bars = solveDoc(doc).longBars!;
    const b0 = bars.find((b) => b.barIndex === 0)!;
    const sibling = bars.find((b) => b.barIndex === 1)!;
    expect(b0.diameter).toBe(25);
    // it kept the GROUP's shape (same archetype as its untouched siblings), not a DROITE/{L} fallback
    expect(b0.shape.archetypeId).toBe(sibling.shape.archetypeId);
    // bent, not a straight {L:memberLen} run (the crash path would have produced neither — it threw)
    expect(b0.shape.cutLength).toBeGreaterThan(2900);
  });

  it("an axial-only override on a bent group skips regen and keeps the group shape", () => {
    const doc = bentColumn();
    doc.longitudinal.barOverrides = [{ index: 0, axialPos: 150 }];
    expect(() => solveDoc(doc)).not.toThrow();
    const bars = solveDoc(doc).longBars!;
    const b0 = bars.find((b) => b.barIndex === 0)!;
    const sibling = bars.find((b) => b.barIndex === 1)!;
    expect(b0.axisStart).toBe(150);
    expect(b0.shape.archetypeId).toBe(sibling.shape.archetypeId);
    expect(b0.shape.cutLength).toBeCloseTo(sibling.shape.cutLength, 6); // identical geometry, no regen drift
  });

  it("a removed-only override on a bent group does not throw", () => {
    const doc = bentColumn();
    doc.longitudinal.barOverrides = [{ index: 0, removed: true }];
    expect(() => solveDoc(doc)).not.toThrow();
    expect(solveDoc(doc).longBars!.find((b) => b.barIndex === 0)!.removed).toBe(true);
  });
});
