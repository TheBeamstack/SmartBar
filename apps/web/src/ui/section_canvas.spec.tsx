/**
 * v1.0.6 N2 / Track U2 ([REF-UI-555]) — the ONE unified section canvas + tool-mode routing. Before N2
 * the section picker was embedded three times (bar-by-bar / cross-tie / supplement); now there is a
 * single canvas whose active tool decides what a bar click means. Verified through the real store:
 *   • exactly one canvas mounts in the (column) Sidebar;
 *   • SELECT routes a click to `selectedBars` (the addressable-bar target);
 *   • LINK (armed by a panel) routes two clicks to a cross-tie / a bound supplement;
 *   • Esc / cancel returns to select; the keyboard list is the a11y twin (same routing).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { SectionDock } from "./SectionDock";
import { useStore } from "../store/useStore";
import type { ColumnDoc } from "../engine/document";

// v1.0.6 N4 (U1): the ONE section canvas moved into the section DOCK (around the 3D). The arming
// buttons (cross-tie / supplement "link") stay in the Sidebar advanced form; both share the store.
const renderShell = () => render(<><Navbar /><Sidebar /><SectionDock /></>);

const canvasOf = (c: HTMLElement) => c.querySelector(".section-canvas") as HTMLElement;
const barButtons = (c: HTMLElement) =>
  within(canvasOf(c)).getAllByRole("button").filter((b) => b.classList.contains("sp-list-btn") && !b.classList.contains("sp-list-extra"));

describe("v1.0.6 U2 — unified section canvas + tool routing", () => {
  // R6 (O-4/A-8): advancedForm defaults OFF now; the cross-tie/supplement "link" arm buttons live in the
  // advanced-form panels, so this suite opts into it (the canvas itself is always visible).
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().setAdvancedForm(true);
  });

  it("mounts EXACTLY ONE section canvas in the column Sidebar (the three embedded pickers retired)", () => {
    const { container } = renderShell();
    expect(container.querySelectorAll(".section-canvas").length).toBe(1);
    expect(container.querySelectorAll(".section-picker").length).toBe(1);
  });

  it("SELECT tool: clicking a bar sets selectedBars and stays in select mode", () => {
    const { container } = renderShell();
    expect(useStore.getState().sectionTool).toBe("select");
    fireEvent.click(barButtons(container)[0]!);
    expect(useStore.getState().selectedBars.length).toBe(1);
    expect(useStore.getState().sectionTool).toBe("select");
  });

  it("LINK (cross-tie): arming from the editor routes two clicks on the canvas into a cross-tie", () => {
    const { container } = renderShell();
    const editor = container.querySelector(".crosstie-editor") as HTMLElement;
    fireEvent.click(within(editor).getByRole("button", { name: /Lier deux barres|Link two bars/ }));
    expect(useStore.getState().sectionTool).toBe("link");

    const bars = barButtons(container);
    fireEvent.click(bars[0]!);
    fireEvent.click(bars[bars.length - 1]!);
    const doc = useStore.getState().doc as ColumnDoc;
    expect(doc.tie.crossTies).toHaveLength(1);
    expect(doc.tie.crossTies[0]!.barA).not.toBe(doc.tie.crossTies[0]!.barB);
    // re-clicking the same first bar de-selects rather than self-linking
    expect(useStore.getState().pendingLinkBar).toBeNull();
  });

  it("LINK (supplement): the store router binds the armed supplement to the two picked bars", () => {
    renderShell();
    const st = useStore.getState();
    st.beginLink({ kind: "supplement", supplementId: "SUPP_DIAMANT_TIE", diameter: 8 });
    expect(useStore.getState().sectionTool).toBe("link");
    st.pickSectionBar(0);
    st.pickSectionBar(2);
    const sup = useStore.getState().doc.supplements;
    expect(sup).toHaveLength(1);
    expect(sup[0]!.supplementId).toBe("SUPP_DIAMANT_TIE");
    expect(sup[0]!.barIndices).toEqual([0, 2]);
    expect(sup[0]!.diameter).toBe(8);
  });

  it("Esc on the canvas cancels an armed link and returns to select", () => {
    const { container } = renderShell();
    // arm through the editor button (flushes the re-render so the canvas is in link mode)
    const editor = container.querySelector(".crosstie-editor") as HTMLElement;
    fireEvent.click(within(editor).getByRole("button", { name: /Lier deux barres|Link two bars/ }));
    expect(useStore.getState().sectionTool).toBe("link");

    fireEvent.keyDown(canvasOf(container), { key: "Escape" });
    expect(useStore.getState().sectionTool).toBe("select");
    expect(useStore.getState().sectionLink).toBeNull();
    expect(useStore.getState().pendingLinkBar).toBeNull();
  });

  it("a11y parity: the keyboard list is the same one canvas and routes identically", () => {
    const { container } = renderShell();
    // the list buttons live inside the single canvas (not scattered across three panels)
    expect(within(canvasOf(container)).getAllByRole("button").some((b) => b.classList.contains("sp-list-btn"))).toBe(true);
    fireEvent.click(barButtons(container)[0]!);
    expect(useStore.getState().selectedBars.length).toBe(1);
  });
});
