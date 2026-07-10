/**
 * v1.0.5 M5 (Track S, [REF-SYS-770] §4.2, spec Part IV) — splice / coupler reach.
 *
 * v1.0.3 gave lap/coupler splicing to the RECT column-long / beam-span groups; v1.0.4 gave per-bar
 * splices to the RECT addressable channel. M5 extends the SAME `spliceBar`/`autoSplices` machinery to:
 *   1. the **circular/pile** pipeline — a long cage's native pitch-circle zone auto-splits at stock,
 *   2. **any freely placed bar** on any element — via the shared `resolvePlacedBars` per-bar splice,
 * while **slab/mesh per-metre distribution stays unspliced** (supplied in stock lengths this release).
 * Each spliced bar schedules as **segments + a coupler tally**; the per-zone **stagger** WARN applies.
 */
import { describe, it, expect } from "vitest";
import {
  solveCircular,
  solveSlab,
  placeBars,
  type SolveResult,
  type SingleBar,
} from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const spiral = loadShape("spirale_helice");

/** A long drilled-shaft pile cage (18 m — well over the 12 m stock length). */
function pile(opts: {
  autoSplice?: boolean;
  splices?: { at: number; kind: "lap" | "coupler" }[];
  placed?: SingleBar[];
}): SolveResult {
  return solveCircular({
    element: "E-FND-01",
    profile: "CIRCULAR_COLUMN",
    geometry: { D: 800, H: 18000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 50,
    exposure: "EXTERIOR",
    longitudinal: [
      {
        zone: "As_total",
        groupId: "L1",
        shape: droite,
        params: { L: 18000 },
        diameter: 25,
        count: 12,
        asReq: 6000,
        primary: true,
        ...(opts.autoSplice ? { autoSplice: true } : {}),
        ...(opts.splices ? { splices: opts.splices } : {}),
      },
    ],
    transverse: [
      { zone: "Asw", groupId: "SP1", shape: spiral, params: { pitch: 150, helix_diameter: 680, turns: 90 }, diameter: 12, spacing: 150, nLegs: 2, aswReqPerM: 0 },
    ],
    ...(opts.placed ? { placed: opts.placed } : {}),
    code,
  });
}

/** A short one-way slab (its per-metre distribution mat must never be spliced). */
function slab(placed?: SingleBar[]): SolveResult {
  return solveSlab({
    element: "E-SLB-01",
    profile: "SLAB_ONEWAY",
    geometry: { Lx: 5000, Ly: 3000, t: 200 },
    material: { f_c28: 25, f_e: 500 },
    cover: 25,
    exposure: "INTERIOR",
    zones: [
      { zone: "As_main", groupId: "M", slabRole: "MAIN", shape: droite, params: { L: 5000 }, diameter: 12, spacing: 150, asReqPerM: 700, v: -75 },
      { zone: "As_dist", groupId: "D", slabRole: "SECONDARY", shape: droite, params: { L: 3000 }, diameter: 8, spacing: 250, asReqPerM: 200, v: -60 },
    ],
    ...(placed ? { placed } : {}),
    code,
  });
}

describe("M5 — circular/pile native-cage splicing", () => {
  it("a > 12 m pile cage auto-splits its native zone at stock + schedules the segments", () => {
    const r = pile({ autoSplice: true });
    const g = r.groups.find((x) => x.groupId === "L1")!;
    // the native pitch-circle zone now carries a splice: 18 m / 12 m stock → 1 interior lap → 2 segments.
    expect(g.splice).toBeDefined();
    expect(g.splice!.segments.length).toBe(2);
    expect(g.splice!.lapLength).toBeGreaterThan(0);
    // the total-length invariant: Σ segment cuts = run + (#laps)·l_r  (D-P1-1 preserved).
    const runPlusLap = 18000 + g.splice!.lapLength;
    expect(g.splice!.totalCutLength).toBeCloseTo(runPlusLap, 3);

    // scheduled as SEGMENTS (one line per distinct segment cut, each × the 12-bar count), not one 18 m bar.
    const bbs = computeBBS(r);
    const segLines = bbs.lines.filter((l) => l.groupIds.some((id) => id.startsWith("L1#")));
    expect(segLines.length).toBe(2);
    for (const l of segLines) {
      expect(l.count).toBe(12);
      expect(l.cutLength_mm).toBeLessThan(18000); // each fabricated piece fits the stock length
    }
    // auto-split uses LAP splices → no mechanical couplers.
    expect(bbs.couplers).toBe(0);
  });

  it("explicit COUPLER splices are tallied on the schedule (couplers, not laps)", () => {
    const r = pile({ splices: [{ at: 9000, kind: "coupler" }] });
    const g = r.groups.find((x) => x.groupId === "L1")!;
    expect(g.splice!.couplerCount).toBe(1);
    // a coupler adds no length → Σ segment cuts = run exactly.
    expect(g.splice!.totalCutLength).toBeCloseTo(18000, 3);
    const bbs = computeBBS(r);
    expect(bbs.couplers).toBe(1 * 12); // one coupler per cage bar
  });

  it("a coincident native lap raises the group-level STAGGER warning", () => {
    const r = pile({ autoSplice: true });
    const stagger = r.validation.find((v) => v.rule === "lap_stagger:As_total");
    expect(stagger).toBeDefined();
    expect(stagger!.status).toBe("WARN");
  });

  it("an un-spliced pile cage is byte-identical (no splice, no stagger item)", () => {
    const r = pile({});
    expect(r.groups.find((x) => x.groupId === "L1")!.splice).toBeUndefined();
    expect(r.validation.some((v) => v.rule.startsWith("lap_stagger"))).toBe(false);
  });
});

describe("M5 — a freely placed bar splices on any element", () => {
  const freeAutoSplice: SingleBar = {
    kind: "single",
    id: "FREE1",
    position: { u: 0, v: 0 },
    shape: droite,
    params: { L: 18000 },
    diameter: 32,
    autoSplice: true,
  };

  it("a free bar on a pile auto-splits + schedules segments; the native cage is untouched", () => {
    const r = pile({ placed: [freeAutoSplice] });
    const free = r.longBars!.find((b) => b.groupId === "FREE1")!;
    expect(free.splice).toBeDefined();
    expect(free.splice!.segments.length).toBeGreaterThan(1);
    // rendered as one bar in 3D (fabrication segments are a schedule concern, not a placement one).
    expect(placeBars(r).some((p) => p.groupId === "FREE1")).toBe(true);
    // scheduled as its own segments.
    const bbs = computeBBS(r);
    expect(bbs.lines.some((l) => l.groupIds.some((id) => id.startsWith("FREE1")) && l.diameter === 32)).toBe(true);
    // the native cage bars stay whole (no splice requested on them).
    expect(r.groups.find((x) => x.groupId === "L1")!.splice).toBeUndefined();
  });

  it("a single free spliced bar is NOT flagged as clustered (one bar can't coincide with itself)", () => {
    const r = pile({ placed: [freeAutoSplice] });
    const stagger = r.validation.find((v) => v.rule === "lap_stagger:FREE1");
    expect(stagger).toBeDefined();
    expect(stagger!.status).toBe("PASS");
  });

  it("many free bars all lapping at the same station are flagged clustered (stagger WARN)", () => {
    // three free bars, same auto-split station, same id-parent zone → coincident laps → WARN.
    const bars: SingleBar[] = [0, 1, 2].map((i) => ({
      kind: "single",
      id: "ROW",
      position: { u: i * 60, v: 0 },
      shape: droite,
      params: { L: 18000 },
      diameter: 20,
      autoSplice: true,
    }));
    // resolve them as ONE row-id so the stagger check groups them together.
    const r = solveCircular({
      element: "E-FND-01",
      profile: "CIRCULAR_COLUMN",
      geometry: { D: 800, H: 18000 },
      material: { f_c28: 25, f_e: 500 },
      cover: 50,
      exposure: "EXTERIOR",
      longitudinal: [{ zone: "As_total", groupId: "L1", shape: droite, params: { L: 18000 }, diameter: 25, count: 12, asReq: 6000, primary: true }],
      transverse: [{ zone: "Asw", groupId: "SP1", shape: spiral, params: { pitch: 150, helix_diameter: 680, turns: 90 }, diameter: 12, spacing: 150, nLegs: 2, aswReqPerM: 0 }],
      placed: bars,
      code,
    });
    const stagger = r.validation.find((v) => v.rule === "lap_stagger:ROW");
    expect(stagger).toBeDefined();
    expect(stagger!.status).toBe("WARN");
  });
});

describe("M5 — slab/mesh distribution stays unspliced (spec Part IV exclusion)", () => {
  it("a default slab's per-metre distribution mat carries NO splice, no coupler, no stagger item", () => {
    const r = slab();
    for (const g of r.groups) expect(g.splice).toBeUndefined();
    const bbs = computeBBS(r);
    expect(bbs.couplers).toBe(0);
    expect(r.validation.some((v) => v.rule.startsWith("lap_stagger"))).toBe(false);
    expect(r.longBars).toBeUndefined(); // no placed bars → grouped path, byte-identical
  });

  it("but a USER free bar placed on the slab may still splice (only the mat is excluded)", () => {
    const free: SingleBar = { kind: "single", id: "SLABFREE", position: { u: 0, v: -75 }, shape: droite, params: { L: 15000 }, diameter: 16, autoSplice: true };
    const r = slab([free]);
    const placedBar = r.longBars!.find((b) => b.groupId === "SLABFREE")!;
    expect(placedBar.splice).toBeDefined();
    // the mat groups (main + distribution) are still whole.
    for (const g of r.groups) expect(g.splice).toBeUndefined();
  });
});
