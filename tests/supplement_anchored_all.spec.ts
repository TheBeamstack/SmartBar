/**
 * v1.0.4 B3 ([REF-SYS-756c], spec Part III B3) — every supplement archetype resolves a REAL
 * section-frame placement (position + orientation) from the base layout, instead of rendering
 * centred at the origin (the legacy "centred-for-presence", D-P3-6). Pure resolver test.
 *   • SIDE_FACES (skin)      → a lateral face at mid-height.
 *   • CORNER_DIAGONAL (diag) → the midpoint of the bound corner pair, oriented along it.
 *   • INTERIOR_DIAMOND (tie) → centred but rotated 45°.
 * The épingle (LINK_BAR_PAIR) is already anchored (G5) and is not re-tested here.
 */
import { describe, it, expect } from "vitest";
import { resolveSupplement } from "@rebarconfig/core";
import type { SupplementManifestView, SupplementBinding, BarPosition, BarRole } from "@rebarconfig/core";

// a rectangular column layout: 4 corners of a 200×400 core (u = ±100, v = ±200).
const bars: BarPosition[] = [
  { position: { u: -100, v: 200 }, faceTag: "TOP", isCorner: true, layerIndex: 0 },
  { position: { u: 100, v: 200 }, faceTag: "TOP", isCorner: true, layerIndex: 0 },
  { position: { u: -100, v: -200 }, faceTag: "BOTTOM", isCorner: true, layerIndex: 0 },
  { position: { u: 100, v: -200 }, faceTag: "BOTTOM", isCorner: true, layerIndex: 0 },
];

const man = (rule: string, shape: string, role: BarRole): SupplementManifestView => ({
  id: `S_${rule}`,
  role,
  shape,
  placement: { rule, select: "user" },
  params: [{ key: "diameter", type: "diameter", default: 10 }],
});
const binding = (barIndices: number[]): SupplementBinding => ({
  supplementId: "S",
  instanceId: "i1",
  group: "L1",
  barIndices,
  params: { diameter: 10 },
});

describe("B3 — every supplement archetype is anchored (not centred at the origin)", () => {
  it("SIDE_FACES (skin) → a lateral face at mid-height, not the origin", () => {
    const r = resolveSupplement(man("SIDE_FACES", "DROITE", "SKIN"), binding([]), bars, "L1");
    expect(r.status).toBe("PASS");
    expect(r.position).toEqual({ u: 100, v: 0 }); // right face (uMax), mid-height
    expect(r.angleDeg ?? 0).toBe(0);
  });

  it("CORNER_DIAGONAL → the bound corner pair's midpoint, oriented along it", () => {
    // bind the two LEFT corners (idx 0, 2): midpoint (−100, 0), vertical (±90°) orientation.
    const r = resolveSupplement(man("CORNER_DIAGONAL", "CROCHET_L", "SUPPLEMENTAL"), binding([0, 2]), bars, "L1");
    expect(r.status).toBe("PASS");
    expect(r.position).toEqual({ u: -100, v: 0 });
    expect(Math.abs(r.angleDeg ?? 0)).toBe(90);
  });

  it("CORNER_DIAGONAL with a deleted reference WARNs (rebind), no position", () => {
    const r = resolveSupplement(man("CORNER_DIAGONAL", "CROCHET_L", "SUPPLEMENTAL"), binding([0, 99]), bars, "L1");
    expect(r.status).toBe("WARN");
    expect(r.position).toBeUndefined();
    expect(r.brokenIndices).toContain(99);
  });

  it("INTERIOR_DIAMOND → centred but rotated 45°", () => {
    const r = resolveSupplement(man("INTERIOR_DIAMOND", "CADRE_RECT", "SUPPLEMENTAL"), binding([]), bars, "L1");
    expect(r.status).toBe("PASS");
    expect(r.position).toEqual({ u: 0, v: 0 });
    expect(r.angleDeg).toBe(45);
  });

  it("insufficient host still WARNs before placement (min_bars gate unchanged)", () => {
    const need = { ...man("INTERIOR_DIAMOND", "CADRE_RECT", "SUPPLEMENTAL"), requires: { min_bars: 8 } };
    const r = resolveSupplement(need, binding([]), bars, "L1"); // only 4 bars
    expect(r.status).toBe("WARN");
    expect(r.position).toBeUndefined();
  });
});
