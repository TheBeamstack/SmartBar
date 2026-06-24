/**
 * BAEL-FR engineering reference case (spec §14.7, plan P1 gate G-BAEL).
 *
 * ⚠⚠ PROVISIONAL / UNSIGNED. These golden numbers are computed from the standard BAEL
 * relations against the PROVISIONAL constants in packages/codepacks/src/bael/bael-constants.json
 * (`"_provisional": true`). They are NOT yet ratified by the nominated structural engineer.
 * Gate **G-BAEL** (current_state.md §6) blocks P1 *acceptance* — not coding — until these are
 * signed off. When ratified, update the constants (and any number here that the engineer
 * corrects) and drop the provisional flag.
 *
 * Known column: b=300, h=600, H=3000 mm, FeE500 / C25, 6Ø20 longitudinal + Ø8 ties @200,
 * exposure "EXTERIOR", cover 30 mm.
 */
import { describe, it, expect } from "vitest";
import { solveColumn, barArea } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();

const res = solveColumn({
  element: "E-COL-01",
  geometry: { b: 300, h: 600, H: 3000 },
  material: { f_c28: 25, f_e: 500 },
  cover: 30,
  exposure: "EXTERIOR",
  dg: 20,
  longitudinal: {
    groupId: "L1",
    shape: loadShape("droite"),
    diameter: 20,
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    asReq: 1800,
  },
  tie: { groupId: "T1", shape: loadShape("cadre_rect"), diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
  code,
});

const find = (rule: string) => res.validation.find((v) => v.rule === rule)!;

describe("BAEL reference column (PROVISIONAL — G-BAEL unsigned)", () => {
  it("the pack reports itself provisional (gate visible, not silently 'done')", () => {
    expect(res.provisional).toBe(true);
  });

  it("As,provided = 6·πφ²/4 ≈ 1884.96 mm²", () => {
    expect(6 * barArea(20)).toBeCloseTo(1884.96, 2);
    expect(Number(find("provided_area").value)).toBeCloseTo(1884.96, 2);
  });

  it("clear spacing s_clear ≈ 82 mm (worst face)", () => {
    expect(Number(find("clear_spacing").value)).toBeCloseTo(82, 2);
  });

  it("c_nom = 30 mm (EXTERIOR durability governs over φ and floor)", () => {
    expect(Number(find("cover").limit)).toBeCloseTo(30, 6);
  });

  it("tie s_t,max = min(15φℓ, 400, b_min+100) = 300 mm", () => {
    expect(Number(find("tie_spacing").limit)).toBeCloseTo(300, 6);
  });

  it("A_min = 720 mm² (perimeter term) and A_max = 9000 mm² (5%·B)", () => {
    const lim = String(find("ratio_limits").limit); // "[A_min, A_max]"
    expect(lim).toBe("[720, 9000]");
  });

  it("straight anchorage l_s ≈ 44φ (computed) — ⚠ tabulated BAEL target is ≈40φ, a G-BAEL item", () => {
    const ls = code.lbd({ diameter: 20, material: { f_c28: 25, f_e: 500 }, goodBond: true });
    expect(ls).toBeCloseTo(881.83, 1);
    // documents the ratification discrepancy: computed 44φ vs the tabulated ≈40φ
    expect(ls / 20).toBeGreaterThan(40);
  });

  it("the worst-case tie spacing 200 mm < 300 mm → element not failing on transverse steel", () => {
    expect(find("tie_spacing").status).toBe("PASS");
  });
});
