/**
 * Advanced builder ("Mode expert", spec §5.6). Experts may add/replace/remove any bar group
 * with explicit references/coordinates: validation still runs but tier-1 (FAIL) still blocks
 * while tier-2 (WARN) only warns, and the advanced layout persists fully inside `.rcfg` (§10).
 */
import { describe, it, expect } from "vitest";
import { solveColumn, isBarGroup, type BarGroup } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p3-helpers";

const code = makeBaelPack();

function column(over: { nTop?: number; aswReqPerM?: number; spacing?: number }) {
  return solveColumn({
    element: "E-COL-01",
    geometry: { b: 300, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    longitudinal: {
      groupId: "L1",
      shape: loadShape("droite"),
      diameter: 20,
      layout: { principle: "FREE", nTop: over.nTop ?? 3, nBottom: 3, nLeft: 2, nRight: 2 },
      asReq: 1800,
    },
    tie: {
      groupId: "T1",
      shape: loadShape("cadre_rect"),
      diameter: 8,
      spacing: over.spacing ?? 200,
      nLegs: 2,
      aswReqPerM: over.aswReqPerM ?? 300,
    },
    code,
  });
}

describe("advanced builder semantics (§5.6)", () => {
  it("tier-1 (FAIL) blocks: a face with <2 bars is hard-invalid", () => {
    const res = column({ nTop: 1 });
    const faceRule = res.validation.find((v) => v.rule === "face_min_bars")!;
    expect(faceRule.status).toBe("FAIL");
    expect(faceRule.tier).toBe(1);
    expect(res.status).toBe("FAIL"); // export locked
  });

  it("tier-2 (WARN) warns only: a near-limit Asw does not lock export", () => {
    // Asw,provided/m = 2·(π·8²/4)·1000/200 ≈ 502.65; req 480 ⇒ within the 5% WARN band
    const res = column({ aswReqPerM: 480 });
    const asw = res.validation.find((v) => v.rule === "asw_leg_count")!;
    expect(asw.status).toBe("WARN");
    expect(asw.tier).toBe(2);
    expect(res.status).toBe("WARN");
    expect(res.status).not.toBe("FAIL"); // export still allowed
  });

  it("an advanced explicit-coordinate bar group round-trips through .rcfg verbatim", () => {
    const custom: BarGroup = {
      id: "X1",
      kind: "REBAR_GROUP",
      role: "SUPPLEMENTAL",
      shapeArchetypeId: "DROITE",
      params: { L: 1000 },
      diameter: 12,
      distribution: { mode: "FIXED_COUNT", count: 1 },
      placement: { rule: "coordinate", coordinate: { u: 55, v: -120 } },
    };
    const doc = { rcfg_version: 1, reinforcement: [custom] };
    const round = JSON.parse(JSON.stringify(doc)) as typeof doc;
    expect(round).toEqual(doc);
    const el = round.reinforcement[0]!;
    expect(isBarGroup(el)).toBe(true);
    if (isBarGroup(el)) {
      expect(el.placement.coordinate).toEqual({ u: 55, v: -120 });
      expect(el.role).toBe("SUPPLEMENTAL");
    }
  });
});
