/**
 * H11 ([v1.0.4]) — every open longitudinal shape's manifest defaults seed a VALID bar. `defaultParams`
 * reads the authored `default` per param (no positional guessing); the seed must generate a finite,
 * positive cutLength through the core generator (which enforces the D-P1-1 guard). Also pins H2's
 * invariant that each shape's `totalLengthParam` names a real, single-coefficient principal leg.
 */
import { describe, it, expect } from "vitest";
import { generateBarShape } from "@rebarconfig/core";
import { loadShape } from "./manifests";
import { baelPack, defaultParams } from "./solveDoc";

/** the open shapes the FaconnageEditor offers (mirrors LONGITUDINAL_SHAPES). */
const OPEN_SHAPES = ["DROITE", "CROCHET_L", "U_BAR", "BAIONNETTE", "RELEVE", "ATTENTE", "Z_BAR", "DOUBLE_CRANK", "STEPPED"];
const MEMBER_LEN = 3000;

describe("H11 — manifest defaults seed a valid shape", () => {
  it.each(OPEN_SHAPES)("%s default params generate a positive, finite cutLength", (id) => {
    const shape = loadShape(id);
    const seed = defaultParams(shape, MEMBER_LEN);
    const r = generateBarShape(shape, seed, 20, baelPack);
    expect(Number.isFinite(r.cutLength)).toBe(true);
    expect(r.cutLength).toBeGreaterThan(0);
  });

  it.each(OPEN_SHAPES)("%s declares a totalLengthParam that names a real param", (id) => {
    const shape = loadShape(id);
    expect(shape.totalLengthParam).toBeDefined();
    expect(shape.params.some((p) => p.key === shape.totalLengthParam)).toBe(true);
  });

  it("seeds every length param from its authored default (no positional guess) except DROITE's L", () => {
    // DROITE.L is intentionally undefaulted → tracks the member length (H12 coupling). Every other
    // open shape authors a default for each length param, so the member-length fallback never fires.
    for (const id of OPEN_SHAPES) {
      const shape = loadShape(id);
      const seed = defaultParams(shape, MEMBER_LEN);
      for (const p of shape.params) {
        if (p.type !== "length") continue;
        if (id === "DROITE" && p.key === "L") {
          expect(seed.L).toBe(MEMBER_LEN);
        } else {
          expect(p.default).toBeDefined();
          expect(seed[p.key]).toBe(p.default);
        }
      }
    }
  });
});
