/**
 * v1.0.6 N5 / Track U4 ([REF-UI-560]) — pure placement helpers (fresh id + build). Headless, no store/DOM
 * (the store router `placeInSection` composes these; the UI is in `tools.spec.tsx`).
 *
 * **v1.0.6-fix R5:** the snap/clamp cases moved to `section_frame.spec.ts` — `snapSection` is gone, and the
 * ONE frame + clamp now lives in `sectionFrame.ts` for all 8 elements. (The old suite asserted that a
 * non-rect section "only grid-snaps, no clamp" — it had the F-D defect written down as a passing test.)
 */
import { describe, it, expect } from "vitest";
import { freshPlacedId, buildPlacedBar } from "./placement";
import { sectionFrame, type SectionFrame } from "./sectionFrame";
import type { SolveResult } from "./solveDoc";
import type { PlacedRowDoc, PlacedBundleDoc, PlacedLayerDoc } from "./document";

/** a RECT frame the way the engine hands it over (column 400 × 600, cover 30). */
const rectFrame = (): SectionFrame =>
  sectionFrame({ member: { envelope: "RECT", length: 3000, b: 400, h: 600, transverse: [] } } as unknown as SolveResult, 30);

describe("freshPlacedId", () => {
  it("returns the first free p{n} slot (reuses a freed middle id)", () => {
    expect(freshPlacedId([])).toBe("p1");
    expect(freshPlacedId([{ id: "p1", u: 0, v: 0, shapeId: "DROITE", diameter: 12 }])).toBe("p2");
    // p2 was removed → p2 is the first free slot again
    expect(
      freshPlacedId([
        { id: "p1", u: 0, v: 0, shapeId: "DROITE", diameter: 12 },
        { id: "p3", u: 0, v: 0, shapeId: "DROITE", diameter: 12 },
      ]),
    ).toBe("p2");
  });
});

describe("buildPlacedBar", () => {
  const base = { id: "p1", u: 40, v: -260, shapeId: "DROITE", diameter: 20, frame: rectFrame() };

  it("single → a free AddressableBar (no kind) at (u,v)", () => {
    const bar = buildPlacedBar("single", base);
    expect((bar as { kind?: string }).kind).toBeUndefined();
    expect(bar).toMatchObject({ id: "p1", u: 40, v: -260, shapeId: "DROITE", diameter: 20 });
  });

  it("row → a counted row across the section width", () => {
    const row = buildPlacedBar("row", base) as PlacedRowDoc;
    expect(row.kind).toBe("row");
    expect(row.direction).toBe("u");
    expect(row.count).toBe(3);
    expect(row.extent).toBe(400 - 2 * 30); // clear width
  });

  it("bundle → a 2-bar bundle at (u,v)", () => {
    const b = buildPlacedBar("bundle", base) as PlacedBundleDoc;
    expect(b.kind).toBe("bundle");
    expect(b.n).toBe(2);
    expect({ u: b.u, v: b.v }).toEqual({ u: 40, v: -260 });
  });

  it("layer → a second layer, face chosen by the v sign (bottom when v<0)", () => {
    const l = buildPlacedBar("layer", base) as PlacedLayerDoc;
    expect(l.kind).toBe("layer");
    expect(l.face).toBe("BOTTOM"); // v = −260 < 0
    expect(l.layerIndex).toBe(2);
    expect((buildPlacedBar("layer", { ...base, v: 200 }) as PlacedLayerDoc).face).toBe("TOP"); // v ≥ 0
  });

  it("R5: the defaults follow the SECTION — a row on a slab spans the slab, not a column", () => {
    const slab = sectionFrame(
      { member: { envelope: "RECT", length: 5000, b: 4000, h: 200, transverse: [] } } as unknown as SolveResult,
      25,
    );
    const row = buildPlacedBar("row", { ...base, frame: slab }) as PlacedRowDoc;
    expect(row.extent).toBe(4000 - 2 * 25); // the band crosses the SLAB's width
  });
});
