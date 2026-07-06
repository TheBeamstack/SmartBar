/**
 * H9 ([v1.0.4]) — picking a shape runs its seed through the generator before committing. With H11's
 * manifest defaults every open shape seeds valid, so picking any of them commits `shapeParams` and
 * shows a live cut length (no error alert) — the store never sees an invalid first sketch.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FaconnageEditor } from "./FaconnageEditor";
import { useStore } from "../store/useStore";
import { isColumnDoc } from "../engine/document";

const OPEN_SHAPES = ["DROITE", "CROCHET_L", "U_BAR", "BAIONNETTE", "RELEVE", "ATTENTE", "Z_BAR", "DOUBLE_CRANK", "STEPPED"];

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

describe("H9 — pickShape commits only a valid seed", () => {
  beforeEach(() => useStore.getState().reset());

  it.each(OPEN_SHAPES)("picking %s commits valid params + shows a cut length (no error)", (id) => {
    render(<ColumnFaconnage />);
    fireEvent.change(screen.getByLabelText(/forme|shape/i), { target: { value: id } });
    expect(longi()!.shapeId).toBe(id);
    // committed a non-empty param set through the guarded path
    const params = longi()!.faconnage!.shapeParams!;
    expect(Object.keys(params).length).toBeGreaterThan(0);
    // the guard passed → a live sketch/cut length renders, not the invalid-params alert
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/mm/)).toBeInTheDocument();
  });
});
