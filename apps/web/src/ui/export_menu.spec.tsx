/**
 * P5 export UI: the navbar Export menu offers PDF / DXF / BBS / .rcfg; the drawing deliverables
 * (PDF/DXF) are disabled on a 🔴 FAIL (export-lock §7.9) while BBS + .rcfg always stay available.
 * The BBS panel renders the on-screen schedule (§9.1).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { BbsPanel } from "./BbsPanel";
import { useStore } from "../store/useStore";

const forceFail = () => {
  useStore.getState().setGeometry({ b: 120, h: 120, H: 3000 });
  useStore.getState().setLongitudinal({ nTop: 6, nBottom: 6, nLeft: 6, nRight: 6, diameter: 32 });
};

describe("navbar export menu (§7.9)", () => {
  beforeEach(() => useStore.getState().reset());

  it("offers all four export targets", () => {
    render(<Navbar />);
    for (const name of ["Plan PDF", "Dessin DXF", "Nomenclature (JSON)", "Projet (.rcfg)"]) {
      expect(screen.getByRole("menuitem", { name })).toBeInTheDocument();
    }
  });

  it("enables PDF/DXF on a PASS/WARN element", () => {
    render(<Navbar />);
    expect(screen.getByRole("menuitem", { name: "Plan PDF" })).not.toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Dessin DXF" })).not.toBeDisabled();
  });

  it("locks PDF/DXF on a FAIL element, keeps BBS + .rcfg available", () => {
    forceFail();
    expect(useStore.getState().result.status).toBe("FAIL");
    render(<Navbar />);
    expect(screen.getByRole("menuitem", { name: "Plan PDF" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Dessin DXF" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Nomenclature (JSON)" })).not.toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Projet (.rcfg)" })).not.toBeDisabled();
  });
});

describe("BBS panel (§9.1)", () => {
  beforeEach(() => useStore.getState().reset());

  it("renders the schedule table + steel summary for the reference column", () => {
    render(<BbsPanel />);
    expect(screen.getByText(/Nomenclature des aciers/)).toBeInTheDocument();
    // at least one bar row (Ø20 longitudinal + Ø8 ties)
    expect(screen.getAllByText(/Ø20/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Total acier/)).toBeInTheDocument();
  });
});
