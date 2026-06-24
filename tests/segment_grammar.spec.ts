/**
 * Segment-grammar generator (spec §5.2.1). CADRE_RECT closure + cutLength + 135° hooks +
 * fillet radius; DROITE trivial length. Pairs with the validation matrix row "segment-grammar".
 */
import { describe, it, expect } from "vitest";
import { generateBarShape } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();

describe("segment grammar — CADRE_RECT (closed tie)", () => {
  const cadre = loadShape("cadre_rect");
  const w = 240;
  const h = 540;
  const phi = 8;
  const shape = generateBarShape(cadre, { w, h }, phi, code);

  it("closes the rectangle within tolerance", () => {
    expect(shape.closes).toBe(true);
    expect(shape.closed).toBe(true);
  });

  it("uses a fillet radius of mandrelØ/2 + φ/2", () => {
    const expectedR = code.mandrelMin(phi) / 2 + phi / 2; // 32/2 + 8/2 = 20
    expect(expectedR).toBe(20);
    for (const bend of shape.fiche.bends) {
      expect(bend.filletRadius).toBeCloseTo(expectedR, 6);
      expect(bend.mandrelDiameter).toBe(code.mandrelMin(phi));
    }
  });

  it("emits two 135° seismic hooks with ext = max(10φ, 70)", () => {
    expect(shape.fiche.hooks).toHaveLength(2);
    for (const hook of shape.fiche.hooks) {
      expect(hook.angle).toBe(135);
      expect(hook.extension).toBe(Math.max(10 * phi, 70)); // 80
    }
  });

  it("cutLength = 2(w+h) + 2·hookExt − Σ bend deductions (site length, not naive polyline)", () => {
    const hookExt = Math.max(10 * phi, 70);
    // 4 body corners @90° (3 turns + closing weld) + 2 hook bends @135°
    const bendDeductions =
      4 * code.bendDeduction(90, phi) + 2 * code.bendDeduction(135, phi);
    const expected = 2 * (w + h) + 2 * hookExt - bendDeductions;
    expect(shape.cutLength).toBeCloseTo(expected, 6);
    // and the site cut length is shorter than the naive sharp-corner polyline + hooks
    expect(shape.cutLength).toBeLessThan(2 * (w + h) + 2 * hookExt);
  });

  it("has a non-empty sampled centerline (flat x,y,z triples)", () => {
    expect(shape.centerline3D.length % 3).toBe(0);
    expect(shape.centerline3D.length).toBeGreaterThan(12);
  });
});

describe("segment grammar — DROITE (straight)", () => {
  it("cutLength equals the bar length with no bends/hooks", () => {
    const droite = loadShape("droite");
    const shape = generateBarShape(droite, { L: 3000 }, 20, code);
    expect(shape.cutLength).toBeCloseTo(3000, 6);
    expect(shape.fiche.bends).toHaveLength(0);
    expect(shape.fiche.hooks).toHaveLength(0);
  });
});

describe("segment grammar — manifest authoring guard", () => {
  it("throws when totalLengthExpr disagrees with the generated cut length", () => {
    const bad = { ...loadShape("droite"), totalLengthExpr: "L + 999" };
    expect(() => generateBarShape(bad, { L: 1000 }, 20, code)).toThrow(/totalLengthExpr/);
  });
});
