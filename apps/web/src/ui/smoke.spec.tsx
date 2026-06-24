/**
 * RTL smoke (plan P2): changing a diameter updates the As,prov badge and the alert list — the
 * full store → engine → UI loop, no WebGL (panels only; the Canvas viewport is excluded).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { AlertsPanel } from "./AlertsPanel";
import { useStore } from "../store/useStore";

function renderPanels() {
  return render(
    <>
      <Sidebar />
      <AlertsPanel />
    </>,
  );
}

describe("SPA panels smoke", () => {
  beforeEach(() => useStore.getState().reset());

  it("renders the reference column's As,prov badge and rule rows", () => {
    renderPanels();
    const badges = document.querySelector(".badges") as HTMLElement;
    // 6Ø20 ⇒ As,prov = 1884.96 mm² = 18.85 cm²
    expect(within(badges).getByText(/18\.85 cm²/)).toBeInTheDocument();
    expect(screen.getByText("provided_area")).toBeInTheDocument();
  });

  it("changing the primary diameter re-solves and updates the As,prov badge live", () => {
    renderPanels();
    const badges = document.querySelector(".badges") as HTMLElement;
    expect(within(badges).getByText(/18\.85 cm²/)).toBeInTheDocument();

    // first combobox in the Schéma tab is the primary-bar diameter select
    const primaryDiameter = screen.getAllByRole("combobox")[0]!;
    fireEvent.change(primaryDiameter, { target: { value: "25" } });

    // 6Ø25 ⇒ As,prov = 2945.24 mm² = 29.45 cm²
    expect(within(badges).getByText(/29\.45 cm²/)).toBeInTheDocument();
    expect(within(badges).queryByText(/18\.85 cm²/)).toBeNull();
  });

  it("clicking an alert row highlights its affected bars (store selection)", () => {
    renderPanels();
    const row = screen.getByText("provided_area").closest(".alert-row") as HTMLElement;
    fireEvent.click(row);
    expect(useStore.getState().selectedGroupIds).toContain("L1");
  });
});
