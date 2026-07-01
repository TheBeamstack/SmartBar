/**
 * v1.0.3 G2 ([REF-SYS-530], spec §2.3) — independent extra bars. A standalone bar (its own section
 * position, shape, length, Ø) is rendered + scheduled like a real bar, but it is a DETAILING add-on:
 * it does NOT enter the layout/As (the validation count-group is untouched, like a supplement).
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

  it("the extra bar does NOT alter the validation layout / provided area", () => {
    const provided = (res: ReturnType<typeof solveElement>) =>
      res.validation.find((v) => v.rule === "provided_area")?.value;
    expect(provided(solveElement(column({ extra: [extra] })))).toBe(provided(solveElement(column())));
  });
});
