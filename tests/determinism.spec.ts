/**
 * Determinism invariant (spec §6, plan P0 non-negotiable #2): the solver is a pure
 * function — same input → byte-identical SolveResult. No Date.now()/Math.random().
 */
import { describe, it, expect } from "vitest";
import { solveColumn } from "@rebarconfig/core";
import type { ColumnSolveInput } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const input = (): ColumnSolveInput => ({
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
  code: makeBaelPack(),
});

describe("determinism", () => {
  it("two solves of the same input are byte-identical", () => {
    const a = solveColumn(input());
    const b = solveColumn(input());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
