/**
 * P6 performance pass (spec §2.2): the heaviest elements must still solve+validate within the
 * interactive budget so a slider drag stays smooth. We measure the pure engine cost (no render)
 * with a best-of-N to shed scheduler noise, on the densest cases we ship:
 *   - a heavily-reinforced tied column with very tight ties (many transverse stations + bars);
 *   - a hollow-block joist slab with a fine topping mesh (many welded wires).
 *
 * Headless boxes vary, so we assert against a generous multiple of the §2.2 16 ms budget; the
 * point is to catch a pathological regression (e.g. an accidental O(n²) in placement), not to
 * pin a number. The web `perf_budget.spec` already guards the typical-element 16 ms target.
 */
import { describe, it, expect } from "vitest";
import { solveColumn, solveCircular, solveJoist, solveSlab, placeBars, type SingleBar } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");
const chapeau = loadShape("chapeau");
const mesh = loadShape("treillis_mesh");
const spiral = loadShape("spirale_helice");

/** Best-of-N wall-clock (ms) of a pure solve — the minimum sheds GC/scheduler spikes. */
function bestOf(n: number, fn: () => unknown): number {
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    fn();
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

const BUDGET_MS = 16; // §2.2 interactive budget (solve+validate alone; render excluded)

describe("heavy-element performance (§2.2)", () => {
  it("a densely-tied, heavily-reinforced column solves within budget", () => {
    const solve = () =>
      solveColumn({
        element: "E-COL-01",
        geometry: { b: 500, h: 900, H: 4000 },
        material: { f_c28: 25, f_e: 500 },
        cover: 30,
        exposure: "EXTERIOR",
        longitudinal: {
          groupId: "L1",
          shape: droite,
          diameter: 25,
          layout: { principle: "SYMMETRIC", nTop: 8, nBottom: 8, nLeft: 6, nRight: 6 },
          asReq: 6000,
        },
        // 50 mm spacing over 4 m ⇒ ~80 transverse stations
        tie: { groupId: "T1", shape: cadre, diameter: 10, spacing: 50, nLegs: 4, aswReqPerM: 1200 },
        code,
      });
    const r = solve();
    expect(r.status).toBeDefined();
    const ms = bestOf(15, solve);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it("a joist slab with a fine topping mesh solves within budget", () => {
    const solve = () =>
      solveJoist({
        element: "E-SLB-03",
        profile: "JOIST_SLAB",
        geometry: { L: 6000, t_total: 280, t_topping: 60, b_joist: 120, block_w: 500, block_h: 200, joist_spacing: 620 },
        material: { f_c28: 25, f_e: 500, f_ck: 25, f_yk: 500 },
        cover: 25,
        exposure: "INTERIOR",
        zones: [
          { zone: "As_joist_bottom", groupId: "JB", slabRole: "MAIN", shape: droite, params: { L: 6000 }, diameter: 14, spacing: 620, asReqPerM: 450 },
          { zone: "As_joist_top_support", groupId: "JT", slabRole: "TOP", shape: chapeau, params: { L: 1500 }, diameter: 12, spacing: 620, asReqPerM: 260 },
          // 75 mm mesh over a 6 m × 0.62 m panel ⇒ many wires
          { zone: "As_topping_mesh", groupId: "TM", slabRole: "SECONDARY", shape: mesh, params: { pitch_x: 75, pitch_y: 75, Lx: 6000, Ly: 620 }, diameter: 6, spacing: 75, asReqPerM: 120 },
        ],
        code,
      });
    const r = solve();
    expect(r.groups).toHaveLength(3);
    const ms = bestOf(15, solve);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});

/**
 * v1.0.3 G1 ([REF-SYS-960]): `placeBars` now reconstructs each bar's real bent centreline (and the
 * spiral as one dense member-length helix). The placement of the densest cages must still fit the
 * 16 ms interactive budget so a slider drag stays smooth.
 */
describe("G1 placement performance (§2.2)", () => {
  it("a dense spiral circular column places (one coil) within budget", () => {
    // 6 m pile-style cage, 50 mm pitch ⇒ a ~120-turn helix sampled ~36×/turn (thousands of points)
    const result = solveCircular({
      element: "E-FND-01",
      profile: "CIRCULAR_COLUMN",
      geometry: { D: 800, H: 6000 },
      material: { f_c28: 25, f_e: 500 },
      cover: 50,
      exposure: "EXTERIOR",
      longitudinal: [
        { zone: "As_total", groupId: "L1", shape: droite, params: { L: 6000 }, diameter: 25, count: 16, asReq: 6000, primary: true },
      ],
      transverse: [
        { zone: "Asw_spiral", groupId: "SP1", shape: spiral, params: { pitch: 50, helix_diameter: 680, turns: 120 }, diameter: 12, spacing: 50, nLegs: 2, aswReqPerM: 0 },
      ],
      code,
    });
    expect(placeBars(result).filter((p) => p.groupId === "SP1")).toHaveLength(1);
    const ms = bestOf(15, () => placeBars(result));
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it("a heavily-reinforced, densely-tied beam-style column places within budget", () => {
    const result = solveColumn({
      element: "E-COL-01",
      geometry: { b: 500, h: 900, H: 6000 },
      material: { f_c28: 25, f_e: 500 },
      cover: 30,
      exposure: "EXTERIOR",
      longitudinal: { groupId: "L1", shape: droite, diameter: 25, layout: { principle: "SYMMETRIC", nTop: 8, nBottom: 8, nLeft: 6, nRight: 6 }, asReq: 6000 },
      tie: { groupId: "T1", shape: cadre, diameter: 10, spacing: 50, nLegs: 4, aswReqPerM: 1200 },
      code,
    });
    expect(placeBars(result).length).toBeGreaterThan(100);
    const ms = bestOf(15, () => placeBars(result));
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});

/**
 * v1.0.5 M2 (P-B): the shared placed-bar pass must not add pathological cost — a dense set of freely
 * placed bars on a slab still solves (resolve + validate) AND places within the interactive budget.
 */
describe("M2 placed-bar performance (§2.2)", () => {
  const placed: SingleBar[] = Array.from({ length: 60 }, (_, i) => ({
    kind: "single",
    id: `F${i}`,
    position: { u: -2000 + i * 60, v: -70 },
    shape: droite,
    params: { L: 5000 },
    diameter: 12,
  }));

  it("a slab with 60 freely placed bars solves within budget", () => {
    const solve = () =>
      solveSlab({
        element: "E-SLB-01", profile: "SLAB_ONEWAY", geometry: { Lx: 5000, Ly: 4000, t: 200 },
        material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
        zones: [{ zone: "As_main", groupId: "M", slabRole: "MAIN", shape: droite, params: { L: 5000 }, diameter: 12, spacing: 150, asReqPerM: 700, v: -75 }],
        placed,
        code,
      });
    const r = solve();
    expect(r.longBars).toHaveLength(60);
    expect(bestOf(15, solve)).toBeLessThan(BUDGET_MS);
  });

  it("placing that slab (base mat + 60 free bars) stays within budget", () => {
    const result = solveSlab({
      element: "E-SLB-01", profile: "SLAB_ONEWAY", geometry: { Lx: 5000, Ly: 4000, t: 200 },
      material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
      zones: [{ zone: "As_main", groupId: "M", slabRole: "MAIN", shape: droite, params: { L: 5000 }, diameter: 12, spacing: 150, asReqPerM: 700, v: -75 }],
      placed,
      code,
    });
    expect(bestOf(15, () => placeBars(result))).toBeLessThan(BUDGET_MS);
  });
});

/**
 * v1.0.5 M3 (P-C/P-E): rows + bundles expand to N single bars in the shared pass — 20 rows of 4 + 20
 * triple bundles = 140 resolved bars must still solve + place within the interactive budget.
 */
describe("M3 row/bundle expansion performance (§2.2)", () => {
  const placed = [
    ...Array.from({ length: 20 }, (_, i) => ({
      kind: "row" as const, id: `R${i}`, anchor: { u: -1900 + i * 60, v: -70 }, direction: "u" as const, extent: 300, count: 4,
      shape: droite, params: { L: 5000 }, diameter: 12,
    })),
    ...Array.from({ length: 20 }, (_, i) => ({
      kind: "bundle" as const, id: `B${i}`, position: { u: -1900 + i * 60, v: -50 }, n: 3,
      shape: droite, params: { L: 5000 }, diameter: 16,
    })),
  ];
  const solve = () =>
    solveSlab({
      element: "E-SLB-01", profile: "SLAB_ONEWAY", geometry: { Lx: 5000, Ly: 4000, t: 200 },
      material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
      zones: [{ zone: "As_main", groupId: "M", slabRole: "MAIN", shape: droite, params: { L: 5000 }, diameter: 12, spacing: 150, asReqPerM: 700, v: -75 }],
      placed,
      code,
    });

  it("20 rows-of-4 + 20 triple bundles (140 bars) solve within budget", () => {
    const r = solve();
    expect(r.longBars).toHaveLength(20 * 4 + 20 * 3);
    expect(bestOf(15, solve)).toBeLessThan(BUDGET_MS);
  });

  it("placing that dense expanded set stays within budget", () => {
    const result = solve();
    expect(bestOf(15, () => placeBars(result))).toBeLessThan(BUDGET_MS);
  });
});
