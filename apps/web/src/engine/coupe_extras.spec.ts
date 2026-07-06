/**
 * H7 ([v1.0.4]) — the coupe (section view) shows independent extra bars at their section level. The
 * coupe is built by `sectionAt` over `placeBars(result)`, which already includes the standalone
 * `longBars`; this pins that an extra crossing the cut appears, tagged with its own id. (The 3D + PDF
 * coupe share this same engine, so they agree.)
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "./solveDoc";
import { defaultColumnDoc } from "./document";
import { sectionAt, defaultCoupeFor } from "@rebarconfig/core";

describe("H7 — coupe shows extras", () => {
  it("an axial extra bar appears in the default coupe, tagged with its id + Ø", () => {
    const doc = defaultColumnDoc();
    doc.extraBars = [{ id: "x1", u: 60, v: -120, shapeId: "DROITE", diameter: 12, length: doc.geometry.H }];
    const result = solveDoc(doc);
    const view = sectionAt(result, defaultCoupeFor(result));
    // a DROITE extra runs along the member axis → the perpendicular mid-height cut crosses it → a
    // circle carrying the extra's id (not a layout-group id).
    const c = view.circles.find((x) => x.groupId === "x1");
    expect(c).toBeDefined();
    expect(c!.diameter).toBe(12);
  });

  it("no extras → no extra circles (legacy coupe unchanged)", () => {
    const result = solveDoc(defaultColumnDoc());
    const view = sectionAt(result, defaultCoupeFor(result));
    expect(view.circles.some((x) => x.groupId === "x1")).toBe(false);
  });
});
