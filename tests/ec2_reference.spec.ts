/**
 * EC2 (EN 1992-1-1) engineering reference case (spec §7.1–7.8, plan P4a gate G-EC2).
 *
 * ⚠⚠ PROVISIONAL / UNSIGNED. These golden numbers are computed from the standard EC2 relations
 * against the PROVISIONAL constants in packages/codepacks/src/ec2/ec2-constants.json
 * (`"_provisional": true`). They are NOT yet ratified by the nominated structural engineer.
 * Gate **G-EC2** (current_state.md §6) blocks P4a *acceptance* — not coding — until signed off.
 *
 * Material defaults C25/30, B500B. φ20 unless noted.
 */
import { describe, it, expect } from "vitest";
import { makeEc2Pack } from "@rebarconfig/codepacks";

const code = makeEc2Pack();
const mat = { f_ck: 25, f_yk: 500 };

describe("EC2 reference (PROVISIONAL — G-EC2 unsigned)", () => {
  it("the pack reports itself provisional (gate visible, not silently 'done')", () => {
    expect(code._provisional).toBe(true);
    expect(code.id).toBe("EC2");
  });

  it("design anchorage l_bd ≈ 40φ (good bond, full stress) — l_b,rqd = (φ/4)(f_yd/f_bd)", () => {
    const lbd = code.lbd({ diameter: 20, material: mat, goodBond: true });
    expect(lbd).toBeCloseTo(807.18, 1);
    expect(lbd / 20).toBeGreaterThan(39);
    expect(lbd / 20).toBeLessThan(42);
  });

  it("As,req/As,prov reduction shortens l_bd, clamped to l_b,min", () => {
    const full = code.lbd({ diameter: 20, material: mat, goodBond: true });
    const reduced = code.lbd({ diameter: 20, material: mat, goodBond: true, asReqOverProv: 0.5 });
    expect(reduced).toBeLessThan(full);
    expect(reduced).toBeGreaterThanOrEqual(0.3 * full - 1e-6); // l_b,min floor (≈0.3·l_b,rqd)
  });

  it("lap l_0 = α₆·l_bd (α₆ = 1.5 when > 50% lapped)", () => {
    const lbd = code.lbd({ diameter: 20, material: mat, goodBond: true });
    const l0 = code.l0({ diameter: 20, material: mat, goodBond: true, fractionLapped: 1 });
    expect(l0).toBeCloseTo(1.5 * lbd, 4);
  });

  it("ρ limits: As,min = 0.002·Ac, As,max = 0.04·Ac (column, no N_Ed)", () => {
    const Ac = 300 * 600;
    expect(code.AsMin({ Ac, material: mat, member: "COLUMN" })).toBeCloseTo(360, 6);
    expect(code.AsMax({ Ac, material: mat, member: "COLUMN" })).toBeCloseTo(7200, 6);
  });

  it("s_cl,tmax = min(20φℓ, b_min, 400) = 300 mm", () => {
    expect(code.tieSpacingMax({ bMin: 300, phiLMin: 20 })).toBeCloseTo(300, 6);
  });

  it("mandrel 4φ (≤16) / 7φ (>16)", () => {
    expect(code.mandrelMin(16)).toBe(64);
    expect(code.mandrelMin(20)).toBe(140);
  });

  it("cover c_min + Δc_dev (XC1 φ12 → 25 mm; XS3 φ20 → 55 mm)", () => {
    expect(code.cover({ diameter: 12, exposure: "XC1", material: mat })).toBeCloseTo(25, 6);
    expect(code.cover({ diameter: 20, exposure: "XS3", material: mat })).toBeCloseTo(55, 6);
  });

  it("tie ø ≥ max(6, φℓ,max/4); slab spacing min(3h,400)/min(3.5h,450)", () => {
    expect(code.tieDiameterMin(20)).toBe(6);
    expect(code.slabSpacingMax(200, false)).toBe(400);
    expect(code.slabSpacingMax(200, true)).toBe(450);
  });
});
