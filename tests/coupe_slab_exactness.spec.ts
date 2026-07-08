/**
 * v1.0.4 C1 ([REF-SYS-810], spec Part IV C1) — slab-family coupe exactness.
 *
 * The DISTRIBUTION (secondary) layer of a one-way slab / stair waist now runs ACROSS the width at
 * span stations (its true cross-direction geometry) instead of being fanned along the span like short
 * main bars (the pre-C1 representative model). So a transverse coupe reads the MAIN bars as a row of
 * dots (circles) + the distribution layer as a LINE across the width — not a second row of dots.
 *
 * Provided steel stays PER METRE (spacing-driven) — this is a render/coupe re-model, not an As change.
 * ⚠ the G-COUPE conventions remain PROVISIONAL pending owner/engineer ratification (owner_tasks §B-7,
 * visual acceptance §D-4).
 */
import { describe, it, expect } from "vitest";
import {
  solveSlab,
  solveStair,
  placeBars,
  sectionAt,
  defaultCoupeFor,
  type SolveResult,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const mesh = loadShape("treillis_mesh");

const LX = 5000;
const LY = 3000;

/** A one-way slab: main bottom (along the span) + distribution (across the width) + no top zone. */
function oneWaySlab(): SolveResult {
  return solveSlab({
    element: "E-SLB-01",
    profile: "SLAB_ONEWAY",
    geometry: { Lx: LX, Ly: LY, t: 200 },
    material: { f_c28: 25, f_e: 500 },
    cover: 25,
    exposure: "INTERIOR",
    zones: [
      { zone: "As_main", groupId: "M", slabRole: "MAIN", shape: droite, params: { L: LX }, diameter: 12, spacing: 150, asReqPerM: 700, v: -75 },
      { zone: "As_dist", groupId: "D", slabRole: "SECONDARY", shape: droite, params: { L: LY }, diameter: 8, spacing: 250, asReqPerM: 200, v: -60 },
    ],
    code,
  });
}

/** A two-way slab reinforced by welded mats (both directions MAIN, no discrete distribution bar). */
function twoWaySlab(): SolveResult {
  return solveSlab({
    element: "E-SLB-02",
    profile: "SLAB_TWOWAY",
    geometry: { Lx: LX, Ly: LX, t: 200 },
    material: { f_c28: 25, f_e: 500 },
    cover: 25,
    exposure: "INTERIOR",
    zones: [
      { zone: "As_main_x", groupId: "MX", slabRole: "MAIN", shape: mesh, params: { pitch_x: 150, pitch_y: 150, Lx: LX, Ly: LX }, diameter: 10, spacing: 150, asReqPerM: 400 },
      { zone: "As_main_y", groupId: "MY", slabRole: "MAIN", shape: mesh, params: { pitch_x: 150, pitch_y: 150, Lx: LX, Ly: LX }, diameter: 10, spacing: 150, asReqPerM: 400 },
    ],
    code,
  });
}

/** A straight-flight stair: main bottom (MARCHE_PALIER, along the going) + distribution (across width). */
const N_STEPS = 12, GOING = 280, LANDING = 1000;
const STAIR_SPAN = N_STEPS * GOING;
const FLIGHT_WIDTH = 1200;
function stair(): SolveResult {
  return solveStair({
    element: "E-STR-01",
    profile: "STAIR",
    geometry: { g: GOING, r: 170, n_steps: N_STEPS, waist_t: 180, flight_width: FLIGHT_WIDTH, landing_L: LANDING },
    material: { f_c28: 25, f_e: 500 },
    cover: 25,
    exposure: "INTERIOR",
    zones: [
      { zone: "As_main", groupId: "M", slabRole: "MAIN", shape: loadShape("marche_palier"), params: { flight: STAIR_SPAN, landing: LANDING, bend: 30 }, diameter: 12, spacing: 150, asReqPerM: 600, v: -65 },
      { zone: "As_dist", groupId: "D", slabRole: "SECONDARY", shape: droite, params: { L: FLIGHT_WIDTH }, diameter: 8, spacing: 250, asReqPerM: 120, v: -50 },
    ],
    code,
  });
}

/** [minX, maxX, minY, maxY] extent of a placed bar's polyline. */
function extent(points: number[]): { dx: number; dy: number; x0: number; x1: number; y: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i + 2 < points.length; i += 3) {
    minX = Math.min(minX, points[i]!); maxX = Math.max(maxX, points[i]!);
    minY = Math.min(minY, points[i + 1]!); maxY = Math.max(maxY, points[i + 1]!);
  }
  return { dx: maxX - minX, dy: maxY - minY, x0: minX, x1: maxX, y: minY };
}

describe("C1 — slab distribution bars run ACROSS the width (placeBars)", () => {
  const placed = placeBars(oneWaySlab());
  const main = placed.filter((p) => p.groupId === "M");
  const dist = placed.filter((p) => p.groupId === "D");

  it("main bars run ALONG the span (+Y): constant X, full length in Y", () => {
    expect(main.length).toBeGreaterThan(0);
    for (const m of main) {
      const e = extent(m.points);
      expect(e.dx).toBeLessThan(1e-6); // no lateral run — a span bar
      expect(e.dy).toBeGreaterThan(LX * 0.9); // spans (nearly) the whole length
    }
  });

  it("distribution bars run ACROSS the width (world-X) at a single span station", () => {
    expect(dist.length).toBeGreaterThan(0);
    for (const d of dist) {
      const e = extent(d.points);
      expect(e.dy).toBeLessThan(1e-6); // sits at ONE span station — no along-span run
      expect(e.dx).toBeCloseTo(LY, 3); // spans the full width Ly
      expect(e.x0).toBeCloseTo(-LY / 2, 3);
      expect(e.x1).toBeCloseTo(LY / 2, 3);
    }
  });

  it("distribution bars are distributed ALONG the span (distinct Y stations)", () => {
    const ys = new Set(dist.map((d) => Math.round(extent(d.points).y)));
    expect(ys.size).toBe(dist.length); // every distribution bar at its own span station
    expect(dist.length).toBeGreaterThan(1);
  });
});

describe("C1 — the transverse coupe reads main=dots + distribution=line", () => {
  const result = oneWaySlab();
  const view = sectionAt(result, defaultCoupeFor(result));

  it("main bars appear as section circles (dots), all from the main group", () => {
    expect(view.circles.length).toBeGreaterThan(0);
    expect(view.circles.every((c) => c.groupId === "M")).toBe(true);
  });

  it("the distribution layer appears as a line spanning the full width", () => {
    const distLines = view.lines.filter((l) => l.groupId === "D");
    expect(distLines.length).toBeGreaterThan(0);
    const l = distLines[0]!;
    expect(Math.abs(l.a.s - l.b.s)).toBeCloseTo(LY, 3); // full width in the plane's s-axis
    expect(Math.abs(l.a.t - l.b.t)).toBeLessThan(1e-6); // horizontal (constant depth)
  });

  it("is deterministic", () => {
    const again = sectionAt(result, defaultCoupeFor(result));
    expect(again).toEqual(view);
  });
});

describe("C1 — the distribution layer shows for ANY cut station (nearest-behind guarantee)", () => {
  const result = oneWaySlab();
  it("a cut landing between two distribution bars still shows the nearest one as a line", () => {
    // a station deliberately offset from the margin/pitch grid (50 + k·250)
    const cut = { ...defaultCoupeFor(result), origin: { x: 0, y: 1234, z: 0 } };
    const distLines = sectionAt(result, cut).lines.filter((l) => l.groupId === "D");
    expect(distLines.length).toBeGreaterThan(0);
  });
});

describe("C1 — legacy no-op: no discrete distribution bar → representative render unchanged", () => {
  it("a two-way slab (welded mats, both MAIN) places NO across-width bars", () => {
    const placed = placeBars(twoWaySlab());
    // every placed bar is a span-running mat member (or its representative panel) — none is a
    // single-station cross-width line (dy ≈ 0 while dx ≈ full width).
    const acrossLines = placed.filter((p) => {
      const e = extent(p.points);
      return e.dy < 1e-6 && e.dx > LX * 0.5;
    });
    expect(acrossLines.length).toBe(0);
  });
});

describe("C1 — the stair distribution layer runs across the flight width too", () => {
  const result = stair();
  it("distribution bars run across the flight width at span (going) stations", () => {
    const dist = placeBars(result).filter((p) => p.groupId === "D");
    expect(dist.length).toBeGreaterThan(1);
    for (const d of dist) {
      const e = extent(d.points);
      expect(e.dy).toBeLessThan(1e-6);
      expect(e.dx).toBeCloseTo(FLIGHT_WIDTH, 3);
    }
  });
});
