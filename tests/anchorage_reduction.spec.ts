/**
 * Anchorage / lap with As,req/As,prov reduction + auto bond classification (spec §7.7).
 * As,prov > As,req shortens l_s; clamped to l_b,min; a top (poor-bond) bar anchors longer.
 */
import { describe, it, expect } from "vitest";
import { makeBaelPack } from "@rebarconfig/codepacks";

const code = makeBaelPack();
const material = { f_c28: 25, f_e: 500 };
const phi = 20;

describe("anchorage reduction (BAEL l_s)", () => {
  const full = code.lbd({ diameter: phi, material, goodBond: true });

  it("straight scellement ≈ 40φ for FeE500/C25", () => {
    // l_s = φ·f_e/(4·τ_su), τ_su = 0.6·1.5²·f_t28, f_t28 = 0.6+0.06·25 = 2.1
    const ft28 = 0.6 + 0.06 * 25;
    const tau = 0.6 * 1.5 ** 2 * ft28;
    const ls = (phi * 500) / (4 * tau);
    expect(full).toBeCloseTo(ls, 6);
    expect(full / phi).toBeGreaterThan(38);
    expect(full / phi).toBeLessThan(46);
  });

  it("As,prov > As,req shortens the anchorage (σ_sd = f_yd·As,req/As,prov)", () => {
    const reduced = code.lbd({ diameter: phi, material, goodBond: true, asReqOverProv: 0.8 });
    expect(reduced).toBeCloseTo(full * 0.8, 6);
    expect(reduced).toBeLessThan(full);
  });

  it("clamps the reduction to l_b,min", () => {
    const tiny = code.lbd({ diameter: phi, material, goodBond: true, asReqOverProv: 0.05 });
    const lbMin = Math.max(0.3 * full, 10 * phi, 100);
    expect(tiny).toBeCloseTo(lbMin, 6);
  });

  it("top bars auto-classified poor-bond anchor longer than good-bond bars", () => {
    const poor = code.lbd({ diameter: phi, material, goodBond: false });
    expect(poor).toBeGreaterThan(full);
    expect(poor).toBeCloseTo(full / 0.7, 6);
  });

  it("laps ride on l_s and grow ×1.5 when >½ the bars splice at a section", () => {
    const lap = code.l0({ diameter: phi, material, goodBond: true, fractionLapped: 0.6 });
    const lapLow = code.l0({ diameter: phi, material, goodBond: true, fractionLapped: 0.4 });
    expect(lap).toBeCloseTo(lapLow * 1.5, 6);
  });
});
