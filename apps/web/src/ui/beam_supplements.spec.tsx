/**
 * RTL smoke (plan P3): the catalog drives the UI — switching to the beam reveals beam controls,
 * and a supplement can be added by typing bar indices (the keyboard/a11y binding path, §8).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { useStore } from "../store/useStore";

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
    // beam shows span-steel + chapeau controls instead
    expect(screen.getByText(/Aciers de travée/)).toBeInTheDocument();
    expect(screen.getByText(/Chapeaux sur appui/)).toBeInTheDocument();
  });

  it("adds an épingle by clicking two bars in the F7 section picker (a11y list path)", () => {
    const { container } = renderApp();
    // the supplements panel hosts its own section picker; click two distinct bar buttons to link
    const panel = container.querySelector(".supplements") as HTMLElement;
    const barButtons = within(panel).getAllByRole("button").filter((b) => b.classList.contains("sp-list-btn"));
    expect(barButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(barButtons[0]!);
    fireEvent.click(barButtons[2] ?? barButtons[1]!);

    expect(useStore.getState().doc.supplements.length).toBe(1);
    expect(useStore.getState().doc.supplements[0]!.barIndices).toHaveLength(2);
    // it renders as an engine group, bound to two stable bar indices
    expect(useStore.getState().result.groups.some((g) => g.role === "SUPPLEMENTAL")).toBe(true);
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
