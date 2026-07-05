/**
 * H4 ([v1.0.4]) — the FaconnageEditor buffer resyncs to the committed params when the shape, the
 * member length, OR the committed params change externally (geometry edit / import / undo). Pre-H4
 * the buffer only re-seeded on `shapeId`, so a geometry change or an imported doc left the field
 * stale (geometry↔façonnage desync). The live cut-length text is the observable proxy for the buffer.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FaconnageEditor } from "./FaconnageEditor";
import { useStore } from "../store/useStore";
import type { BarFaconnage } from "../engine/document";

// DROITE seeds L = memberLength, and the editor shows the cut length as "<n> mm".
function MemHarness({ mem }: { mem: number }) {
  return (
    <FaconnageEditor shapeId="DROITE" diameter={20} faconnage={undefined} memberLength={mem} onChange={() => {}} />
  );
}

function FacHarness({ fac }: { fac?: BarFaconnage }) {
  return (
    <FaconnageEditor shapeId="DROITE" diameter={20} faconnage={fac} memberLength={3000} onChange={() => {}} />
  );
}

describe("FaconnageEditor resync (H4)", () => {
  beforeEach(() => useStore.getState().reset());

  it("resyncs the buffer when the member length changes (geometry edit)", () => {
    const { rerender } = render(<MemHarness mem={3000} />);
    expect(screen.getByText(/3000 mm/)).toBeInTheDocument();
    rerender(<MemHarness mem={5000} />);
    expect(screen.getByText(/5000 mm/)).toBeInTheDocument();
  });

  it("resyncs the buffer when committed params arrive externally (import)", () => {
    const { rerender } = render(<FacHarness fac={undefined} />);
    expect(screen.getByText(/3000 mm/)).toBeInTheDocument();
    rerender(<FacHarness fac={{ shapeParams: { L: 4200 } }} />);
    expect(screen.getByText(/4200 mm/)).toBeInTheDocument();
  });
});
