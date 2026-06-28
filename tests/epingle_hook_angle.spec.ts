/**
 * F2 ([REF-SYS-756]) — the cross-tie editor sets ONE hook angle for all épingles of an element. The
 * generator honours an optional `hook_angle` param (overriding the manifest's end-hook angle) while
 * keeping the `cutLength = Σ legs + Σ hookExt − Σ bendDeduction` invariant + the `totalLengthExpr`
 * cross-check (D-P1-1). A shape that does NOT pass `hook_angle` is byte-identical to before.
 */
import { describe, it, expect } from "vitest";
import { generateBarShape } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const epingle = loadShape("epingle");

describe("épingle hook-angle override (F2)", () => {
  it("omitting hook_angle == the manifest default (135) — generation unchanged", () => {
    const def = generateBarShape(epingle, { span: 250 }, 8, code);
    const explicit = generateBarShape(epingle, { span: 250, hook_angle: 135 }, 8, code);
    expect(explicit.cutLength).toBeCloseTo(def.cutLength, 6);
  });

  it("a different hook angle changes the hook bends but never throws (totalLengthExpr cross-check holds)", () => {
    const a90 = generateBarShape(epingle, { span: 250, hook_angle: 90 }, 8, code);
    const a135 = generateBarShape(epingle, { span: 250, hook_angle: 135 }, 8, code);
    // both end hooks reflect the chosen angle in the fiche
    expect(a90.fiche.hooks.every((h) => h.angle === 90)).toBe(true);
    expect(a135.fiche.hooks.every((h) => h.angle === 135)).toBe(true);
    // 90° vs 135° bends deduct differently → cutLengths differ (the editor really drives geometry)
    expect(a90.cutLength).not.toBeCloseTo(a135.cutLength, 3);
  });
});
