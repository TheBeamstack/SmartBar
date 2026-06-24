/**
 * Hollow-block joist slab (E-SLB-03) — slab-family flexure (spec §3.1, §7.4, §7.13, plan P4b):
 * joist bottom (MAIN) + joist top support (TOP) + topping welded mesh (SECONDARY). The topping
 * mesh provides the distribution minimum (≥0.20·As,joist_bottom). Pack-agnostic.
 */
import { describe, it, expect } from "vitest";
import { solveJoist } from "@rebarconfig/core";
import { makeBaelPack, makeEc2Pack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const droite = loadShape("droite");
const chapeau = loadShape("chapeau");
const mesh = loadShape("treillis_mesh");

function joist(code: ReturnType<typeof makeBaelPack>, toppingSpacing = 200) {
  return solveJoist({
    element: "E-SLB-03",
    profile: "JOIST_SLAB",
    geometry: { L: 4500, t_total: 250, t_topping: 50, b_joist: 100, block_w: 500, block_h: 200, joist_spacing: 600 },
    material: { f_c28: 25, f_e: 500, f_ck: 25, f_yk: 500 },
    cover: 25,
    exposure: "INTERIOR",
    zones: [
      { zone: "As_joist_bottom", groupId: "JB", slabRole: "MAIN", shape: droite, params: { L: 4500 }, diameter: 12, spacing: 600, asReqPerM: 350 },
      { zone: "As_joist_top_support", groupId: "JT", slabRole: "TOP", shape: chapeau, params: { L: 1200 }, diameter: 10, spacing: 600, asReqPerM: 200 },
      { zone: "As_topping_mesh", groupId: "TM", slabRole: "SECONDARY", shape: mesh, params: { pitch_x: toppingSpacing, pitch_y: toppingSpacing, Lx: 4500, Ly: 600 }, diameter: 6, spacing: toppingSpacing, asReqPerM: 100 },
    ],
    code,
  });
}

describe("joist slab — solve + distribution minimum (§7.13)", () => {
  it("solves the three zones and the topping mesh satisfies the distribution minimum", () => {
    // joist bottom 12@600 ≈ 188 mm²/m → need topping ≥ 0.2·188 ≈ 38 mm²/m; 6@150 ≈ 188 mm²/m
    const r = joist(makeBaelPack(), 150);
    expect(r.groups).toHaveLength(3);
    const dist = r.validation.find((v) => v.rule === "slab_distribution_min")!;
    expect(dist.status).toBe("PASS");
  });

  it("a sparse topping mesh fails the distribution minimum", () => {
    // 6@1000 ≈ 28 mm²/m < 0.2·188 ≈ 38 mm²/m
    const dist = joist(makeBaelPack(), 1000).validation.find((v) => v.rule === "slab_distribution_min")!;
    expect(dist.status).toBe("FAIL");
  });

  it("pack swap (BAEL↔EC2) keeps the same pipeline and zone count", () => {
    const b = joist(makeBaelPack(), 150);
    const e = joist(makeEc2Pack(), 150);
    expect(e.groups.map((g) => g.groupId)).toEqual(b.groups.map((g) => g.groupId));
    expect(e.element).toBe("E-SLB-03");
  });
});
