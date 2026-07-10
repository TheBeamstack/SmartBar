/**
 * v1.0.5 P1 ([REF-SYS-950], Part I) — the single placement path (fixes D1 + D2).
 *
 * Before v1.0.5 the grouped render fast-path mapped EVERY top-face bar onto one longitudinal group
 * (the left chapeau), so a default two-chapeau beam drew top steel only over the LEFT support (D1),
 * and the right chapeau appeared only as a side effect of the addressable panel (D2 — two paths, two
 * different beams). v1.0.5 forces the explicit per-bar path for any element whose faces carry >1
 * longitudinal zone, so BOTH chapeaux draw at their true stations — with or without a user override.
 *
 * Guardrails (audit A2): single-zone-per-face elements (a plain column, a slab main mat) stay on the
 * grouped fast path (byte-identical), and the default beam gains NO user addressable content.
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "../apps/web/src/engine/solveDoc";
import {
  defaultBeamDoc,
  defaultColumnDoc,
  defaultGenericDoc,
  type BeamDoc,
} from "../apps/web/src/engine/document";
import { placeBars, type PlacedLongBar, type SolveResult } from "@rebarconfig/core";

const L = 6000;
const axisOf = (bars: PlacedLongBar[], groupId: string): number[] =>
  bars.filter((b) => b.groupId === groupId).map((b) => b.axisStart);
/** The along-member world-Y span [min,max] of a group's placed geometry. */
const worldYSpan = (r: SolveResult, groupId: string): [number, number] => {
  const ys = placeBars(r)
    .filter((b) => b.groupId === groupId)
    .flatMap((b) => b.points.filter((_, i) => i % 3 === 1));
  return [Math.min(...ys), Math.max(...ys)];
};

describe("P1 — default beam draws both chapeaux over both supports (D1/D2)", () => {
  it("a default beam (NO override) emits longBars with both chapeaux at their own stations", () => {
    const r = solveDoc(defaultBeamDoc());
    expect(r.longBars).toBeDefined();
    // placement path is active but there is NO user addressable content (A2 decouple)
    expect(r.hasUserAddressableContent).toBeFalsy();
    const left = axisOf(r.longBars!, "C_left");
    const right = axisOf(r.longBars!, "C_right");
    expect(left).toEqual([0, 0]); // left chapeau anchored at the left support
    expect(right.length).toBe(2);
    right.forEach((a) => expect(a).toBeGreaterThan(L / 2)); // right chapeau over the right support
  });

  it("the RIGHT chapeau reaches the right support face; the LEFT starts at the left support", () => {
    const r = solveDoc(defaultBeamDoc());
    const [, rightMax] = worldYSpan(r, "C_right");
    const [leftMin] = worldYSpan(r, "C_left");
    expect(rightMax).toBeGreaterThan(L - 300); // right chapeau ends at the right support
    expect(leftMin).toBeLessThan(300); // left chapeau starts at the left support
  });

  it("a beam WITH and WITHOUT an override render the SAME top steel (the two-path divergence is gone)", () => {
    const plain = solveDoc(defaultBeamDoc());
    const withOverride: BeamDoc = {
      ...defaultBeamDoc(),
      span: { ...defaultBeamDoc().span, barOverrides: [{ index: 0, diameter: 20 }] },
    };
    const overridden = solveDoc(withOverride);
    // the chapeaux (top steel) are placed identically on both paths
    const topStations = (r: SolveResult): number[] =>
      (r.longBars ?? [])
        .filter((b) => b.groupId === "C_left" || b.groupId === "C_right")
        .map((b) => b.axisStart)
        .sort((a, b) => a - b);
    expect(topStations(plain)).toEqual(topStations(overridden));
  });
});

describe("P1 — single-zone-per-face elements stay on the grouped fast path (byte-identical)", () => {
  it("a plain column has no longBars (no user content, single zone per face)", () => {
    const r = solveDoc(defaultColumnDoc());
    expect(r.longBars).toBeUndefined();
    expect(r.hasUserAddressableContent).toBeFalsy();
  });

  it("a one-way slab (single main mat per face) has no longBars", () => {
    const r = solveDoc(defaultGenericDoc("E-SLB-01"));
    expect(r.longBars).toBeUndefined();
  });
});
