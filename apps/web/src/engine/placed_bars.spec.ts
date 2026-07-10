/**
 * v1.0.5 M2 (P-B) — the adapter threads a generic element's freely placed bars (`GenericDoc.placed`)
 * into the engine's shared placement pass (`solveSlab/…({ placed })`), so a free bar on any of the six
 * non-rect elements flows to the 3D/coupe placement + the schedule + round-trips through `.rcfg`.
 * A doc WITHOUT placed bars stays the grouped fast path (`longBars` undefined — byte-identical).
 * (Column/beam free bars ride the existing `extraBars` channel — covered by `addressable_bars.spec`.)
 */
import { describe, it, expect } from "vitest";
import { placeBars, sectionAt, defaultCoupeFor } from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { solveDoc } from "./solveDoc";
import { defaultGenericDoc, type GenericDoc } from "./document";
import { docToRcfg, rcfgToDoc } from "./rcfgDoc";

/** A one-way slab with a single freely placed Ø25 bar spanning the slab. */
function slabWithPlaced(): GenericDoc {
  const base = defaultGenericDoc("E-SLB-01");
  return {
    ...base,
    placed: [{ id: "FREE1", u: 300, v: -70, shapeId: "DROITE", diameter: 25 }],
  };
}

describe("M2 adapter — generic placed bars", () => {
  it("a generic doc with no placed bars is the grouped fast path (longBars undefined)", () => {
    expect(solveDoc(defaultGenericDoc("E-SLB-01")).longBars).toBeUndefined();
    expect(solveDoc(defaultGenericDoc("E-COL-02")).longBars).toBeUndefined();
  });

  it("a free bar on a slab renders, schedules, and appears in the coupe", () => {
    const r = solveDoc(slabWithPlaced());
    expect(r.longBars).toBeDefined();
    expect(r.hasUserAddressableContent).toBe(true);
    // renders (additively — the base mat is kept + the free bar appended)
    expect(placeBars(r).some((p) => p.groupId === "FREE1")).toBe(true);
    // schedules (its own Ø25 line)
    expect(computeBBS(r).summary.byDiameter.some((d) => d.diameter === 25)).toBe(true);
    // appears in the default coupe (full-length bar crossed by the perpendicular cut)
    expect(sectionAt(r, defaultCoupeFor(r)).circles.some((c) => c.groupId === "FREE1")).toBe(true);
  });

  it("the placed bars round-trip through .rcfg (ride meta.app_document, additive)", () => {
    const doc = slabWithPlaced();
    const back = rcfgToDoc(docToRcfg(doc, [])) as GenericDoc;
    expect(back.placed).toEqual(doc.placed);
    expect(solveDoc(back).longBars).toBeDefined();
  });
});

// --- v1.0.5 M3: doc-level rows / bundles / layers through the adapter -------------------------------

/** A one-way slab carrying a doc-level row, bundle and layer (the M3 `PlacedBarDoc` kinds). */
function slabWithM3(): GenericDoc {
  const base = defaultGenericDoc("E-SLB-01");
  return {
    ...base,
    placed: [
      { kind: "row", id: "ROW", anchor: { u: -600, v: -70 }, direction: "u", extent: 1200, count: 4, shapeId: "DROITE", diameter: 16 },
      { kind: "bundle", id: "BND", u: 0, v: -70, n: 3, shapeId: "DROITE", diameter: 20 },
      { kind: "layer", id: "LYR", face: "BOTTOM", layerIndex: 1, count: 3, inset: 40, span: 600, shapeId: "DROITE", diameter: 12 },
    ],
  };
}

describe("M3 adapter — rows / bundles / layers on a generic element", () => {
  it("a row of 4 + a triple bundle render + schedule with the real counts", () => {
    const r = solveDoc(slabWithM3());
    const rendered = placeBars(r);
    expect(rendered.filter((p) => p.groupId.startsWith("ROW#")).length).toBe(4);
    expect(rendered.filter((p) => p.groupId.startsWith("BND#")).length).toBe(3);
    expect(rendered.filter((p) => p.groupId.startsWith("LYR#")).length).toBe(3);
    const bbs = computeBBS(r);
    expect(bbs.lines.find((l) => l.diameter === 16)!.count).toBe(4); // row → one mark, count 4
    expect(bbs.lines.find((l) => l.diameter === 20)!.count).toBe(3); // bundle → one mark, count 3
  });

  it("the M3 kinds round-trip losslessly through .rcfg", () => {
    const doc = slabWithM3();
    const back = rcfgToDoc(docToRcfg(doc, [])) as GenericDoc;
    expect(back.placed).toEqual(doc.placed);
    expect(solveDoc(back).longBars).toBeDefined();
  });
});
