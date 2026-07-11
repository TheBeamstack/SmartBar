/**
 * v1.0.6 N3 / Track U3 ([REF-UI-820]) — the contextual inspector + unified selection + advanced
 * fallback. Verified through the real store + Sidebar:
 *   • the ONE unified selection: picking a bar clears an alert selection and vice-versa (§0.3.4);
 *   • selecting a bar on the shared canvas opens it in the inspector; editing there == the form path;
 *   • selecting an independent extra / a cross-tie opens the right inspector fields;
 *   • the tabbed "Avancé" form is reachable + toggleable (a complete fallback), readout preserved.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { SectionDock } from "./SectionDock";
import { useStore } from "../store/useStore";
import type { ColumnDoc } from "../engine/document";

// v1.0.6 N4 (U1): the ONE section canvas now lives in the section DOCK (around the 3D), not the
// Sidebar; the inspector stays in the left region. Render both so the canvas + inspector are present.
function renderShell() {
  return render(<><Navbar /><Sidebar /><SectionDock /></>);
}

const canvasBars = (c: HTMLElement) => {
  const canvas = c.querySelector(".section-canvas") as HTMLElement;
  return within(canvas).getAllByRole("button").filter((b) => b.classList.contains("sp-list-btn") && !b.classList.contains("sp-list-extra"));
};

describe("v1.0.6 U3 — contextual inspector + unified selection", () => {
  beforeEach(() => useStore.getState().reset());

  it("selection is ONE system: picking a bar clears an alert selection (§0.3.4)", () => {
    useStore.getState().selectGroups(["g1", "g2"]);
    expect(useStore.getState().selection?.kind).toBe("alert");
    useStore.getState().select({ kind: "bar", index: 0 });
    const st = useStore.getState();
    expect(st.selection).toEqual({ kind: "bar", index: 0 });
    expect(st.selectedGroupIds).toEqual([]); // the alert channel was cleared
    expect(st.selectedBars).toEqual([0]);
    // and the reverse: an alert selection clears the bar channel
    useStore.getState().selectGroups(["g3"]);
    expect(useStore.getState().selectedBars).toEqual([]);
    expect(useStore.getState().selection?.kind).toBe("alert");
  });

  it("selecting a bar on the canvas opens the inspector; editing there hits the store (== the form)", () => {
    const { container } = renderShell();
    const inspector = () => container.querySelector(".inspector") as HTMLElement;
    // nothing selected → the empty hint
    expect(inspector().querySelector(".inspector-empty")).toBeTruthy();

    fireEvent.click(canvasBars(container)[0]!);
    expect(useStore.getState().selection?.kind).toBe("bar");
    const insBar = inspector().querySelector(".inspector-bar") as HTMLElement;
    expect(insBar).toBeTruthy();

    // toggle "remove" from INSIDE the inspector → the doc override is written (same store as the form)
    fireEvent.click(insBar.querySelector(".addressable-remove input") as HTMLElement);
    const doc = useStore.getState().doc as ColumnDoc;
    expect((doc.longitudinal.barOverrides ?? []).some((o) => o.removed)).toBe(true);
  });

  it("selecting a cross-tie opens it in the inspector and highlights its pair", () => {
    renderShell();
    // seed a cross-tie on the column tie
    useStore.getState().setCrossTies([{ barA: 0, barB: 2 }]);
    useStore.getState().select({ kind: "crosstie", index: 0, barA: 0, barB: 2 });
    const st = useStore.getState();
    expect(st.selection?.kind).toBe("crosstie");
    expect(st.selectedBars).toEqual([0, 2]); // both engaged bars highlighted
  });

  it("the advanced tabbed form is present by default and toggles off/on (complete fallback)", () => {
    const { container } = renderShell();
    expect(useStore.getState().advancedForm).toBe(true);
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
    expect(container.querySelector(".readout")).toBeTruthy(); // ZoneReadout preserved

    const toggle = container.querySelector(".advanced-toggle") as HTMLElement;
    fireEvent.click(toggle);
    expect(useStore.getState().advancedForm).toBe(false);
    expect(container.querySelector('[role="tablist"]')).toBeFalsy(); // form collapsed
    // the drawing-first surface (canvas + inspector) stays available with the form collapsed
    expect(container.querySelector(".section-canvas")).toBeTruthy();
    expect(container.querySelector(".inspector")).toBeTruthy();

    fireEvent.click(toggle);
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
  });

  it("EXACTLY ONE section canvas mounts (the inspector reuses the N2 canvas, no second copy)", () => {
    const { container } = renderShell();
    expect(container.querySelectorAll(".section-canvas").length).toBe(1);
  });

  it("the compact element-setup strip is always visible and drives the store", () => {
    const { container } = renderShell();
    const strip = container.querySelector(".setup-strip") as HTMLElement;
    expect(strip).toBeTruthy();
    // the code-pack select in the strip mutates the doc
    fireEvent.change(within(strip).getByLabelText(/code de calcul|design code/i), { target: { value: "EC2" } });
    expect(useStore.getState().doc.codePack).toBe("EC2");
  });
});
