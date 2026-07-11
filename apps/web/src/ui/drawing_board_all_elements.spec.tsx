/**
 * v1.0.6-fix **R5 (finding F-D)** — the drawing-board on all 8 elements.
 *
 * `v1.0.6_spec` U4 promised the tool + palette *"work on all 8 elements"*, and §9's definition of complete
 * was *"a tool palette places any shape/row/bundle/layer on **any of the 8 elements**; selecting anything
 * opens a contextual inspector."* As built, `SectionDock` rendered the `SectionCanvas` only for
 * `isColumnDoc || isBeamDoc`: on slab ×2 / joist / stair / circular column / pile there was **no canvas** —
 * placement was two numeric boxes with no visual frame, and `snapSection`, handed no `b`/`h`, **silently
 * skipped the cover clamp entirely** (a pile bar could be typed clean outside the concrete).
 *
 * R5 generalises by **section descriptor** (`result.member` → `sectionFrame`), never by element. These
 * tests run the REAL store: for each of the 8, the canvas mounts, a bar places at a CLAMPED coordinate,
 * clicking it opens the inspector, and a station edit reaches `doc.placed` — the R2 chain, on every element.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SectionDock } from "./SectionDock";
import { Inspector } from "./Inspector";
import { useStore } from "../store/useStore";
import { sectionFrame } from "../engine/sectionFrame";
import type { ElementId, PlacedBarDoc } from "../engine/document";

const S = () => useStore.getState();
const placedOf = () => ((S().doc as { placed?: PlacedBarDoc[] }).placed ?? []);

/** every element in the catalog — the two RECT ones plus the six that had no drawing-board at all. */
const ALL_8: ElementId[] = [
  "E-COL-01", // rectangular tied column   (had a canvas)
  "E-BEM-01", // rectangular beam           (had a canvas)
  "E-COL-02", // circular spiral column     ← no canvas, and NO cover clamp
  "E-FND-01", // drilled-shaft pile         ← no canvas, and NO cover clamp
  "E-SLB-01", // one-way slab               ← no canvas
  "E-SLB-02", // two-way slab               ← no canvas
  "E-SLB-03", // hollow-block joist slab    ← no canvas
  "E-STR-01", // straight-flight stair      ← no canvas
];

describe("R5 / F-D — the drawing-board exists on all 8 elements", () => {
  beforeEach(() => {
    S().reset();
    cleanup();
  });

  it.each(ALL_8)("%s: the section canvas mounts", (element) => {
    S().selectElement(element);
    render(<SectionDock />);
    // the editable section canvas (not the CoupePanel's read-only preview, which always existed)
    expect(screen.getByRole("img", { name: /sélecteur de barres/i })).toBeTruthy();
  });

  it.each(ALL_8)("%s: a placed bar renders, selects into the inspector, and a station edit commits", (element) => {
    S().selectElement(element);
    S().setSectionTool("add-single");
    S().placeInSection(20, 10);

    const placed = placedOf();
    expect(placed).toHaveLength(1);
    const id = (placed[0] as { id: string }).id;

    // it is real steel the engine resolved (drawn == scheduled == validated, on every element)
    expect((S().result.longBars ?? []).some((b) => b.groupId.split("#")[0] === id)).toBe(true);

    // selecting it opens the contextual inspector on THIS element (R2's channel, un-gated)
    S().select({ kind: "placed", id });
    render(<Inspector />);
    expect(screen.queryByText(/Sélectionnez une barre|Select a bar/i)).toBeNull();

    // …and an N6 station edit reaches doc.placed rather than silently no-op'ing
    S().curtailSelectedBar("end", 500);
    expect((placedOf()[0] as { endStation?: number }).endStation).toBe(500);
  });

  it.each(ALL_8)("%s: a bar pointed far outside the concrete is CLAMPED into the cover envelope", (element) => {
    S().selectElement(element);
    S().setSectionTool("add-single");
    S().placeInSection(9_999, 9_999); // point way off the section

    const { doc, result } = S();
    const frame = sectionFrame(result, doc.cover);
    const bar = placedOf()[0] as { u: number; v: number };
    const dia = S().paletteDiameter;

    if (frame.envelope === "CIRCULAR") {
      // the radial clamp — before R5 a circular section got NO clamp at all (the F-D defect)
      expect(Math.hypot(bar.u, bar.v)).toBeLessThanOrEqual((frame.D ?? 0) / 2 - doc.cover - dia / 2 + 1e-6);
    } else {
      expect(Math.abs(bar.u)).toBeLessThanOrEqual(frame.b / 2 - doc.cover - dia / 2 + 1e-6);
      expect(Math.abs(bar.v)).toBeLessThanOrEqual(frame.h / 2 - doc.cover - dia / 2 + 1e-6);
    }
  });

  it.each(ALL_8)("%s: the a11y twin — the typed (u,v) + Place commits the same bar as the pointer drop", (element) => {
    S().selectElement(element);
    S().setSectionTool("add-single");
    render(<SectionDock />);

    // the typed coordinate is the keyboard/precision path (invariant §0.3.3); the canvas click is the GPU one
    fireEvent.change(screen.getByLabelText("u"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("v"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /placer|place/i }));

    expect(placedOf()).toHaveLength(1);
  });
});

describe("R5 — element-appropriate semantics (not a flattened one-size canvas)", () => {
  beforeEach(() => {
    S().reset();
    cleanup();
  });

  it("owner O-3b: a slab opens on the BAND tool; a column still opens on select", () => {
    S().selectElement("E-SLB-01");
    expect(S().sectionTool).toBe("add-row");
    S().selectElement("E-SLB-03"); // joist — same family
    expect(S().sectionTool).toBe("add-row");
    S().selectElement("E-COL-01");
    expect(S().sectionTool).toBe("select");
    S().selectElement("E-FND-01"); // a pile is not a slab
    expect(S().sectionTool).toBe("select");
  });

  it("owner O-3a: a slab snaps coarse across its 4 m width but fine through its thickness", () => {
    S().selectElement("E-SLB-01");
    const frame = sectionFrame(S().result, S().doc.cover);
    expect(frame.gridU).toBe(25); // the wide axis
    expect(frame.gridV).toBe(5); // the thickness — where cover lives
  });

  it("owner O-3c: a LAYER on a pile places a real inner ring (it used to place NOTHING)", () => {
    S().selectElement("E-FND-01");
    S().setSectionTool("add-layer");
    S().placeInSection(0, 100);

    const id = (placedOf()[0] as { id: string }).id;
    const bars = (S().result.longBars ?? []).filter((b) => b.groupId.split("#")[0] === id);
    expect(bars.length).toBeGreaterThan(0); // ← zero before R5, silently

    // they sit on ONE concentric circle (the radial layer), not on a face
    const radii = bars.map((b) => Math.hypot(b.position.u, b.position.v));
    for (const r of radii) expect(r).toBeCloseTo(radii[0]!, 6);
  });

  it("a slab's per-metre mat is NOT clickable — it has no addressable channel to commit into", () => {
    S().selectElement("E-SLB-01");
    render(<SectionDock />);
    // no native-bar buttons: offering a click that could not commit anything is invariant 8's dead end.
    expect(screen.queryByRole("button", { name: /^B\d+$/ })).toBeNull();
  });

  it("a column's native bars ARE clickable — the RECT addressable channel is untouched (no regression)", () => {
    S().selectElement("E-COL-01");
    render(<SectionDock />);
    expect(screen.queryAllByRole("button", { name: /^[TBLR]\d+$/ }).length).toBeGreaterThan(0);
  });
});
