/**
 * v1.0.5 M3 (P-C, [REF-SYS-530]) — counted / spaced rows.
 *
 * A `BarRow` places N bars as ONE object (an anchor + a direction + an extent + either a `count` or a
 * `spacing`) but resolves to N real `SingleBar`s at solve time — so 3D/coupe/BBS see real bars while the
 * editor persists one row. This proves: the row resolves to N scheduled bars (ONE merged mark, count N),
 * `count` ↔ `spacing` are equivalent, and the row's steel enters the zone's As,prov (A2 reconciliation).
 */
import { describe, it, expect } from "vitest";
import {
  solveElement,
  placeBars,
  barArea,
  type SolveResult,
  type BarRow,
} from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");
const ROW_DIA = 32; // distinctive Ø → the row is its own BBS line, never merges with a base bar

/** A column with an optional bottom BarRow placed as `input.placed`. */
function column(row?: BarRow): SolveResult {
  return solveElement({
    element: "E-COL-01", profile: "BAEL_COLUMN", section: "RECT",
    geometry: { b: 400, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 }, cover: 30, exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT: 8, phiLInset: 20,
    longitudinal: [{ zone: "As_total", groupId: "L1", role: "PRIMARY_LONGITUDINAL", shape: droite, params: { L: 3000 }, diameter: 20, faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"], asReq: 1800, tensionFace: "BOTTOM" }],
    transverse: [{ zone: "Asw", groupId: "T1", shape: cadre, params: { w: 400 - 2 * 30 - 8, h: 600 - 2 * 30 - 8 }, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 }],
    ...(row ? { placed: [row] } : {}),
    code,
  });
}

/** A bottom row of `count` bars spread across a 300 mm band; full member length. */
function rowByCount(count: number): BarRow {
  return { kind: "row", id: "ROW", anchor: { u: -150, v: -260 }, direction: "u", extent: 300, count, shape: droite, params: { L: 3000 }, diameter: ROW_DIA };
}

describe("M3 P-C — a BarRow resolves to N real bars", () => {
  it("a row of 4 renders as 4 distinct bars", () => {
    const rendered = placeBars(column(rowByCount(4)));
    const rowBars = rendered.filter((b) => b.groupId.startsWith("ROW#"));
    expect(rowBars.length).toBe(4);
    // 4 distinct u positions across the band (spread evenly over the extent).
    const us = rowBars.map((b) => b.points[0]).sort((a, b) => a! - b!);
    expect(new Set(us).size).toBe(4);
  });

  it("a row schedules as ONE merged mark with the real count", () => {
    const bbs = computeBBS(column(rowByCount(4)));
    const rowLine = bbs.lines.find((l) => l.diameter === ROW_DIA);
    expect(rowLine).toBeDefined();
    expect(rowLine!.count).toBe(4); // 4 identical bars → one line, count 4
    expect(rowLine!.groupIds).toEqual(["ROW#0", "ROW#1", "ROW#2", "ROW#3"]);
  });

  it("count and spacing are equivalent (a 300 mm band, 4 bars ↔ 100 mm spacing)", () => {
    const byCount = placeBars(column(rowByCount(4))).filter((b) => b.groupId.startsWith("ROW#"));
    const bySpacing = placeBars(
      column({ kind: "row", id: "ROW", anchor: { u: -150, v: -260 }, direction: "u", extent: 300, spacing: 100, shape: droite, params: { L: 3000 }, diameter: ROW_DIA }),
    ).filter((b) => b.groupId.startsWith("ROW#"));
    expect(bySpacing.length).toBe(4); // floor(300/100)+1 = 4
    const usCount = byCount.map((b) => b.points[0]).sort((a, b) => a! - b!);
    const usSpacing = bySpacing.map((b) => b.points[0]).sort((a, b) => a! - b!);
    usSpacing.forEach((u, i) => expect(u).toBeCloseTo(usCount[i]!, 3));
  });

  it("the row's steel enters the zone's As,prov (A2 reconciliation)", () => {
    const base = column();
    const withRow = column(rowByCount(4));
    const asOf = (r: SolveResult) => r.validation.find((v) => v.rule === "provided_area")!.value as number;
    expect(asOf(withRow) - asOf(base)).toBeCloseTo(4 * barArea(ROW_DIA), 0);
  });
});
