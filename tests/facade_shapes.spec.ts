/**
 * F6 — the new multi-bend shape catalog (Z-bar / double-crank / stepped) + the per-end user hook
 * override (spec §6, [REF-SYS-520]). Each manifest must generate a valid centreline whose `cutLength`
 * agrees with its declared `totalLengthExpr` (D-P1-1, the generator throws otherwise). The hook
 * override adds/removes hooks on ANY shape and keeps the cross-check consistent.
 */
import { describe, it, expect } from "vitest";
import { generateShape, generateBarShape } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p3-helpers";

const code = makeBaelPack();
const defaults = (shape: { params: { key: string; default?: number }[] }) =>
  Object.fromEntries(shape.params.map((p) => [p.key, p.default ?? 100]));

describe("F6 new shape manifests generate valid cutLengths", () => {
  for (const id of ["zbar", "double_crank", "stepped"]) {
    it(`${id} generates a centreline + a totalLengthExpr-consistent cutLength`, () => {
      const shape = loadShape(id);
      // generateShape throws if cutLength disagrees with totalLengthExpr → reaching here proves it holds
      const r = generateShape(shape, defaults(shape), 16, code);
      expect(r.centerline3D.length).toBeGreaterThan(6);
      expect(r.cutLength).toBeGreaterThan(0);
      // cutLength = Σ legs + Σ hookExt − Σ bendDeductions; with no hooks ⇒ < Σ legs (bends deducted)
      const legSum = r.fiche.legs.reduce((s, l) => s + l.length, 0);
      expect(r.cutLength).toBeLessThanOrEqual(legSum + 1e-6);
      expect(r.cutLength).toBeGreaterThan(legSum - 200); // deductions are small
    });
  }
});

describe("F6 per-end hook override (any shape, byte-identical when absent)", () => {
  const droite = loadShape("droite");

  it("no override is byte-identical to the legacy straight bar", () => {
    const plain = generateBarShape(droite, { L: 3000 }, 20, code);
    const sameNoOpts = generateBarShape(droite, { L: 3000 }, 20, code, {});
    expect(plain.cutLength).toBe(3000);
    expect(JSON.stringify(sameNoOpts)).toBe(JSON.stringify(plain));
  });

  it("a 135° start hook adds a hook + extends the cut length past the bend deduction", () => {
    const hooked = generateBarShape(droite, { L: 3000 }, 20, code, { hooks: { start: { angle: 135 }, end: "none" } });
    expect(hooked.fiche.hooks).toHaveLength(1);
    expect(hooked.fiche.hooks[0]!.angle).toBe(135);
    // L + hookExt(=10·20=200) − bendDeduction(135°) ⇒ just above 3000
    expect(hooked.cutLength).toBeGreaterThan(3000);
    expect(hooked.cutLength).toBeLessThan(3000 + 200);
  });

  it("both-end hooks add two hooks", () => {
    const both = generateBarShape(droite, { L: 3000 }, 20, code, { hooks: { start: { angle: 90 }, end: { angle: 90 } } });
    expect(both.fiche.hooks).toHaveLength(2);
  });
});
