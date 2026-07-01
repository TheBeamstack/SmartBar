/**
 * v1.0.3 G2 ([REF-SYS-530], spec §2) — per-bar overrides. A longitudinal group is no longer N
 * identical bars: one bar can carry its own shape/hooks/diameter, a unique length + axial position,
 * or be removed — flowing to the 3D/coupe placement (`placeBars`) and the schedule (`computeBBS`).
 * With NO overrides the result is the grouped fast path (`longBars` undefined → byte-identical).
 */
import { describe, it, expect } from "vitest";
import { solveElement, placeBars } from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { column, droite, code, H } from "./g2-helpers";

describe("G2 — per-bar overrides", () => {
  it("no overrides → grouped fast path (longBars undefined, byte-identical)", () => {
    const r = solveElement(column());
    expect(r.longBars).toBeUndefined();
  });

  it("overriding one bar's diameter splits it onto its own schedule line; the rest stay grouped", () => {
    const r = solveElement(column({ overrides: [{ barIndex: 0, shape: droite, params: { L: H }, diameter: 12 }] }));
    expect(r.longBars).toBeDefined();
    expect(r.longBars![0]!.diameter).toBe(12);
    // the other longitudinal bars keep the group Ø20
    expect(r.longBars!.filter((b) => b.diameter === 20).length).toBeGreaterThan(0);
    // BBS now carries a Ø12 line (the unique bar) alongside the Ø20 group bars
    const bbs = computeBBS(r);
    expect(bbs.lines.some((l) => l.diameter === 12)).toBe(true);
    expect(bbs.lines.some((l) => l.diameter === 20)).toBe(true);
  });

  it("a per-bar end hook bends that bar in 3D (its placed centreline gains lateral extent)", () => {
    const r = solveElement(column({ overrides: [{ barIndex: 0, shape: droite, params: { L: H }, hooks: { end: { angle: 135 } } }] }));
    const placed = placeBars(r).find((b) => b.barIndex === 0)!;
    const zs = placed.points.filter((_, i) => i % 3 === 2);
    // a straight bar has zero Z spread; the hooked override returns into the depth plane
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(10);
  });

  it("a unique length + axial position places the bar shorter and offset along the axis", () => {
    const r = solveElement(column({ overrides: [{ barIndex: 1, shape: droite, params: { L: 1500 }, axisStart: 500 }] }));
    const placed = placeBars(r).find((b) => b.barIndex === 1)!;
    const ys = placed.points.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(500, 3); // starts at the axial position
    expect(Math.max(...ys)).toBeCloseTo(2000, 3); // 500 + 1500 run
  });

  it("a removed bar disappears from the placement AND the schedule", () => {
    const base = computeBBS(solveElement(column()));
    const baseCount = base.lines.reduce((n, l) => n + l.count, 0);
    const r = solveElement(column({ overrides: [{ barIndex: 0, removed: true }] }));
    expect(placeBars(r).some((b) => b.barIndex === 0)).toBe(false);
    const after = computeBBS(r).lines.reduce((n, l) => n + l.count, 0);
    expect(after).toBe(baseCount - 1);
  });
});
