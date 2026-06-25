/**
 * P6 control-panel correctness ([REF-UI-815], §6.1/§8): the column layout-principle selector.
 *
 * SYMMETRIC (default) ties opposite faces (nTop=nBottom, nLeft=nRight) — so the UI exposes only the
 * two DISTINCT counts, and editing one face count drives its twin (no field that silently mirrors
 * another). FREE exposes all four faces independently. This is the fix for the reported "Barres
 * haut and Barres bas do the same thing" redundancy.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useStore } from "./useStore";
import { Sidebar } from "../ui/Sidebar";
import { isColumnDoc } from "../engine/document";

const faceCount = (face: string) =>
  useStore.getState().result.bars.filter((b) => b.faceTag === face).length;

describe("column layout principle (§6.1/§8)", () => {
  beforeEach(() => useStore.getState().reset());

  it("defaults to SYMMETRIC", () => {
    const doc = useStore.getState().doc;
    expect(isColumnDoc(doc) && doc.longitudinal.principle).toBe("SYMMETRIC");
  });

  it("SYMMETRIC ties the opposite face: setting nTop drives nBottom too", () => {
    // default 3/3; bump only nTop → SYMMETRIC coerces both top & bottom to 5
    useStore.getState().setLongitudinal({ nTop: 5 });
    expect(faceCount("TOP")).toBe(5);
    expect(faceCount("BOTTOM")).toBe(5);
  });

  it("FREE makes the four faces independent", () => {
    useStore.getState().setLongitudinal({ principle: "FREE" });
    useStore.getState().setLongitudinal({ nTop: 5, nBottom: 3 });
    expect(faceCount("TOP")).toBe(5);
    expect(faceCount("BOTTOM")).toBe(3);
  });

  it("renders two distinct count fields under SYMMETRIC, four under FREE", () => {
    const { rerender } = render(<Sidebar />);
    // SYMMETRIC: the two merged-face fields, NOT the four raw ones
    expect(screen.getByText(/faces verticales/)).toBeInTheDocument();
    expect(screen.queryByText("Barres haut")).toBeNull();

    useStore.getState().setLongitudinal({ principle: "FREE" });
    rerender(<Sidebar />);
    expect(screen.getByText("Barres haut")).toBeInTheDocument();
    expect(screen.getByText("Barres bas")).toBeInTheDocument();
    expect(screen.queryByText(/faces verticales/)).toBeNull();
  });
});
