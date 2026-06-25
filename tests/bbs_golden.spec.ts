/**
 * Bar-Bending Schedule golden (spec §9.1, plan P5). The §9.1 record for the reference beam matches
 * the committed golden (marks, lengths, weights), identical bars MERGE across groups, and a
 * continuous spiral counts as ONE bar (not a stack of discrete sets).
 */
import { describe, it, expect } from "vitest";
import { computeBBS, type BbsLine } from "@rebarconfig/exporters";
import { solveCircular, type SolveResult } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { referenceBeam } from "./bbs-helpers";
import { loadShape } from "./p3-helpers";

/** project a line to the golden-relevant fields (drops the big fiche sketch). */
const proj = (l: BbsLine) => ({
  mark: l.mark,
  groupIds: l.groupIds,
  shape: l.shapeArchetypeId,
  diameter: l.diameter,
  count: l.count,
});

describe("bbs_golden — reference beam (§9.1)", () => {
  const bbs = computeBBS(referenceBeam());

  it("has three lines, marked 1..3 in ascending Ø order (stable marks)", () => {
    expect(bbs.lines.map(proj)).toEqual([
      { mark: "1", groupIds: ["S1"], shape: "ETRIER", diameter: 8, count: 30 },
      { mark: "2", groupIds: ["C1"], shape: "CHAPEAU", diameter: 16, count: 2 },
      { mark: "3", groupIds: ["B1"], shape: "DROITE", diameter: 20, count: 3 },
    ]);
  });

  it("the Ø8 stirrup count = the placed transverse stations (30 @ 200 over 6 m)", () => {
    expect(bbs.lines[0]!.count).toBe(30);
  });

  it("freezes the per-line cut lengths and weights (golden)", () => {
    const [s, c, b] = bbs.lines;
    // stirrup: cutLength + total run + weight
    expect(s!.cutLength_mm).toBeCloseTo(1554.7744007614378, 6);
    expect(s!.totalLength_m).toBeCloseTo(46.64323202284314, 6);
    expect(s!.weight_kg).toBeCloseTo(18.40355362693299, 6);
    // chapeau
    expect(c!.cutLength_mm).toBeCloseTo(1945.6637061435918, 6);
    expect(c!.weight_kg).toBeCloseTo(6.141448575168125, 6);
    // span bars (straight, exact)
    expect(b!.cutLength_mm).toBe(6000);
    expect(b!.totalLength_m).toBe(18);
    expect(b!.weight_kg).toBeCloseTo(44.388, 6);
  });

  it("steel-quantity summary: per-Ø weights + ratio over the 1.08 m³ envelope", () => {
    expect(bbs.summary.byDiameter.map((d) => d.diameter)).toEqual([8, 16, 20]);
    expect(bbs.summary.totalWeight_kg).toBeCloseTo(68.93300220210112, 6);
    expect(bbs.summary.concreteVolume_m3).toBeCloseTo(1.08, 9);
    expect(bbs.summary.steelRatio_kg_m3).toBeCloseTo(63.826853890834364, 6);
  });

  it("is deterministic: same result → identical schedule", () => {
    expect(JSON.stringify(computeBBS(referenceBeam()))).toBe(
      JSON.stringify(computeBBS(referenceBeam())),
    );
  });
});

describe("bbs_golden — identical bars merge across groups", () => {
  it("two groups with the same shape + Ø + cut length collapse to one mark with summed count", () => {
    const base = referenceBeam();
    const span = base.groups.find((g) => g.groupId === "B1")!;
    // clone the straight span group under a second id (same shape/Ø/cut) → must MERGE
    const twin = { ...span, groupId: "B1b" };
    const doubled: SolveResult = { ...base, groups: [...base.groups, twin] };
    const bbs = computeBBS(doubled);
    const droite = bbs.lines.find((l) => l.shapeArchetypeId === "DROITE")!;
    expect(droite.count).toBe(6); // 3 + 3
    expect(droite.groupIds.sort()).toEqual(["B1", "B1b"]);
    // still only one DROITE line
    expect(bbs.lines.filter((l) => l.shapeArchetypeId === "DROITE").length).toBe(1);
  });
});

describe("bbs_golden — a continuous spiral is one bar", () => {
  const circular: SolveResult = solveCircular({
    element: "E-COL-02",
    profile: "CIRCULAR_COLUMN",
    geometry: { D: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 50,
    exposure: "EXTERIOR",
    longitudinal: [
      {
        zone: "As_total",
        groupId: "L1",
        shape: loadShape("droite"),
        params: { L: 3000 },
        diameter: 20,
        count: 8,
        asReq: 1500,
        primary: true,
      },
    ],
    transverse: [
      {
        zone: "Asw_spiral",
        groupId: "SP1",
        shape: loadShape("spirale_helice"),
        params: { pitch: 60, helix_diameter: 500, turns: 50 },
        diameter: 8,
        spacing: 60,
        nLegs: 2,
        aswReqPerM: 0,
      },
    ],
    code: makeBaelPack(),
  });

  it("counts the spiral once (not floor(H/pitch) discrete sets)", () => {
    const bbs = computeBBS(circular);
    const spiral = bbs.lines.find((l) => l.groupIds.includes("SP1"))!;
    expect(spiral.count).toBe(1);
    // its cut length is the full coil, not the pitch
    expect(spiral.cutLength_mm).toBeGreaterThan(50000);
  });
});
