/**
 * RTL smoke (plan P3): the catalog drives the UI — switching to the beam reveals beam controls,
 * and a supplement can be added by typing bar indices (the keyboard/a11y binding path, §8).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    // column shows the per-face counts
    expect(screen.getByText(/Barres haut/)).toBeInTheDocument();

    const elementSelect = screen.getByLabelText("Élément");
    fireEvent.change(elementSelect, { target: { value: "E-BEM-01" } });

    expect(useStore.getState().doc.element).toBe("E-BEM-01");
    // beam shows span-steel + chapeau controls instead
    expect(screen.getByText(/Aciers de travée/)).toBeInTheDocument();
    expect(screen.getByText(/Chapeaux sur appui/)).toBeInTheDocument();
  });

  it("adds an épingle by typing bar indices and lists it bound to those bars", () => {
    renderApp();
    fireEvent.change(screen.getByLabelText("Barre 1 (indice)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Barre 2 (indice)"), { target: { value: "2" } });
    fireEvent.click(screen.getByText("Ajouter"));

    expect(useStore.getState().doc.supplements.length).toBe(1);
    expect(useStore.getState().doc.supplements[0]!.barIndices).toEqual([0, 2]);
    // the add-on appears in the list, bound to bars 0, 2
    expect(screen.getByText(/Liée aux barres 0, 2/)).toBeInTheDocument();
    // and it renders as an engine group
    expect(useStore.getState().result.groups.some((g) => g.role === "SUPPLEMENTAL")).toBe(true);
  });

  it("the expert toggle reveals the resolved bar-group list", () => {
    renderApp();
    expect(screen.queryByText(/Liste des armatures/)).toBeNull();
    fireEvent.click(screen.getByText("Mode expert"));
    expect(screen.getByText(/Liste des armatures/)).toBeInTheDocument();
    // the column's longitudinal + tie groups are listed
    expect(screen.getByText("L1")).toBeInTheDocument();
    expect(screen.getByText("T1")).toBeInTheDocument();
  });
});
