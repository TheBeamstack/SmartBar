/**
 * v1.0.3 G2 ([REF-SYS-530]) — the adapter threads per-bar overrides + independent extra bars from
 * the editable doc into the engine's `longOverrides`/`extraBars`, so they flow to the 3D/coupe/PDF/
 * DXF placement + the schedule. A legacy doc (none) stays the grouped fast path (byte-identical), and
 * the overrides/extra bars round-trip through `.rcfg` (they ride `meta.app_document`, additive).
 */
import { describe, it, expect } from "vitest";
import { placeBars } from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { solveDoc } from "./solveDoc";
import { defaultColumnDoc, type ColumnDoc } from "./document";
import { docToRcfg, rcfgToDoc } from "./rcfgDoc";

describe("G2 adapter — addressable bars", () => {
  it("a legacy doc (no overrides/extra) is the grouped fast path (longBars undefined)", () => {
    expect(solveDoc(defaultColumnDoc()).longBars).toBeUndefined();
  });

  it("a per-bar diameter override splits that bar onto its own BBS line", () => {
    const doc: ColumnDoc = {
      ...defaultColumnDoc(),
      longitudinal: { ...defaultColumnDoc().longitudinal, barOverrides: [{ index: 0, diameter: 12 }] },
    };
    const r = solveDoc(doc);
    expect(r.longBars).toBeDefined();
    expect(computeBBS(r).lines.some((l) => l.diameter === 12)).toBe(true);
  });

  it("a removed bar disappears from the placement", () => {
    const doc: ColumnDoc = {
      ...defaultColumnDoc(),
      longitudinal: { ...defaultColumnDoc().longitudinal, barOverrides: [{ index: 0, removed: true }] },
    };
    expect(placeBars(solveDoc(doc)).some((b) => b.barIndex === 0)).toBe(false);
  });

  it("an independent extra bar renders + schedules AND contributes to As (A2, owner 2026-07-06)", () => {
    const doc: ColumnDoc = {
      ...defaultColumnDoc(),
      extraBars: [{ id: "U1", u: 0, v: 0, shapeId: "DROITE", diameter: 16 }],
    };
    const r = solveDoc(doc);
    expect(placeBars(r).some((b) => b.groupId === "U1")).toBe(true);
    expect(computeBBS(r).lines.some((l) => l.diameter === 16)).toBe(true);
    // A2: an extra is real steel — As,prov grows by the extra's π/4·Ø² (was: detailing-only no-op).
    const pa = (d: ColumnDoc) => solveDoc(d).validation.find((v) => v.rule === "provided_area")?.value as number;
    expect(pa(doc) - pa(defaultColumnDoc())).toBeCloseTo((Math.PI / 4) * 16 * 16, 1);
  });

  it("overrides + extra bars round-trip through .rcfg (ride meta.app_document)", () => {
    const doc: ColumnDoc = {
      ...defaultColumnDoc(),
      longitudinal: { ...defaultColumnDoc().longitudinal, barOverrides: [{ index: 2, shapeId: "DROITE", length: 1500, axialPos: 500 }] },
      extraBars: [{ id: "U1", u: 0, v: 0, shapeId: "DROITE", diameter: 16 }],
    };
    const restored = rcfgToDoc(docToRcfg(doc, [])) as ColumnDoc;
    expect(restored.longitudinal.barOverrides).toEqual(doc.longitudinal.barOverrides);
    expect(restored.extraBars).toEqual(doc.extraBars);
  });
});
