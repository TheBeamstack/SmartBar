/**
 * H3 ([v1.0.4]) — the positive-finite cutLength guard lives in the core generator, so BBS / DXF /
 * splice are all protected (not just the editor, D-P1-1). A degenerate param set (zero or negative
 * length) that passes the totalLengthExpr cross-check is still rejected.
 */
import { describe, it, expect } from "vitest";
import { generateBarShape } from "@rebarconfig/core";
import { loadShape } from "./manifests";
import { baelPack } from "./solveDoc";

describe("H3 — core rejects a non-positive cutLength", () => {
  const droite = () => loadShape("DROITE");

  it("throws on a zero length", () => {
    expect(() => generateBarShape(droite(), { L: 0 }, 20, baelPack)).toThrow(/cut length/i);
  });

  it("throws on a negative length", () => {
    expect(() => generateBarShape(droite(), { L: -50 }, 20, baelPack)).toThrow(/cut length/i);
  });

  it("still generates a valid positive length", () => {
    expect(generateBarShape(droite(), { L: 1500 }, 20, baelPack).cutLength).toBeCloseTo(1500, 3);
  });
});
