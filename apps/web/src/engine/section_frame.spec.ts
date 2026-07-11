/**
 * v1.0.6-fix R5 / finding F-D — the ONE section frame + cover-envelope clamp, for all 8 elements.
 *
 * The inverted defect assertions:
 *   • a CIRCULAR section is clamped **RADIALLY** — before R5 it got NO clamp at all (`snapSection` skipped
 *     the envelope whenever `b`/`h` were absent, which was exactly the circular case), so a pile bar could
 *     be typed clean outside the concrete and was only reddened afterwards;
 *   • a SLAB frame is its true width × thickness (`Ly × t`), so the six generic elements have a real frame
 *     to draw and clamp against instead of none.
 * Pure — no store, no DOM.
 */
import { describe, it, expect } from "vitest";
import { sectionFrame, clampToFrame, snapToFrame, gridFor } from "./sectionFrame";
import type { SolveResult } from "./solveDoc";

const asResult = (member: Record<string, unknown>) => ({ member } as unknown as SolveResult);

const RECT = asResult({ envelope: "RECT", length: 3000, b: 400, h: 600, transverse: [] });
const SLAB = asResult({ envelope: "RECT", length: 5000, b: 4000, h: 200, transverse: [] });
const CIRC = asResult({ envelope: "CIRCULAR", length: 3000, D: 600, transverse: [] });

describe("sectionFrame — the frame per envelope", () => {
  it("RECT (column/beam) → the b × h box", () => {
    const f = sectionFrame(RECT, 30);
    expect(f.envelope).toBe("RECT");
    expect([f.b, f.h]).toEqual([400, 600]);
    expect(f.D).toBeUndefined();
  });

  it("SLAB-family → width × thickness (Ly × t), at true proportion", () => {
    const f = sectionFrame(SLAB, 25);
    expect([f.b, f.h]).toEqual([4000, 200]); // the frame the six generic elements never had
  });

  it("CIRCULAR → the disc; b/h fall back to D as the bounding box", () => {
    const f = sectionFrame(CIRC, 40);
    expect(f.envelope).toBe("CIRCULAR");
    expect(f.D).toBe(600);
    expect([f.b, f.h]).toEqual([600, 600]);
  });

  it("a 20:1 slab still gets a legible mark (not one wider than the slab is thick)", () => {
    const f = sectionFrame(SLAB, 25);
    expect(f.markRadius * 2).toBeLessThan(200); // a mark must fit inside the thickness
    expect(f.markRadius).toBeGreaterThan(4000 * 0.005); // …and still be visible across a 4 m width
  });
});

describe("clampToFrame — the cover envelope", () => {
  it("RECT: clamps to the buildable box", () => {
    const f = sectionFrame(RECT, 30);
    // half-limits: u = 400/2 − 30 − 20/2 = 160 ; v = 600/2 − 30 − 10 = 260
    expect(clampToFrame(f, 500, -1000, 20)).toEqual({ u: 160, v: -260 });
  });

  it("RECT: a point already inside is untouched", () => {
    const f = sectionFrame(RECT, 30);
    expect(clampToFrame(f, 40, -100, 20)).toEqual({ u: 40, v: -100 });
  });

  it("CIRCULAR: the clamp is RADIAL — the F-D defect, inverted", () => {
    const f = sectionFrame(CIRC, 40);
    const rMax = 600 / 2 - 40 - 20 / 2; // = 250
    const c = clampToFrame(f, 9999, 0, 20);
    expect(c.u).toBeCloseTo(rMax, 6);
    expect(c.v).toBeCloseTo(0, 6);
    // …and the bar is pulled back along its OWN ray, so the direction the user pointed is kept
    const d = clampToFrame(f, 400, 400, 20);
    expect(Math.hypot(d.u, d.v)).toBeCloseTo(rMax, 6);
    expect(d.u).toBeCloseTo(d.v, 6);
  });

  it("CIRCULAR: a box clamp would have LEFT a corner point outside the concrete", () => {
    const f = sectionFrame(CIRC, 40);
    // (250, 250) survives a bounding-box clamp (both axes ≤ 250) but its radius is 353 mm > 250 → outside.
    const c = clampToFrame(f, 250, 250, 20);
    expect(Math.hypot(250, 250)).toBeGreaterThan(250); // the point really is out of the concrete
    expect(Math.hypot(c.u, c.v)).toBeCloseTo(250, 6); // the radial clamp pulls it back in
  });

  it("CIRCULAR: the centre is left alone (no divide-by-zero on r = 0)", () => {
    const f = sectionFrame(CIRC, 40);
    expect(clampToFrame(f, 0, 0, 20)).toEqual({ u: 0, v: 0 });
  });
});

describe("gridFor / snapToFrame — the per-axis snap (owner O-3a)", () => {
  it("a long axis snaps coarse, a short axis stays fine", () => {
    expect(gridFor(400)).toBe(5); // a column's 400 mm
    expect(gridFor(4000)).toBe(25); // a slab's 4 m width
  });

  it("column/beam are unchanged: 5 mm on both axes", () => {
    const f = sectionFrame(RECT, 30);
    expect([f.gridU, f.gridV]).toEqual([5, 5]);
    expect(snapToFrame(f, 97, 12, 20)).toEqual({ u: 95, v: 10 });
  });

  it("a slab snaps 25 mm across its width but keeps 5 mm through its thickness", () => {
    const f = sectionFrame(SLAB, 25);
    expect([f.gridU, f.gridV]).toEqual([25, 5]);
    const s = snapToFrame(f, 1013, 62, 12);
    expect(s.u).toBe(1025); // 25 mm grid on the 4 m axis
    expect(s.v).toBe(60); // 5 mm grid through the 200 mm thickness — where cover actually lives
  });

  it("the clamp wins over the grid — rounding can never push a bar out of the concrete", () => {
    const f = sectionFrame(SLAB, 25);
    const s = snapToFrame(f, 99_999, 99_999, 12);
    const limU = 4000 / 2 - 25 - 6;
    const limV = 200 / 2 - 25 - 6;
    expect(s.u).toBeCloseTo(limU, 6);
    expect(s.v).toBeCloseTo(limV, 6);
  });

  it("a snapped circular drop lands inside the disc (it used to land anywhere at all)", () => {
    const f = sectionFrame(CIRC, 40);
    const s = snapToFrame(f, 9999, -9999, 20);
    expect(Math.hypot(s.u, s.v)).toBeLessThanOrEqual(600 / 2 - 40 - 10 + 1e-9);
  });
});
