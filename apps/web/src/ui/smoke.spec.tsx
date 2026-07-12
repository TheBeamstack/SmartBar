/**
 * RTL smoke (plan P2): changing a diameter updates the As,prov readout and the alert list — the
 * full store → engine → UI loop, no WebGL (panels only; the Canvas viewport is excluded). The
 * sticky per-zone readout (F3) shows the column's As,prov in cm²; editing φ re-solves it live.
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
  // R6 (O-4/A-8): advancedForm defaults OFF now; this smoke test drives the advanced-form tabs, so opt in.
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().setAdvancedForm(true);
  });

  it("renders the reference column's As,prov readout and rule rows", () => {
    renderPanels();
    const readout = document.querySelector(".readout") as HTMLElement;
    // 6Ø20 ⇒ As,prov = 1884.96 mm² = 18.85 cm²
    expect(within(readout).getByText("18.85")).toBeInTheDocument();
    expect(screen.getByText("provided_area")).toBeInTheDocument();
  });

  it("changing the primary diameter re-solves and updates the As,prov readout live", () => {
    renderPanels();
    const readout = document.querySelector(".readout") as HTMLElement;
    expect(within(readout).getByText("18.85")).toBeInTheDocument();

    // v1.0.6 N3: the element-setup strip adds a code-pack select above the tabs, so scope to the
    // Schéma tab body — its first combobox is the primary-bar diameter select.
    const schemeBody = document.querySelector(".tab-body") as HTMLElement;
    const primaryDiameter = within(schemeBody).getAllByRole("combobox")[0]!;
    fireEvent.change(primaryDiameter, { target: { value: "25" } });

    // 6Ø25 ⇒ As,prov = 2945.24 mm² = 29.45 cm²
    expect(within(readout).getByText("29.45")).toBeInTheDocument();
    expect(within(readout).queryByText("18.85")).toBeNull();
  });

  it("the sticky readout stays mounted with an overall status chip across tab switches", () => {
    renderPanels();
    const readout = document.querySelector(".readout") as HTMLElement;
    expect(readout).toBeInTheDocument();
    expect(readout).toHaveAttribute("role", "status");
    expect(readout.querySelector(".readout-overall")).toBeInTheDocument();

    // switching the controls tab must NOT unmount the readout (it lives outside the tab body)
    fireEvent.click(screen.getByRole("tab", { name: /géom|geom/i }));
    expect(document.querySelector(".readout")).toBeInTheDocument();
  });

  it("clicking an alert row highlights its affected bars (store selection)", () => {
    renderPanels();
    const row = screen.getByText("provided_area").closest(".alert-row") as HTMLElement;
    fireEvent.click(row);
    expect(useStore.getState().selectedGroupIds).toContain("L1");
  });
});
