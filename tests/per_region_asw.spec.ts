/**
 * A2 ([v1.0.4], D-V102-5) — per-region Asw. When a transverse set has spacing regions (F5), the
 * provided Asw/m must be checked on the GOVERNING (widest) region — the sparsest stretch gives the
 * least shear steel — not the single representative spacing. A uniform set (no regions) is unchanged.
 */
import { describe, it, expect } from "vitest";
import { solveElement, type ElementSolveInput, type TransverseRegion } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p3-helpers";

const code = makeBaelPack();
const L = 6000;

function beam(regions?: TransverseRegion[], spacing = 100): ElementSolveInput {
  const b = 300, h = 600, cover = 30, phiT = 8;
  return {
    element: "E-BEM-01",
    profile: "BAEL_BEAM",
    section: "RECT",
    geometry: { b, h, L },
    material: { f_c28: 25, f_e: 500 },
    cover,
    exposure: "EXTERIOR",
    layout: { principle: "FREE", nTop: 2, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT,
    phiLInset: 20,
    longitudinal: [
      { zone: "As_span_bottom", groupId: "B1", shape: loadShape("droite"), params: { L }, diameter: 20, faces: ["BOTTOM"], asReq: 900, tensionFace: "BOTTOM" },
    ],
    transverse: [
      { zone: "Asw_shear", groupId: "S1", shape: loadShape("etrier"), params: { w: b - 2 * cover - phiT, h: h - 2 * cover - phiT }, diameter: phiT, spacing, nLegs: 2, aswReqPerM: 400, ...(regions ? { regions } : {}) },
    ],
    code,
  };
}

const aswOf = (r: ReturnType<typeof solveElement>) =>
  r.validation.find((v) => v.rule === "asw_leg_count:Asw_shear")!;

describe("A2 — per-region Asw (governing widest region)", () => {
  it("a uniform dense set (100 mm) provides enough Asw → PASS (byte-identical baseline)", () => {
    // Asw = 2·(π/4·8²)·1000/100 ≈ 1005 mm²/m ≥ 400 → PASS
    expect(aswOf(solveElement(beam())).status).toBe("PASS");
  });

  it("a sparse middle region governs → Asw FAILs even though the representative spacing is dense", () => {
    const regions: TransverseRegion[] = [
      { from: 0, to: 1000, spacing: 100 },
      { from: 1000, to: 5000, spacing: 400 }, // governing (widest) → Asw ≈ 251 < 400
      { from: 5000, to: 6000, spacing: 100 },
    ];
    // representative spacing stays 100 (which alone would PASS) — but the widest region governs.
    const asw = aswOf(solveElement(beam(regions, 100)));
    expect(asw.status).toBe("FAIL");
    expect(asw.value).toBeCloseTo((2 * (Math.PI / 4) * 8 * 8 * 1000) / 400, 0); // governing = 400 mm
  });

  it("a single full-length region is byte-identical to the uniform set", () => {
    const uniform = aswOf(solveElement(beam()));
    const oneRegion = aswOf(solveElement(beam([{ from: 0, to: L, spacing: 100 }])));
    expect(oneRegion.value).toBe(uniform.value);
    expect(oneRegion.status).toBe(uniform.status);
  });
});
