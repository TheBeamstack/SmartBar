/**
 * v1.0.4 C2 ([REF-SYS-820], spec Part IV C2) — shop-drawing completeness.
 *   • `bending_table_segments`: a spliced bar's segment rows each carry their OWN centreline sketch
 *     (the developed [from,to] slice of the parent), not the whole-bar fallback (D-V103-7 gap).
 *   • `leader_density`: leader labels stay a legible pitch apart even at bar density (the rail is
 *     stretched so nothing stacks), replacing the pre-C2 even fan that could overlap.
 */
import { describe, it, expect } from "vitest";
import { shopDrawing, computeBBS } from "@rebarconfig/exporters";
import { solveElement, type ElementSolveInput, type SolveResult } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p3-helpers";

/** The reference beam with the span bar lap-spliced at mid-length → two fabricated segments. */
function splicedBeam(): SolveResult {
  const code = makeBaelPack();
  const b = 300, h = 600, cover = 30, phiT = 8;
  const input: ElementSolveInput = {
    element: "E-BEM-01",
    profile: "BAEL_BEAM",
    section: "RECT",
    geometry: { b, h, L: 6000 },
    material: { f_c28: 25, f_e: 500 },
    cover,
    exposure: "EXTERIOR",
    layout: { principle: "FREE", nTop: 2, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT,
    phiLInset: 20,
    longitudinal: [
      {
        zone: "As_span_bottom",
        groupId: "B1",
        shape: loadShape("droite"),
        params: { L: 6000 },
        diameter: 20,
        faces: ["BOTTOM"],
        asReq: 900,
        tensionFace: "BOTTOM",
        splices: [{ at: 3000, kind: "lap" }],
      },
      {
        zone: "As_top_support",
        groupId: "C1",
        shape: loadShape("chapeau"),
        params: { L: 1500 },
        diameter: 16,
        faces: ["TOP"],
        asReq: 380,
        tensionFace: "TOP",
      },
    ],
    transverse: [
      { zone: "Asw_shear", groupId: "S1", shape: loadShape("etrier"), params: { w: b - 2 * cover - phiT, h: h - 2 * cover - phiT }, diameter: phiT, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    ],
    code,
  };
  return solveElement(input);
}

/** A short column densely packed with independent extra bars → many leaders in a small span. */
function denseColumn(nExtra: number): SolveResult {
  const code = makeBaelPack();
  const droite = loadShape("droite");
  const extraBars = Array.from({ length: nExtra }, (_, k) => ({
    id: `X${k}`,
    position: { u: -80 + (160 * k) / (nExtra - 1), v: 0 },
    shape: droite,
    params: { L: 500 },
    diameter: 12,
  }));
  const input: ElementSolveInput = {
    element: "E-COL-01",
    profile: "BAEL_COLUMN",
    section: "RECT",
    geometry: { b: 300, h: 300, H: 500 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT: 8,
    phiLInset: 20,
    longitudinal: [
      { zone: "As_total", groupId: "L1", role: "PRIMARY_LONGITUDINAL", shape: droite, params: { L: 500 }, diameter: 20, faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"], asReq: 1800, tensionFace: "BOTTOM" },
    ],
    transverse: [
      { zone: "Asw_confinement", groupId: "T1", shape: loadShape("cadre_rect"), params: { w: 244, h: 244 }, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    ],
    extraBars,
    code,
  };
  return solveElement(input);
}

describe("C2 — bending_table_segments (a spliced segment's own centreline)", () => {
  const result = splicedBeam();
  const shop = shopDrawing(result);
  const bbs = computeBBS(result);

  it("schedules the span bar as SEGMENTS (groupId `B1#…`)", () => {
    const segLines = bbs.lines.filter((l) => l.groupIds.some((g) => g.startsWith("B1#")));
    expect(segLines.length).toBeGreaterThanOrEqual(2);
  });

  it("each segment row's sketch spans its OWN cut (~3000), not the whole 6000 bar", () => {
    const segMarks = new Set(
      bbs.lines.filter((l) => l.groupIds.some((g) => g.includes("#"))).map((l) => l.mark),
    );
    const segRows = shop.bendingTable.filter((r) => segMarks.has(r.mark));
    expect(segRows.length).toBeGreaterThanOrEqual(2);
    for (const row of segRows) {
      expect(row.sketch).toBeDefined();
      const xs = row.sketch!.map((p) => p.x);
      const extent = Math.max(...xs) - Math.min(...xs);
      expect(extent).toBeGreaterThan(1000);
      expect(extent).toBeLessThan(5000); // NOT the full 6000-mm bar
    }
  });

  it("legacy no-op: an unspliced bar's row still carries the whole-bar sketch", () => {
    const c1 = shop.bendingTable.find((r) => r.shapeArchetypeId === "CHAPEAU");
    expect(c1?.sketch).toBeDefined();
  });
});

describe("C2 — leader_density (robust anti-overlap at density)", () => {
  it("keeps consecutive leader labels a legible pitch apart (no stacking)", () => {
    const shop = shopDrawing(denseColumn(12));
    expect(shop.leaders.length).toBeGreaterThanOrEqual(12); // base group + 12 extras
    // a column draws VERTICAL → labels stack along the y (height) rail.
    const ys = shop.leaders.map((l) => l.to.y).sort((a, b) => a - b);
    let minPitch = Infinity;
    for (let i = 1; i < ys.length; i++) minPitch = Math.min(minPitch, ys[i]! - ys[i - 1]!);
    expect(minPitch).toBeGreaterThanOrEqual(50); // the legibility floor (minSep) — no overlap
  });

  it("all leader anchors are distinct", () => {
    const shop = shopDrawing(denseColumn(12));
    const tos = shop.leaders.map((l) => `${Math.round(l.to.x)},${Math.round(l.to.y)}`);
    expect(new Set(tos).size).toBe(shop.leaders.length);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(shopDrawing(denseColumn(8)))).toBe(JSON.stringify(shopDrawing(denseColumn(8))));
  });
});
