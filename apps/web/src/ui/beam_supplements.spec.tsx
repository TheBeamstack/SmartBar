/**
 * RTL smoke (plan P3): the catalog drives the UI — switching to the beam reveals beam controls,
 * and a supplement can be added by typing bar indices (the keyboard/a11y binding path, §8).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { useStore } from "../store/useStore";
import { type ColumnDoc } from "../engine/document";

function renderApp() {
  return render(
    <>
      <Navbar />
      <Sidebar />
    </>,
  );
}

describe("P3 catalog + supplements UI", () => {
  beforeEach(() => useStore.getState().reset());

  it("switching the element to the beam reveals beam-specific controls", () => {
    renderApp();
    // column (SYMMETRIC default) shows the two merged-face counts (§6.1/§8 [REF-UI-815])
    expect(screen.getByText(/faces verticales/)).toBeInTheDocument();

    const elementSelect = screen.getByLabelText("Élément");
    fireEvent.change(elementSelect, { target: { value: "E-BEM-01" } });

    expect(useStore.getState().doc.element).toBe("E-BEM-01");
    // beam shows span-steel + the two support (V1/V2) controls instead
    expect(screen.getByText(/Aciers de travée/)).toBeInTheDocument();
    expect(screen.getByText(/Appui V1/)).toBeInTheDocument();
    expect(screen.getByText(/Appui V2/)).toBeInTheDocument();
  });

  it("adds an épingle by clicking two bars in the F2 cross-tie picker (a11y list path)", () => {
    const { container } = renderApp();
    // v1.0.3 G5: épingles are added through the ONE cross-tie model (the cross-tie editor's section
    // picker), not the legacy supplement path. Click two distinct bar buttons to link a pair.
    const editor = container.querySelector(".crosstie-editor") as HTMLElement;
    const barButtons = within(editor).getAllByRole("button").filter((b) => b.classList.contains("sp-list-btn"));
    expect(barButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(barButtons[0]!);
    fireEvent.click(barButtons[barButtons.length - 1]!);

    const doc = useStore.getState().doc as ColumnDoc;
    expect(doc.tie.crossTies).toHaveLength(1);
    // it binds two STABLE bar indices (D-P3-4), distinct
    expect(doc.tie.crossTies[0]!.barA).not.toBe(doc.tie.crossTies[0]!.barB);
  });

  it("the expert toggle reveals the resolved bar-group list", () => {
    const { container } = renderApp();
    expect(screen.queryByText(/Liste des armatures/)).toBeNull();
    fireEvent.click(screen.getByText("Mode expert"));
    expect(screen.getByText(/Liste des armatures/)).toBeInTheDocument();
    // the column's longitudinal + tie groups are listed (scope to the expert list — bar labels
    // like "T1" also appear in the F7 picker, so query within the resolved-groups list).
    const expertList = container.querySelector(".group-list") as HTMLElement;
    expect(within(expertList).getByText("L1")).toBeInTheDocument();
    expect(within(expertList).getByText("T1")).toBeInTheDocument();
  });
});
