/**
 * P5 coupe manager UI (§9.5): the panel lists the seeded default coupe, lets you add/place/remove
 * cuts via numeric fields + keyboard (a11y parity with the deferred 3D drag handle), and renders a
 * live 2D preview from the pure `sectionAt` CoupeView (bars as circles at their (u,v)).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CoupePanel } from "./CoupePanel";
import { useStore } from "../store/useStore";

describe("coupe manager panel", () => {
  beforeEach(() => useStore.getState().reset());

  it("lists the default representative coupe and previews the column cross-section", () => {
    const { container } = render(<CoupePanel />);
    // default coupe present + tagged
    expect(screen.getByText(/par défaut/)).toBeInTheDocument();
    // the reference column has 6 Ø20 longitudinal bars → ≥6 circles in the preview SVG
    expect(container.querySelectorAll(".coupe-svg circle").length).toBeGreaterThanOrEqual(6);
  });

  it("adds a user coupe and places it by the numeric station field (keyboard parity)", () => {
    render(<CoupePanel />);
    fireEvent.click(screen.getByText("Ajouter une coupe"));
    expect(useStore.getState().cuts).toHaveLength(2);

    // the station field for the active (new) coupe is now editable
    const station = screen.getByLabelText(/Position le long de l'axe/) as HTMLInputElement;
    fireEvent.change(station, { target: { value: "1500" } });

    const active = useStore.getState().cuts.find((c) => c.id === useStore.getState().activeCutId)!;
    expect((active.origin as { y: number }).y).toBe(1500);
  });

  it("removes a user coupe via its remove control", () => {
    render(<CoupePanel />);
    fireEvent.click(screen.getByText("Ajouter une coupe"));
    const list = screen.getByRole("listbox");
    const remove = within(list).getByRole("button", { name: /Supprimer/ });
    fireEvent.click(remove);
    expect(useStore.getState().cuts).toHaveLength(1);
    expect(useStore.getState().cuts[0]!.isDefault).toBe(true);
  });
});
