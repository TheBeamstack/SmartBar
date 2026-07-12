/**
 * H6 ([v1.0.4]) — the independent-bar UI exposes the FULL model an `AddressableBar` already carries:
 * a shape (via the reused FaconnageEditor) + façonnage + a unique length + an axial position, not just
 * u/v/Ø. The adapter (buildExtraBars) already threads all of it to 3D/coupe/BBS/DXF; this closes the
 * frontend gap. The shaped extra then solves to a standalone bar with its own bent cut length.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { useStore } from "../store/useStore";
import { solveDoc } from "../engine/solveDoc";
import type { ColumnDoc } from "../engine/document";

const extra = () => (useStore.getState().doc as ColumnDoc).extraBars![0]!;

function boxOf(scope: HTMLElement, labelRe: RegExp): HTMLElement {
  const field = within(scope).getByLabelText(labelRe);
  return within(field.closest(".field") as HTMLElement).getByRole("spinbutton");
}

describe("H6 — independent extra bar exposes shape / length / axial", () => {
  // R6 (O-4/A-8): advancedForm defaults OFF now; this suite exercises the advanced-form editor, so opt in.
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().setAdvancedForm(true);
  });

  it("an extra bar can be given a bent shape, a unique length and an axial position", () => {
    const { container } = render(<><Navbar /><Sidebar /></>);
    const panel = container.querySelector(".addressable") as HTMLElement;
    fireEvent.click(within(panel).getByText(/Ajouter une barre|Add a bar/));

    const li = panel.querySelector(".addressable-extra") as HTMLElement;
    // shape: the per-extra FaconnageEditor drives shapeId + seeds its façonnage params
    fireEvent.change(within(li).getByLabelText(/forme|shape/i), { target: { value: "BAIONNETTE" } });
    expect(extra().shapeId).toBe("BAIONNETTE");
    expect(extra().faconnage!.shapeParams!.lower).toBeGreaterThan(0);

    // length + axial (unambiguous now — BAIONNETTE has no "Longueur" param)
    fireEvent.change(boxOf(li, /Longueur|Length/), { target: { value: "1750" } });
    expect(extra().length).toBe(1750);
    fireEvent.change(boxOf(li, /axiale|Axial/), { target: { value: "300" } });
    expect(extra().axialPos).toBe(300);
  });

  it("the shaped extra solves to a standalone bar with its unique cut length (±0.01)", () => {
    const { container } = render(<><Navbar /><Sidebar /></>);
    const panel = container.querySelector(".addressable") as HTMLElement;
    fireEvent.click(within(panel).getByText(/Ajouter une barre|Add a bar/));
    const li = panel.querySelector(".addressable-extra") as HTMLElement;
    fireEvent.change(within(li).getByLabelText(/forme|shape/i), { target: { value: "BAIONNETTE" } });
    fireEvent.change(boxOf(li, /Longueur|Length/), { target: { value: "1750" } });

    const bars = solveDoc(useStore.getState().doc).longBars!;
    const standalone = bars.find((b) => b.standalone)!;
    expect(standalone).toBeDefined();
    expect(Math.abs(standalone.shape.cutLength - 1750)).toBeLessThan(0.01);
  });
});
