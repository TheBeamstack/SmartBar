/**
 * A3 ([v1.0.4], core_logic §8) — "picking a code re-runs the checks; BAEL↔EC2 changes only the
 * numbers, not the structure." The engine never imports a pack (D-P1-3), so swapping the pack must
 * keep the layout/groups/shapes/rule-set identical while the sourced constants (and thus verdicts'
 * numbers) can differ. This pins both halves: structure invariant + the two packs are genuinely
 * distinct (so the pick is not vacuous).
 */
import { describe, it, expect } from "vitest";
import { solveDoc, packFor } from "./solveDoc";
import { defaultColumnDoc, type ColumnDoc } from "./document";

const solveWith = (cp: "BAEL" | "EC2") =>
  solveDoc({ ...defaultColumnDoc(), codePack: cp } as ColumnDoc);

describe("A3 — BAEL↔EC2 changes the numbers, not the structure", () => {
  it("solves to an identical structure under either pack", () => {
    const rB = solveWith("BAEL");
    const rE = solveWith("EC2");
    expect(rE.bars.length).toBe(rB.bars.length);
    expect(rE.member.envelope).toBe(rB.member.envelope);
    expect(rE.groups.map((g) => g.groupId)).toEqual(rB.groups.map((g) => g.groupId));
    expect(rE.groups.map((g) => g.count)).toEqual(rB.groups.map((g) => g.count));
    // the same checks run (same rule keys), only their values may move
    expect(rE.validation.map((v) => v.rule).sort()).toEqual(rB.validation.map((v) => v.rule).sort());
  });

  it("the two packs are genuinely distinct (reachable, not aliased)", () => {
    const bael = packFor("BAEL");
    const ec2 = packFor("EC2");
    expect(bael.codeRef).not.toBe(ec2.codeRef);
    // a real numeric rule differs: min tie Ø is φℓ/3 (BAEL) vs φℓ/4 (EC2)
    expect(bael.tieDiameterMin(25)).not.toBeCloseTo(ec2.tieDiameterMin(25), 3);
  });
});
