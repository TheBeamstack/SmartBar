/**
 * v1.0.6 N4 / Track U1 ([REF-UI-830]) — the drawing-board workspace shell. The live 3D stays central
 * and always-on; a **section dock** (pick canvas + coupe, subsuming the old Coupes bottom dock) and an
 * **elevation dock** (read-only longitudinal view) flank it, each resizable + collapsible. Layout state
 * is session-only, NOT in `.rcfg`.
 *
 * The 3D Canvas itself is WebGL (owner-GPU-verified, headless can't drive it), so — like the other
 * viewport specs — this exercises the DOCK surfaces + the store dock actions + the persistence
 * guarantee headlessly (no `<Viewport>`/Canvas here).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { SectionDock } from "./SectionDock";
import { ElevationDock } from "./ElevationDock";
import { useStore } from "../store/useStore";
import { projectToRcfg } from "../engine/projectRcfg";

describe("v1.0.6 U1 — workspace shell docks", () => {
  beforeEach(() => useStore.getState().reset());

  it("both editable 2D docks mount around the 3D (section + elevation)", () => {
    const { container } = render(<><SectionDock /><ElevationDock /></>);
    expect(container.querySelector(".section-dock")).toBeInTheDocument();
    expect(container.querySelector(".elevation-dock")).toBeInTheDocument();
    // the section dock subsumes the coupe (its preview) + hosts the ONE pick canvas (column default)
    expect(container.querySelector(".section-dock .section-canvas")).toBeInTheDocument();
    expect(container.querySelector(".section-dock .coupe-panel")).toBeInTheDocument();
  });

  it("a dock collapses to a re-open strip and re-opens (open flag + body toggle)", () => {
    const { container, rerender } = render(<SectionDock />);
    expect(useStore.getState().docks.section.open).toBe(true);
    expect(container.querySelector(".section-dock")).toBeInTheDocument();

    // collapse via the header button
    fireEvent.click(container.querySelector(".dock-collapse")!);
    expect(useStore.getState().docks.section.open).toBe(false);
    rerender(<SectionDock />);
    expect(container.querySelector(".section-dock")).toBeNull(); // the panel body is gone
    const reopen = container.querySelector(".dock-reopen") as HTMLElement;
    expect(reopen).toBeInTheDocument();

    // re-open from the strip
    fireEvent.click(reopen);
    expect(useStore.getState().docks.section.open).toBe(true);
  });

  it("a dock resizes (store size + inline style), floored at a usable minimum", () => {
    const { container, rerender } = render(<SectionDock />);
    act(() => useStore.getState().resizeDock("section", 420));
    rerender(<SectionDock />);
    expect(useStore.getState().docks.section.size).toBe(420);
    expect((container.querySelector(".section-dock") as HTMLElement).style.width).toBe("420px");

    // a too-small drag is clamped to the min floor (kept usable)
    act(() => useStore.getState().resizeDock("section", 10));
    expect(useStore.getState().docks.section.size).toBe(120);

    // the elevation dock sizes by HEIGHT
    act(() => useStore.getState().resizeDock("elevation", 260));
    expect(useStore.getState().docks.elevation.size).toBe(260);
  });

  it("the elevation dock renders an EDITABLE longitudinal canvas (Track U5 / N6)", () => {
    const { container } = render(<ElevationDock />);
    // N4 shipped this read-only; N6 makes it a drag canvas over the per-bar station model — the note
    // now carries the edit hint and the svg is the editable variant (`.elevation-svg-edit`).
    expect(container.querySelector(".dock-note")).toBeInTheDocument();
    expect(container.querySelector(".elevation-svg-edit")).toBeInTheDocument();
  });

  it("dock layout state is session-only — NEVER serialized into `.rcfg`", () => {
    // give the docks a distinctive, non-default state
    act(() => {
      useStore.getState().toggleDock("elevation"); // collapse it
      useStore.getState().resizeDock("section", 411);
    });
    const { instances, doc, result } = useStore.getState();
    const rcfg = projectToRcfg(instances, {}, { [useStore.getState().activeInstanceId]: result });
    const json = JSON.stringify(rcfg);
    // the document is untouched by looking at it, and no dock/layout key rides the file (§0.3.5)
    expect(json).not.toContain("docks");
    expect(json).not.toContain("sectionDock");
    expect(json).not.toContain("elevationDock");
    // sanity: the doc itself is unchanged by dock edits
    expect(useStore.getState().doc).toBe(doc);
  });
});
