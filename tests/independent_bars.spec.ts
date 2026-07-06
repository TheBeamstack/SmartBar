/**
 * v1.0.3 G2 ([REF-SYS-530], spec §2.3) — independent extra bars. A standalone bar (its own section
 * position, shape, length, Ø) is rendered + scheduled like a real bar.
 *
 * v1.0.4 A2 (owner decision 2026-07-06): an extra is real steel — it now **contributes** π/4·Ø² to the
 * As,prov of the zone whose tension region it sits in (region rule, `structural_data.md §1`), and it
 * enters the area-weighted `d`. (Superseded the v1.0.3 "detailing-only / As untouched" simplification.)
 */
import { describe, it, expect } from "vitest";
import { solveElement, placeBars } from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { column, droite, H } from "./g2-helpers";

const extra = { id: "X1", position: { u: 0, v: 0 }, shape: droite, params: { L: H }, diameter: 16 };

describe("G2 — independent extra bars", () => {
  it("an extra bar is rendered + scheduled, standalone (not part of a count-group)", () => {
    const r = solveElement(column({ extra: [extra] }));
    expect(r.longBars!.some((b) => b.standalone && b.groupId === "X1")).toBe(true);
    expect(placeBars(r).some((b) => b.groupId === "X1")).toBe(true);
    expect(computeBBS(r).lines.some((l) => l.diameter === 16)).toBe(true);
  });

  it("an extra bar CONTRIBUTES π/4·Ø² to the zone's provided area (A2, owner 2026-07-06)", () => {
    const provided = (res: ReturnType<typeof solveElement>) =>
      res.validation.find((v) => v.rule === "provided_area")?.value as number;
    const without = provided(solveElement(column()));
    const withExtra = provided(solveElement(column({ extra: [extra] })));
    expect(withExtra).toBeCloseTo(without + (Math.PI / 4) * 16 * 16, 1); // +201.06 mm² (Ø16)
  });
});
