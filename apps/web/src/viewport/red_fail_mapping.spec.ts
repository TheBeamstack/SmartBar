/**
 * red_fail_mapping (plan P2): given a FAIL result, the pure viewport mapper marks exactly the
 * affected groups' bars RED — tested on the mapping fn, never on WebGL.
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "../engine/solveDoc";
import { defaultColumnDoc } from "../engine/document";
import { buildScene, failingGroupIds } from "./rebarProps";

describe("FAIL → red bar mapping", () => {
  it("collects affectedGroupIds from FAIL rules only", () => {
    // force a provided_area FAIL by demanding more steel than the section provides.
    const doc = { ...defaultColumnDoc(), longitudinal: { ...defaultColumnDoc().longitudinal, asReq: 50000 } };
    const result = solveDoc(doc);

    expect(result.status).toBe("FAIL");
    expect(failingGroupIds(result)).toContain("L1");
  });

  it("marks the failing group's bars failing=true and leaves passing groups untouched", () => {
    const base = defaultColumnDoc();
    const doc = { ...base, longitudinal: { ...base.longitudinal, asReq: 50000 } };
    const result = solveDoc(doc);
    const scene = buildScene(result, doc, false);

    const longBars = scene.bars.filter((b) => b.groupId === "L1");
    const tieBars = scene.bars.filter((b) => b.groupId === "T1");

    expect(longBars.length).toBeGreaterThan(0);
    expect(longBars.every((b) => b.failing)).toBe(true);
    expect(tieBars.every((b) => b.failing)).toBe(false);
  });

  it("a GREEN result reds nothing", () => {
    const doc = defaultColumnDoc(); // the known-good reference column
    const result = solveDoc(doc);
    const scene = buildScene(result, doc, false);
    expect(scene.bars.some((b) => b.failing)).toBe(false);
  });

  it("selectedGroupIds flags bars selected for highlight", () => {
    const doc = defaultColumnDoc();
    const result = solveDoc(doc);
    const scene = buildScene(result, doc, false, ["T1"]);
    expect(scene.bars.filter((b) => b.groupId === "T1").every((b) => b.selected)).toBe(true);
    expect(scene.bars.filter((b) => b.groupId === "L1").every((b) => b.selected)).toBe(false);
  });
});
