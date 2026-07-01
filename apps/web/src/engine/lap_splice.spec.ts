/**
 * v1.0.3 G4 ([REF-SYS-770], spec §4) — lap splices / couplers. Covers the pure `spliceBar` helper
 * (segments incl. the code lap overlap; the cut-length invariant), the doc→schedule flow (spliced
 * bars scheduled as segments + coupler tally), the stagger WARN, and the seismic lap-in-critical-zone
 * check. Legacy (unspliced) bars are byte-identical.
 */
import { describe, it, expect } from "vitest";
import { spliceBar, autoSplices } from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { solveDoc, baelPack } from "./solveDoc";
import { defaultColumnDoc, type ColumnDoc } from "./document";

const material = { f_c28: 25, f_e: 500 };

describe("G4 — spliceBar (pure)", () => {
  it("a lap splits into 2 segments and adds ONE lap overlap (cut-length invariant)", () => {
    const run = 8000;
    const r = spliceBar(run, [{ at: 4000, kind: "lap" }], baelPack, { diameter: 20, material });
    expect(r.segments).toHaveLength(2);
    expect(r.lapLength).toBeGreaterThan(0);
    expect(r.couplerCount).toBe(0);
    // Σ segment cuts = run + (#laps)·l_r  — the D-P1-1 accounting is preserved
    expect(r.totalCutLength).toBeCloseTo(run + r.lapLength, 6);
    expect(r.segments[0]!.cutLength).toBeCloseTo(4000 + r.lapLength, 6);
    expect(r.segments[1]!.cutLength).toBeCloseTo(4000, 6);
  });

  it("a coupler adds NO length but is counted", () => {
    const run = 9000;
    const r = spliceBar(run, [{ at: 4500, kind: "coupler" }], baelPack, { diameter: 16, material });
    expect(r.couplerCount).toBe(1);
    expect(r.totalCutLength).toBeCloseTo(run, 6); // couplers do not add steel
  });

  it("autoSplices splits a run beyond the stock length into interior points", () => {
    expect(autoSplices(9000, 12000)).toEqual([]); // fits stock
    const pts = autoSplices(25000, 12000);
    expect(pts.length).toBe(2); // 25 m → 3 segments → 2 splices
    expect(pts.every((p) => p.kind === "lap")).toBe(true);
  });
});

describe("G4 — spliced bars in the schedule", () => {
  const spliced = (kind: "lap" | "coupler"): ColumnDoc => {
    const base = defaultColumnDoc();
    return { ...base, longitudinal: { ...base.longitudinal, splices: [{ at: 1500, kind }] } };
  };

  it("a lapped column bar is scheduled as its segments + warns to stagger", () => {
    const r = solveDoc(spliced("lap"));
    const g = r.groups.find((x) => x.groupId === "L1")!;
    expect(g.splice).toBeDefined();
    expect(g.splice!.segments).toHaveLength(2);

    const bbs = computeBBS(r);
    // the segment cut lengths appear on the schedule (each × the group's bar count)
    const cuts = bbs.lines.map((l) => Math.round(l.cutLength_mm));
    expect(cuts).toContain(1500); // the un-lapped tail segment
    expect(bbs.couplers).toBe(0);
    // group-level laps coincide → a stagger WARN
    expect(r.validation.some((v) => v.rule === "lap_stagger:As_total" && v.status === "WARN")).toBe(true);
  });

  it("a coupler is tallied (count × bars) and raises no stagger WARN", () => {
    const r = solveDoc(spliced("coupler"));
    const bbs = computeBBS(r);
    const g = r.groups.find((x) => x.groupId === "L1")!;
    expect(bbs.couplers).toBe(g.count); // one coupler per bar of the group
    expect(r.validation.some((v) => v.rule.startsWith("lap_stagger"))).toBe(false);
  });

  it("an unspliced (legacy) column has no splice, no couplers, and one longitudinal line", () => {
    const r = solveDoc(defaultColumnDoc());
    expect(r.groups.find((x) => x.groupId === "L1")!.splice).toBeUndefined();
    const bbs = computeBBS(r);
    expect(bbs.couplers).toBe(0);
    expect(bbs.lines.filter((l) => l.groupIds.includes("L1")).length).toBe(1);
  });
});

describe("G4 — lap in a seismic critical zone", () => {
  it("a lap inside the plastic-hinge zone (l_c) FAILs under ND3", () => {
    const base = defaultColumnDoc();
    const doc: ColumnDoc = {
      ...base,
      seismic: { code: "RPS-2011", zone: 3, ductility: "ND3" },
      longitudinal: { ...base.longitudinal, splices: [{ at: 150, kind: "lap" }] }, // near the base → in l_c
    };
    const r = solveDoc(doc);
    const lap = r.validation.find((v) => v.rule === "lap_in_critical_zone");
    expect(lap).toBeDefined();
    expect(lap!.status).toBe("FAIL");
  });
});
