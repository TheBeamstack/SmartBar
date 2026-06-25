/**
 * 8c (D-P6-1): a multi-leg tie/stirrup now MATERIALISES its extra legs as cross-tie groups, so the
 * number (nLegs), the 3D model, and the schedule agree. nLegs still drives the leg-counted Asw (that
 * was already correct); this adds the (nLegs−2)/2 cross-ties to the resolved geometry + BBS.
 */
import { describe, it, expect } from "vitest";
import { computeBBS } from "@rebarconfig/exporters";
import { solveDoc } from "./solveDoc";
import { defaultColumnDoc, type ColumnDoc } from "./document";
import { buildScene } from "../viewport/rebarProps";

const withLegs = (n: number): ColumnDoc => ({
  ...defaultColumnDoc(),
  tie: { ...defaultColumnDoc().tie, nLegs: n },
});

describe("multi-leg tie auto-draws cross-ties (8c)", () => {
  it("a standard 2-leg tie materialises NO cross-ties", () => {
    const r = solveDoc(withLegs(2));
    expect(r.groups.some((g) => g.groupId.startsWith("T1_X"))).toBe(false);
  });

  it("a 4-leg tie materialises ONE cross-tie group; a 6-leg tie materialises TWO", () => {
    expect(solveDoc(withLegs(4)).groups.filter((g) => g.groupId.startsWith("T1_X")).length).toBe(1);
    expect(solveDoc(withLegs(6)).groups.filter((g) => g.groupId.startsWith("T1_X")).length).toBe(2);
  });

  it("the cross-ties render in 3D (instanced up the member like the cadre)", () => {
    const r = solveDoc(withLegs(4));
    const scene = buildScene(r, withLegs(4), false);
    expect(scene.bars.some((b) => b.groupId.startsWith("T1_X"))).toBe(true);
  });

  it("the cross-ties appear on the BBS (scheduled per station, not omitted)", () => {
    const bbs2 = computeBBS(solveDoc(withLegs(2)));
    const bbs4 = computeBBS(solveDoc(withLegs(4)));
    const tieMarks = (bbs: ReturnType<typeof computeBBS>) =>
      bbs.lines.reduce((n, l) => n + l.count, 0);
    // the 4-leg version schedules strictly more transverse bars (the added cross-ties)
    expect(tieMarks(bbs4)).toBeGreaterThan(tieMarks(bbs2));
  });

  it("the cross-tie materialisation does not break the solve (cross-ties carry aswReqPerM 0)", () => {
    // nLegs already drove the leg-counted Asw; the perimeter cadre zone still owns the Asw check.
    expect(solveDoc(withLegs(4)).status).not.toBe("FAIL");
    expect(solveDoc(withLegs(6)).status).not.toBe("FAIL");
  });
});
