/**
 * v1.0.4 H19 ([REF-SYS], §H19) — per-leg `min > 0`: the segment-grammar generator rejects a
 * degenerate (non-positive) straight leg. A 0/negative body run is unbuildable and would otherwise
 * slip past the cutLength>0 guard (H3) whenever the other legs compensate. Pure core guard.
 */
import { describe, it, expect } from "vitest";
import { generateBarShape } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();

describe("H19 — reject degenerate (non-positive) legs", () => {
  it("a zero-length straight leg throws (DROITE L=0)", () => {
    expect(() => generateBarShape(loadShape("droite"), { L: 0 }, 20, code)).toThrow(/non-positive leg/i);
  });

  it("a negative leg throws", () => {
    expect(() => generateBarShape(loadShape("droite"), { L: -100 }, 20, code)).toThrow(/non-positive leg/i);
  });

  it("a degenerate leg on a multi-leg shape throws even if the total would be positive", () => {
    // BAIONNETTE has lower/crank/upper runs — zero the lower run; the others keep cutLength > 0.
    expect(() => generateBarShape(loadShape("baionnette"), { lower: 0, crank: 150, upper: 800, angle: 11 }, 20, code)).toThrow(
      /non-positive leg/i,
    );
  });

  it("a valid positive leg still generates", () => {
    expect(generateBarShape(loadShape("droite"), { L: 1000 }, 20, code).cutLength).toBeGreaterThan(0);
  });
});
