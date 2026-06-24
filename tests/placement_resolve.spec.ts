/**
 * Placement resolution (spec §5.4). A LINK_BAR_PAIR supplement (épingle) positions itself
 * exactly between the two bound longitudinal bars, and re-solves when the base layout moves.
 */
import { describe, it, expect } from "vitest";
import {
  solveColumn,
  resolveBarPairPlacement,
  resolveSupplement,
  type BarPosition,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape, loadSupplement } from "./p3-helpers";

const code = makeBaelPack();

function columnBars(b = 300, h = 600): BarPosition[] {
  return solveColumn({
    element: "E-COL-01",
    geometry: { b, h, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    longitudinal: {
      groupId: "L1",
      shape: loadShape("droite"),
      diameter: 20,
      layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
      asReq: 1800,
    },
    tie: { groupId: "T1", shape: loadShape("cadre_rect"), diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    code,
  }).bars;
}

const topIndices = (bars: BarPosition[]) =>
  bars.map((b, i) => ({ b, i })).filter((x) => x.b.faceTag === "TOP").map((x) => x.i);

describe("placement resolution — LINK_BAR_PAIR (§5.4)", () => {
  it("positions the épingle exactly at the midpoint of the bound pair", () => {
    const bars = columnBars();
    const ti = topIndices(bars);
    const [i, j] = [ti[0]!, ti[ti.length - 1]!];
    const p = resolveBarPairPlacement(bars, i, j);
    const a = bars[i]!.position;
    const c = bars[j]!.position;
    expect(p.valid).toBe(true);
    expect(p.position!.u).toBeCloseTo((a.u + c.u) / 2, 6);
    expect(p.position!.v).toBeCloseTo((a.v + c.v) / 2, 6);
    expect(p.span!).toBeCloseTo(Math.hypot(c.u - a.u, c.v - a.v), 6);
  });

  it("re-solves when a base bar moves (wider section ⇒ wider épingle span)", () => {
    const narrow = columnBars(300, 600);
    const wide = columnBars(500, 600);
    const ni = topIndices(narrow);
    const wi = topIndices(wide);
    const pn = resolveBarPairPlacement(narrow, ni[0]!, ni[ni.length - 1]!);
    const pw = resolveBarPairPlacement(wide, wi[0]!, wi[wi.length - 1]!);
    expect(pw.span!).toBeGreaterThan(pn.span!);
  });

  it("resolveSupplement exposes the resolved span as the épingle shape param", () => {
    const bars = columnBars();
    const ti = topIndices(bars);
    const sup = loadSupplement("SUPP_EPINGLE_CROSSTIE");
    const r = resolveSupplement(
      sup,
      { supplementId: sup.id, instanceId: "e1", group: "L1", barIndices: [ti[0]!, ti[ti.length - 1]!] },
      bars,
      "L1",
    );
    expect(r.status).toBe("PASS");
    expect(r.params.span).toBeGreaterThan(0);
    expect(r.diameter).toBe(8);
    expect(r.position).toBeDefined();
  });
});
