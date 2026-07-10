/**
 * v1.0.5 M2 (P-B, audit B3) — the shared placed-bar resolution pass.
 *
 * `resolvePlacedBars` is the single long-steel truth for freely placed bars, called by `solveElement`
 * (RECT extras) AND the four generic shims. Two placement modes must resolve differently:
 *   - **free** — a `SingleBar` at `(u,v)` resolves section-AGNOSTICALLY (same position on any section).
 *   - **override** — a `SingleBar` with `overrideBarIndex` resolves section-AWARE: its position comes
 *     from the target native layout bar (the section's own bar convention), NOT the free `(u,v)`.
 *
 * Also asserts the per-bar primitives the RECT path shares: curtailment (`startStation`/`endStation`
 * shorten the run + cut length) and per-bar splices (segment the schedule).
 */
import { describe, it, expect } from "vitest";
import {
  resolvePlacedBars,
  type BarPosition,
  type SolvedGroup,
  type SingleBar,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const material = { f_c28: 25, f_e: 500 };

const ctxBase = { memberLength: 3000, code, material };

/** A minimal solved DROITE group to inherit from in the override case. */
const group: SolvedGroup = {
  groupId: "L1",
  role: "PRIMARY_LONGITUDINAL",
  diameter: 20,
  count: 4,
  zone: "As_total",
  shape: loadShape("droite") as unknown as SolvedGroup["shape"], // shape unused for a free bar's own geometry
};

function single(extra: Partial<SingleBar> = {}): SingleBar {
  return { kind: "single", id: "X1", position: { u: 10, v: 20 }, shape: droite, params: { L: 3000 }, diameter: 16, ...extra };
}

describe("resolvePlacedBars — free vs override (audit B3)", () => {
  it("a FREE bar resolves section-agnostically (same (u,v) regardless of the layout)", () => {
    const rectLayout: BarPosition[] = [{ position: { u: -100, v: -200 }, faceTag: "BOTTOM", layerIndex: 0, isCorner: false }];
    const circLayout: BarPosition[] = [{ position: { u: 250, v: 90 }, faceTag: "CIRC", layerIndex: 0, isCorner: false }];
    const onRect = resolvePlacedBars([single()], { ...ctxBase, layoutBars: rectLayout });
    const onCirc = resolvePlacedBars([single()], { ...ctxBase, layoutBars: circLayout });
    expect(onRect[0]!.position).toEqual({ u: 10, v: 20 });
    expect(onCirc[0]!.position).toEqual({ u: 10, v: 20 }); // identical — section-agnostic
    expect(onRect[0]!.standalone).toBe(true);
  });

  it("an OVERRIDE bar resolves section-aware — its position comes from the target layout bar", () => {
    const rectLayout: BarPosition[] = [{ position: { u: -100, v: -200 }, faceTag: "BOTTOM", layerIndex: 0, isCorner: false }];
    const circLayout: BarPosition[] = [{ position: { u: 250, v: 90 }, faceTag: "CIRC", layerIndex: 0, isCorner: false }];
    const ov = single({ overrideBarIndex: 0 });
    const onRect = resolvePlacedBars([ov], { ...ctxBase, layoutBars: rectLayout, groups: [group] });
    const onCirc = resolvePlacedBars([ov], { ...ctxBase, layoutBars: circLayout, groups: [group] });
    // the SAME override input lands on DIFFERENT positions — driven by each section's own layout bar.
    expect(onRect[0]!.position).toEqual({ u: -100, v: -200 });
    expect(onCirc[0]!.position).toEqual({ u: 250, v: 90 });
    expect(onRect[0]!.standalone).toBe(false); // an override modifies an existing bar
    expect(onRect[0]!.barIndex).toBe(0); // keeps the target index (covered by placeBars/BBS)
  });

  it("free bars get sequential indices from startIndex; overrides keep their target index", () => {
    const layout: BarPosition[] = [
      { position: { u: 0, v: 0 }, faceTag: "TOP", layerIndex: 0, isCorner: false },
      { position: { u: 1, v: 1 }, faceTag: "TOP", layerIndex: 0, isCorner: false },
    ];
    const out = resolvePlacedBars(
      [single({ id: "F1" }), single({ id: "F2" })],
      { ...ctxBase, layoutBars: layout, startIndex: layout.length },
    );
    expect(out.map((b) => b.barIndex)).toEqual([2, 3]);
    expect(out.every((b) => b.standalone)).toBe(true);
  });

  it("curtailment stations shorten the run and the cut length", () => {
    const full = resolvePlacedBars([single({ diameter: 20 })], ctxBase)[0]!;
    const cut = resolvePlacedBars([single({ diameter: 20, startStation: 500, endStation: 2500 })], ctxBase)[0]!;
    expect(cut.startStation).toBe(500);
    expect(cut.endStation).toBe(2500);
    expect(cut.axisStart).toBe(500);
    expect(cut.shape.cutLength).toBeLessThan(full.shape.cutLength);
    expect(cut.shape.cutLength).toBeCloseTo(2000, 1); // run = end − start
  });

  it("a per-bar splice segments the resolved bar", () => {
    const spliced = resolvePlacedBars(
      [single({ diameter: 20, splices: [{ at: 1500, kind: "lap" }] })],
      ctxBase,
    )[0]!;
    expect(spliced.splice).toBeDefined();
    expect(spliced.splice!.segments.length).toBeGreaterThan(1);
  });
});
