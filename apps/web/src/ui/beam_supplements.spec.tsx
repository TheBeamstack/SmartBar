/**
 * RTL smoke (plan P3): the catalog drives the UI — switching to the beam reveals beam controls,
 * and a supplement can be added by typing bar indices (the keyboard/a11y binding path, §8).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { SectionDock } from "./SectionDock";
import { useStore } from "../store/useStore";
import { type ColumnDoc } from "../engine/document";

function renderApp() {
  // v1.0.6 N4 (U1): the ONE section canvas lives in the section DOCK now (not the Sidebar).
  return render(
    <>
      <Navbar />
      <Sidebar />
      <SectionDock />
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

  it("adds an épingle by arming cross-tie link then clicking two bars on the shared canvas", () => {
    const { container } = renderApp();
    // v1.0.6 N2 (U2): the cross-tie editor no longer embeds its own picker. Arm "link two bars" (routes
    // the ONE shared SectionCanvas to cross-tie mode), then click two distinct bars there.
    const editor = container.querySelector(".crosstie-editor") as HTMLElement;
    fireEvent.click(within(editor).getByRole("button", { name: /Lier deux barres|Link two bars/ }));
    expect(useStore.getState().sectionTool).toBe("link");

    const canvas = container.querySelector(".section-canvas") as HTMLElement;
    const barButtons = within(canvas).getAllByRole("button").filter((b) => b.classList.contains("sp-list-btn") && !b.classList.contains("sp-list-extra"));
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
