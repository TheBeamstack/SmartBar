/**
 * A2 ([v1.0.4], owner ruling 2026-07-05) — steel-accounting pass. Every placed bar (group / per-bar
 * override / removed / standalone extra) reconciles into per-zone As,prov = Σ(π/4)·Øᵢ² (exact, MIXED
 * diameters) and the effective depth `d` = area-weighted centroid of the placed tension set (exact for
 * mixed levels). A doc with no addressable bars keeps the grouped count-based As, byte-identical.
 */
import { describe, it, expect } from "vitest";
import { solveElement } from "@rebarconfig/core";
import { column, droite, H } from "./g2-helpers";

const area = (phi: number) => (Math.PI / 4) * phi * phi;
const asProvOf = (r: ReturnType<typeof solveElement>) =>
  r.validation.find((v) => v.rule === "provided_area")!.value as number;

describe("A2 — steel accounting over the real placed set", () => {
  it("legacy no-op: a grouped column's As,prov = N × π/4·Ø² (byte-identical)", () => {
    expect(asProvOf(solveElement(column()))).toBeCloseTo(6 * area(20), 2); // 6 corner-shared bars
  });

  it("mixed-Ø: override Ø25 + remove one bar ⇒ As,prov = 4·Ø20 + 1·Ø25", () => {
    const r = solveElement(
      column({
        overrides: [
          { barIndex: 0, shape: droite, params: { L: H }, diameter: 25 },
          { barIndex: 1, removed: true },
        ],
      }),
    );
    expect(asProvOf(r)).toBeCloseTo(4 * area(20) + area(25), 1);
  });

  it("an extra bar in the tension region contributes to As,prov", () => {
    const base = asProvOf(solveElement(column()));
    const withExtra = asProvOf(
      solveElement(column({ extra: [{ id: "XB", position: { u: 0, v: -200 }, shape: droite, params: { L: H }, diameter: 16 }] })),
    );
    expect(withExtra - base).toBeCloseTo(area(16), 1);
  });

  it("effective depth d is the area-weighted centroid over the placed tension set (mixed level)", () => {
    // an extra Ø25 higher in the bottom-tension region (v=-200 vs the corner bars at ≈-252) pulls the
    // area-weighted tension centroid up, so d shrinks vs the grouped (corner-bars-only) depth.
    const base = solveElement(column());
    const withExtra = solveElement(
      column({ extra: [{ id: "XB", position: { u: 0, v: -200 }, shape: droite, params: { L: H }, diameter: 25 }] }),
    );
    expect(withExtra.zones[0]!.d).toBeLessThan(base.zones[0]!.d);
  });
});
