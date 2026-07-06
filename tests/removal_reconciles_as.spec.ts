/**
 * H5 ([v1.0.4], A2's first slice) — removing a bar reconciles the schedule count with As,prov.
 * Pre-v1.0.4 a `removed` override dropped the bar from render/schedule but the count-group still drove
 * §7, so As,prov didn't move (the H5 gap). A2's steel-accounting pass now sums π/4·Ø² over the REAL
 * placed set, so a removal drops As,prov by exactly that bar's area.
 */
import { describe, it, expect } from "vitest";
import { solveElement } from "@rebarconfig/core";
import { column, droite, H } from "./g2-helpers";

const area = (phi: number) => (Math.PI / 4) * phi * phi;
const asProvOf = (r: ReturnType<typeof solveElement>) =>
  r.validation.find((v) => v.rule === "provided_area")!.value as number;

describe("H5 — removal reconciles As,prov", () => {
  it("removing one Ø20 bar drops As,prov by π/4·20²", () => {
    const base = asProvOf(solveElement(column())); // 6 × Ø20
    const after = asProvOf(solveElement(column({ overrides: [{ barIndex: 0, removed: true }] })));
    expect(base - after).toBeCloseTo(area(20), 1);
  });

  it("a Ø-only override moves As,prov by the Ø delta (Ø20 → Ø25 on one bar)", () => {
    const base = asProvOf(solveElement(column()));
    const after = asProvOf(
      solveElement(column({ overrides: [{ barIndex: 0, shape: droite, params: { L: H }, diameter: 25 }] })),
    );
    expect(after - base).toBeCloseTo(area(25) - area(20), 1);
  });
});
