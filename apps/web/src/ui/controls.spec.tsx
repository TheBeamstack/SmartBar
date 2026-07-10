/**
 * v1.0.6 N1 / Track U6 ([REF-UI-widgets]) — the control-type pass. Finding U4: `NumberField`
 * (slider + number, toggles `dragMode`) was used for everything. Now the right widget per parameter:
 *   • counts (bars per face / seismic zone)      → a stepper (− N +)
 *   • design inputs (As,req) & non-geometry nums  → a plain number box, NO slider, NO dragMode
 *   • dimensions tuned against live 3D (b,h,L,cover) → keep the slider+number (dragMode preserved)
 *   • diameter                                    → stays a <select>
 * All verified against the reference column (default doc) through the real store.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";

const s = t("fr"); // default lang

describe("v1.0.6 U6 — control-type pass", () => {
  beforeEach(() => useStore.getState().reset());

  it("counts render a stepper (− N +) that drives the store", () => {
    render(<Sidebar />);
    // the symmetric column exposes a "vertical faces" count as a stepper
    const inc = screen.getByRole("button", { name: `${s.layout.verticalFaces} +` });
    const dec = screen.getByRole("button", { name: `${s.layout.verticalFaces} −` });
    expect(inc).toBeInTheDocument();
    expect(dec).toBeInTheDocument();

    const before = useStore.getState().doc; // reference column nTop = 3
    expect((before as { longitudinal: { nTop: number } }).longitudinal.nTop).toBe(3);
    fireEvent.click(inc);
    expect((useStore.getState().doc as { longitudinal: { nTop: number } }).longitudinal.nTop).toBe(4);
    fireEvent.click(dec);
    fireEvent.click(dec);
    expect((useStore.getState().doc as { longitudinal: { nTop: number } }).longitudinal.nTop).toBe(2);
  });

  it("a count stepper never toggles dragMode (it is not a live-3D sweep)", () => {
    render(<Sidebar />);
    expect(useStore.getState().dragMode).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: `${s.layout.verticalFaces} +` }));
    expect(useStore.getState().dragMode).toBe(false);
  });

  it("As,req is a plain number (no slider) and does NOT toggle dragMode", () => {
    render(<Sidebar />);
    const asReq = screen.getByLabelText(`${s.asRequired} (mm²)`) as HTMLInputElement;
    expect(asReq.type).toBe("number");
    // the field carries no range slider (the source of the needless dragMode)
    expect(asReq.closest(".field")!.querySelector('input[type="range"]')).toBeNull();

    expect(useStore.getState().dragMode).toBe(false);
    fireEvent.change(asReq, { target: { value: "1200" } });
    expect(useStore.getState().dragMode).toBe(false);
    expect((useStore.getState().doc as { longitudinal: { asReq: number } }).longitudinal.asReq).toBe(1200);
  });

  it("dimension controls (b) KEEP the live-tune slider and its dragMode", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("tab", { name: /géom|geom/i }));
    const b = screen.getByLabelText(s.section.b) as HTMLInputElement; // label binds to the first control = the range
    expect(b.type).toBe("range");

    expect(useStore.getState().dragMode).toBe(false);
    fireEvent.pointerDown(b);
    expect(useStore.getState().dragMode).toBe(true);
    fireEvent.pointerUp(b);
    expect(useStore.getState().dragMode).toBe(false);
  });

  it("diameter stays a <select>", () => {
    render(<Sidebar />);
    const primaryDiameter = screen.getAllByRole("combobox")[0]!;
    expect(primaryDiameter.tagName).toBe("SELECT");
  });
});
