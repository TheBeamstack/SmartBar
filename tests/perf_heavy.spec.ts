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
import { solveColumn, solveJoist } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");
const chapeau = loadShape("chapeau");
const mesh = loadShape("treillis_mesh");

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
