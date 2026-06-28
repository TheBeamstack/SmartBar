/**
 * F7 ([REF-UI-555]) — face-relative bar labels. The picker labels each longitudinal bar `T1/B2/L1…`
 * by face + in-face rank; labels must be deterministic, 1-based, complete, and ordered along the face.
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "./solveDoc";
import { defaultColumnDoc } from "./document";
import { barLabel, labeledBars } from "./barLabels";

describe("face-relative bar labels", () => {
  const bars = solveDoc(defaultColumnDoc()).bars; // 6Ø20: 3 top / 3 bottom / 2 left / 2 right (corners shared)

  it("labels every bar with a face prefix + a 1-based in-face rank", () => {
    const labeled = labeledBars(bars);
    expect(labeled.length).toBe(bars.length);
    for (const b of labeled) expect(b.label).toMatch(/^[TBLRC]\d+$/);
  });

  it("ranks TOP bars left→right by u (T1 is the leftmost top bar)", () => {
    const tops = labeledBars(bars).filter((b) => b.faceTag === "TOP").sort((a, b) => a.u - b.u);
    expect(tops[0]!.label).toBe("T1");
    for (let i = 1; i < tops.length; i++) expect(tops[i]!.u).toBeGreaterThanOrEqual(tops[i - 1]!.u);
  });

  it("is stable: the same bar keeps its label across calls", () => {
    expect(labeledBars(bars).map((b) => b.label)).toEqual(labeledBars(bars).map((b) => b.label));
    expect(barLabel(0, bars)).toBe(barLabel(0, bars));
  });

  it("an out-of-range index degrades to #idx (a deleted reference is still nameable)", () => {
    expect(barLabel(999, bars)).toBe("#999");
  });
});
