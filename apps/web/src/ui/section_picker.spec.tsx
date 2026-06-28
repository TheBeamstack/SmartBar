/**
 * F7 ([REF-UI-555]) RTL — the 2D section picker renders one labelled dot per bar, and a two-click
 * sequence links the right indices (the keyboard list path; the SVG dot path is the GPU-verified
 * pointer addition). Selection is mirrored to the store's `selectedBars` for the 3D highlight.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { SectionPicker } from "./SectionPicker";
import { useBarLink } from "./useBarLink";
import { useStore } from "../store/useStore";

function Harness({ onLink }: { onLink: (a: number, b: number) => void }) {
  const pick = useBarLink(onLink);
  return <SectionPicker onPick={pick} />;
}

describe("F7 section picker", () => {
  beforeEach(() => useStore.getState().reset());

  it("renders one labelled bar button per longitudinal bar", () => {
    const bars = useStore.getState().result.bars.length;
    const { container } = render(<Harness onLink={() => {}} />);
    const listBtns = within(container).getAllByRole("button").filter((b) => b.classList.contains("sp-list-btn"));
    expect(listBtns.length).toBe(bars);
    expect(listBtns.every((b) => /^[TBLRC]\d+$/.test(b.textContent ?? ""))).toBe(true);
  });

  it("a first click selects (mirrored to selectedBars); a second click links the two indices", () => {
    const onLink = vi.fn();
    const { container } = render(<Harness onLink={onLink} />);
    const btns = within(container).getAllByRole("button").filter((b) => b.classList.contains("sp-list-btn"));

    fireEvent.click(btns[0]!);
    expect(useStore.getState().selectedBars).toEqual([0]);
    expect(onLink).not.toHaveBeenCalled();

    fireEvent.click(btns[3]!);
    expect(onLink).toHaveBeenCalledWith(0, 3);
    expect(useStore.getState().selectedBars).toEqual([]); // cleared after the link
  });

  it("clicking the pending bar again de-selects it (no link)", () => {
    const onLink = vi.fn();
    const { container } = render(<Harness onLink={onLink} />);
    const btns = within(container).getAllByRole("button").filter((b) => b.classList.contains("sp-list-btn"));
    fireEvent.click(btns[1]!);
    fireEvent.click(btns[1]!);
    expect(onLink).not.toHaveBeenCalled();
    expect(useStore.getState().selectedBars).toEqual([]);
  });
});
