/**
 * G2 ([REF-UI-530]) RTL — the bar-by-bar detailing editor: pick a bar on the section picker, remove
 * it (records a `removed` override → the bar drops from the render), and add an independent extra bar.
 * The picker path is the a11y/keyboard equivalent of clicking a slot (both write the same doc data).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { useStore } from "../store/useStore";
import { placeBars } from "@rebarconfig/core";
import { solveDoc } from "../engine/solveDoc";
import type { ColumnDoc } from "../engine/document";

function panelOf(container: HTMLElement) {
  return container.querySelector(".addressable") as HTMLElement;
}

describe("G2 addressable-bars editor", () => {
  beforeEach(() => useStore.getState().reset());

  it("removing the selected bar records a removed override and drops it from the placement", () => {
    const { container } = render(<><Navbar /><Sidebar /></>);
    const panel = panelOf(container);
    // v1.0.6 N2: the section picker moved out of this panel into the ONE shared SectionCanvas; pick a
    // bar there (select mode by default) → this editor targets it via `selectedBars`.
    const canvas = container.querySelector(".section-canvas") as HTMLElement;
    const barBtns = within(canvas).getAllByRole("button").filter((b) => b.classList.contains("sp-list-btn") && !b.classList.contains("sp-list-extra"));
    expect(barBtns.length).toBeGreaterThan(0);
    fireEvent.click(barBtns[0]!);
    const sel = useStore.getState().selectedBars[0]!;

    // the Remove checkbox specifically (H12 added a second, "custom length", checkbox on the bar).
    fireEvent.click(panel.querySelector(".addressable-remove input") as HTMLElement);
    const doc = useStore.getState().doc as ColumnDoc;
    expect(doc.longitudinal.barOverrides?.find((o) => o.index === sel)?.removed).toBe(true);
    expect(placeBars(solveDoc(doc)).some((b) => b.barIndex === sel)).toBe(false);
  });

  it("adds an independent extra bar to the doc", () => {
    const { container } = render(<><Navbar /><Sidebar /></>);
    fireEvent.click(within(panelOf(container)).getByText(/Ajouter une barre|Add a bar/));
    expect((useStore.getState().doc as ColumnDoc).extraBars?.length).toBe(1);
  });
});
