/**
 * H7 ([v1.0.4]) — independent extra bars are visible + selectable on the 2D section picker. They live
 * in `result.longBars` (not the layout `bars`), so the picker renders them separately by their stable
 * id; picking one sets `selectedExtraId` (mutually exclusive with the layout-bar `selectedBars`) and
 * highlights its editor. Picker + keyboard-list parity (a11y invariant).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { SectionDock } from "./SectionDock";
import { useStore } from "../store/useStore";

describe("H7 — extras on the section picker", () => {
  beforeEach(() => useStore.getState().reset());

  it("renders a pickable entry for each independent extra bar; picking it selects by id", () => {
    const { container } = render(<><Navbar /><Sidebar /><SectionDock /></>);
    const panel = () => container.querySelector(".addressable") as HTMLElement;
    // v1.0.6 N2: extras are added from the panel but PICKED on the ONE shared SectionCanvas.
    const canvas = () => container.querySelector(".section-canvas") as HTMLElement;
    fireEvent.click(within(panel()).getByText(/Ajouter une barre|Add a bar/)); // → extra "x1"

    // the shared canvas's keyboard list now carries an "x1" button (dashed extra style)
    const x1Btn = within(canvas()).getAllByRole("button").find((b) => b.classList.contains("sp-list-extra") && b.textContent === "x1");
    expect(x1Btn).toBeDefined();

    fireEvent.click(x1Btn!);
    expect(useStore.getState().selectedExtraId).toBe("x1");
    expect(useStore.getState().selectedBars).toEqual([]); // mutually exclusive with layout-bar selection

    // its editor <li> is now highlighted (aria-current)
    const selectedLi = panel().querySelector(".addressable-extra-selected");
    expect(selectedLi).not.toBeNull();
    expect(within(selectedLi as HTMLElement).getByText(/x1/)).toBeInTheDocument();
  });

  it("selecting a layout bar clears the extra selection", () => {
    const { container } = render(<><Navbar /><Sidebar /><SectionDock /></>);
    const panel = () => container.querySelector(".addressable") as HTMLElement;
    const canvas = () => container.querySelector(".section-canvas") as HTMLElement;
    fireEvent.click(within(panel()).getByText(/Ajouter une barre|Add a bar/));
    useStore.getState().setSelectedExtraId("x1");

    const layoutBtn = within(canvas()).getAllByRole("button").find((b) => b.classList.contains("sp-list-btn") && !b.classList.contains("sp-list-extra"))!;
    fireEvent.click(layoutBtn);
    expect(useStore.getState().selectedExtraId).toBeNull();
    expect(useStore.getState().selectedBars.length).toBe(1);
  });
});
