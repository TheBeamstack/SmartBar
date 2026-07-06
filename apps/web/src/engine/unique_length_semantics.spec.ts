/**
 * H2 ([v1.0.4], owner A-1/A-2) — a per-bar unique `length` sets the FABRICATED cut length on EVERY
 * open shape (not just DROITE). The adapter inverts the linear `totalLengthExpr` onto the shape's
 * `totalLengthParam` (principal leg), so `cutLength == length` exactly — with or without hooks, and
 * regardless of the fixed legs. Pre-H2 a `length` was a silent no-op on any bent shape.
 */
import { describe, it, expect } from "vitest";
import { solveDoc, defaultParams } from "./solveDoc";
import { defaultColumnDoc } from "./document";
import { loadShape } from "./manifests";

const OPEN_SHAPES = ["DROITE", "CROCHET_L", "U_BAR", "BAIONNETTE", "RELEVE", "ATTENTE", "Z_BAR", "DOUBLE_CRANK", "STEPPED"];
const TARGET = 1800; // feasible for every shape's default fixed part (principal leg stays > 0)

const bentColumn = (shapeId: string) => {
  const doc = defaultColumnDoc();
  doc.longitudinal.shapeId = shapeId;
  doc.longitudinal.faconnage = { shapeParams: defaultParams(loadShape(shapeId), doc.geometry.H) };
  return doc;
};

describe("H2 — unique length drives the fabricated cut length", () => {
  it.each(OPEN_SHAPES)("%s: a length override makes cutLength == length (±0.01)", (id) => {
    const doc = bentColumn(id);
    doc.longitudinal.barOverrides = [{ index: 0, length: TARGET }];
    const bars = solveDoc(doc).longBars!;
    const b0 = bars.find((b) => b.barIndex === 0)!;
    expect(Math.abs(b0.shape.cutLength - TARGET)).toBeLessThan(0.01);
  });

  it("is per-bar: an untouched sibling keeps the group's default cut length", () => {
    const doc = bentColumn("BAIONNETTE"); // default cutLength ≈ 2950 ≠ 1800
    doc.longitudinal.barOverrides = [{ index: 0, length: TARGET }];
    const bars = solveDoc(doc).longBars!;
    const b0 = bars.find((b) => b.barIndex === 0)!;
    const sibling = bars.find((b) => b.barIndex === 1)!;
    expect(Math.abs(b0.shape.cutLength - TARGET)).toBeLessThan(0.01);
    expect(sibling.shape.cutLength).toBeGreaterThan(2000); // group default, unaffected by the override
  });

  it("absorbs the hook allowance: cutLength == length even with an end hook", () => {
    const doc = bentColumn("BAIONNETTE");
    doc.longitudinal.barOverrides = [
      { index: 0, length: TARGET, faconnage: { hooks: { start: "none", end: 90 } } },
    ];
    const bars = solveDoc(doc).longBars!;
    const b0 = bars.find((b) => b.barIndex === 0)!;
    expect(Math.abs(b0.shape.cutLength - TARGET)).toBeLessThan(0.01);
  });

  it("an independent extra bar also honours its unique length", () => {
    const doc = defaultColumnDoc();
    doc.extraBars = [{ id: "X1", u: 50, v: -100, shapeId: "U_BAR", diameter: 12, length: TARGET }];
    const x = solveDoc(doc).longBars!.find((b) => b.standalone)!;
    expect(Math.abs(x.shape.cutLength - TARGET)).toBeLessThan(0.01);
  });
});
