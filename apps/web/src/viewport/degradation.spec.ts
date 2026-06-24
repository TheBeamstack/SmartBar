/**
 * degradation (plan P2, spec §2.2): the drag-mode flag switches the viewport builder from tubes
 * to centreline lines and defers validation; releasing the drag restores full fidelity.
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "../engine/solveDoc";
import { defaultColumnDoc } from "../engine/document";
import { buildScene, viewportDirectives } from "./rebarProps";

describe("performance degradation path", () => {
  it("drag-mode → lines + deferred validation; commit → tubes + live", () => {
    expect(viewportDirectives(true)).toEqual({ geometry: "lines", validation: "deferred" });
    expect(viewportDirectives(false)).toEqual({ geometry: "tubes", validation: "live" });
  });

  it("buildScene honours the drag flag for render mode", () => {
    const doc = defaultColumnDoc();
    const result = solveDoc(doc);
    expect(buildScene(result, doc, true).mode).toBe("lines");
    expect(buildScene(result, doc, false).mode).toBe("tubes");
  });

  it("the geometry itself is identical across modes (only the render representation changes)", () => {
    const doc = defaultColumnDoc();
    const result = solveDoc(doc);
    const dragged = buildScene(result, doc, true);
    const committed = buildScene(result, doc, false);
    expect(dragged.bars.map((b) => b.points)).toEqual(committed.bars.map((b) => b.points));
  });
});
