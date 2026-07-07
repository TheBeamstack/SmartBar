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
import { resolveSupplement, solveElement } from "@rebarconfig/core";
import type { SupplementManifestView, SupplementBinding, BarPosition, BarRole } from "@rebarconfig/core";
import { column, droite, H } from "./g2-helpers";
import { loadShape } from "./p1-helpers";

const area = (phi: number) => (Math.PI / 4) * phi * phi;
const ruleValue = (r: ReturnType<typeof solveElement>, rule: string) =>
  r.validation.find((v) => v.rule === rule)!.value as number;

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

// -----------------------------------------------------------------------------
// B3 next slice — SKIN multi-bar fanout (`count_per_side` × both faces).
// -----------------------------------------------------------------------------
describe("B3 — SIDE_FACES skin fanout (count_per_side, both faces)", () => {
  it("count_per_side=1 → one bar per side (2 anchors); representative = right face, mid-height", () => {
    const r = resolveSupplement(man("SIDE_FACES", "DROITE", "SKIN"), binding([]), bars, "L1");
    expect(r.anchors).toHaveLength(2);
    expect(new Set(r.anchors!.map((a) => a.u))).toEqual(new Set([100, -100]));
    expect(r.anchors!.every((a) => a.v === 0)).toBe(true); // mid-height for n=1
    expect(r.position).toEqual({ u: 100, v: 0 });
  });

  it("count_per_side=2 → 2 bars on EACH face (4 anchors), evenly spaced between the corners", () => {
    const b = { ...binding([]), params: { diameter: 10, count_per_side: 2 } };
    const r = resolveSupplement(man("SIDE_FACES", "DROITE", "SKIN"), b, bars, "L1");
    expect(r.anchors).toHaveLength(4);
    expect(new Set(r.anchors!.map((a) => a.u))).toEqual(new Set([100, -100]));
    const vsRight = r.anchors!.filter((a) => a.u === 100).map((a) => a.v).sort((x, y) => x - y);
    expect(vsRight[0]).toBeCloseTo(-200 + (1 / 3) * 400, 6); // -66.67
    expect(vsRight[1]).toBeCloseTo(-200 + (2 / 3) * 400, 6); //  66.67
    expect(r.position).toEqual({ u: 100, v: vsRight[0] }); // representative stays anchors[0]
  });
});

// -----------------------------------------------------------------------------
// B3 next slice — anchored add-ons feed A2's steel accounting (skin → As, diamant → Asw).
// A 300×600 reference column; skin/diamond folded in via the pipeline.
// -----------------------------------------------------------------------------
const skinSup = (dia: number, count = 1) => ({
  groupId: "SK",
  role: "SKIN" as BarRole,
  shape: droite,
  params: { L: H },
  diameter: dia,
  count,
  anchor: { u: 150, v: 0, angleDeg: 0 }, // right lateral face, mid-height
});
const diamondSup = (dia: number) => ({
  groupId: "DM",
  role: "SUPPLEMENTAL" as BarRole,
  shape: loadShape("cadre_rect"),
  params: { w: 244, h: 544 },
  diameter: dia,
  count: 1,
  anchor: { u: 0, v: 0, angleDeg: 45 }, // interior diamond, rotated 45°
});
const diagonalSup = (dia: number) => ({
  groupId: "DG",
  role: "SUPPLEMENTAL" as BarRole,
  shape: loadShape("crochet_l"), // OPEN longitudinal (L-hook) corner diagonal
  params: { a: 1000, b: 200 },
  diameter: dia,
  count: 1,
  anchor: { u: -100, v: 0, angleDeg: 90 },
});

describe("B3 — supplements feed A2's accounting", () => {
  it("a skin add-on's steel joins the zone's As,prov (owner extra→zone rule)", () => {
    const base = ruleValue(solveElement(column()), "provided_area");
    const withSkin = ruleValue(solveElement({ ...column(), supplements: [skinSup(12)] }), "provided_area");
    expect(withSkin - base).toBeCloseTo(area(12), 1);
  });

  it("two skin bars (both faces) count twice", () => {
    const base = ruleValue(solveElement(column()), "provided_area");
    const withSkin = ruleValue(solveElement({ ...column(), supplements: [skinSup(12, 2)] }), "provided_area");
    expect(withSkin - base).toBeCloseTo(2 * area(12), 1);
  });

  it("a corner-diagonal add-on (open longitudinal) joins the zone's As,prov", () => {
    const base = ruleValue(solveElement(column()), "provided_area");
    const withDiag = ruleValue(solveElement({ ...column(), supplements: [diagonalSup(12)] }), "provided_area");
    expect(withDiag - base).toBeCloseTo(area(12), 1);
  });

  it("an interior diamond tie adds provided Asw at its derived 45° orientation factor (~cos45)", () => {
    const base = ruleValue(solveElement(column()), "asw_leg_count");
    const withDiamond = ruleValue(solveElement({ ...column(), supplements: [diamondSup(8)] }), "asw_leg_count");
    const expectedExtra = (2 * Math.cos(Math.PI / 4) * area(8) * 1000) / 200; // 2 legs, governing spacing 200
    expect(withDiamond - base).toBeCloseTo(expectedExtra, 0);
  });

  it("legacy no-op: a column with no anchored add-ons is byte-identical", () => {
    const base = solveElement(column());
    const same = solveElement({ ...column(), supplements: [] });
    expect(ruleValue(same, "provided_area")).toBe(ruleValue(base, "provided_area"));
    expect(ruleValue(same, "asw_leg_count")).toBe(ruleValue(base, "asw_leg_count"));
  });
});
