/**
 * F6 RTL — the FaconnageEditor drives the column's longitudinal group: picking a shape seeds its
 * params, editing a param + setting a hook commit through the store, the live sketch + cutLength
 * render, and an impossible param set is rejected (error shown, NOT committed → the solve stays safe).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { FaconnageEditor } from "./FaconnageEditor";
import { useStore } from "../store/useStore";
import { isColumnDoc } from "../engine/document";

function ColumnFaconnage() {
  const doc = useStore((s) => s.doc);
  const setLongitudinal = useStore((s) => s.setLongitudinal);
  if (!isColumnDoc(doc)) return null;
  return (
    <FaconnageEditor
      shapeId={doc.longitudinal.shapeId}
      diameter={doc.longitudinal.diameter}
      faconnage={doc.longitudinal.faconnage}
      memberLength={doc.geometry.H}
      onChange={(patch) => setLongitudinal(patch)}
    />
  );
}

const longi = () => {
  const doc = useStore.getState().doc;
  return isColumnDoc(doc) ? doc.longitudinal : null;
};

describe("FaconnageEditor (F6)", () => {
  beforeEach(() => useStore.getState().reset());

  it("renders the shape picker + a live cut length for the default straight bar", () => {
    render(<ColumnFaconnage />);
    expect(screen.getByLabelText(/forme|shape/i)).toBeInTheDocument();
    // default DROITE, L = H = 3000 ⇒ cut length 3000 mm shown
    expect(screen.getByText(/3000 mm/)).toBeInTheDocument();
  });

  it("picking Z-bar updates the shape + seeds its params into the store", () => {
    render(<ColumnFaconnage />);
    fireEvent.change(screen.getByLabelText(/forme|shape/i), { target: { value: "Z_BAR" } });
    expect(longi()!.shapeId).toBe("Z_BAR");
    expect(longi()!.faconnage!.shapeParams!.run1).toBeGreaterThan(0);
  });

  it("setting a start hook commits the hook to the store", () => {
    render(<ColumnFaconnage />);
    fireEvent.change(screen.getByLabelText(/crochet début|start hook/i), { target: { value: "135" } });
    expect(longi()!.faconnage!.hooks!.start).toBe(135);
  });

  it("an impossible param (all-zero length) shows an error and is NOT committed", () => {
    render(<ColumnFaconnage />);
    const lengthField = screen.getByLabelText(/longueur|length/i);
    // the param NumberField pairs a range + a number box; grab its number spinbutton
    const box = within(lengthField.closest(".field") as HTMLElement).getByRole("spinbutton");
    fireEvent.change(box, { target: { value: "0" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // the store must not have taken the invalid params (no faconnage shapeParams committed, or L≠0)
    const f = longi()!.faconnage;
    expect(f?.shapeParams?.L ?? 3000).not.toBe(0);
  });
});
