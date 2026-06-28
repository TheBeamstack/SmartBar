/**
 * F5 RTL — the RegionEditor drives the store: the free table adds/removes regions (kept contiguous)
 * and the uniform reset clears them back to plain spacing. Default doc is the reference column.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RegionEditor } from "./RegionEditor";
import { useStore } from "../store/useStore";
import { isColumnDoc } from "../engine/document";

const tieRegions = () => {
  const doc = useStore.getState().doc;
  return isColumnDoc(doc) ? doc.tie.regions : undefined;
};

describe("RegionEditor (F5)", () => {
  beforeEach(() => useStore.getState().reset());

  it("starts uniform (one effective region, none stored) and renders the table", () => {
    render(<RegionEditor />);
    expect(screen.getByText(/spacing by region|espacement par zones/i)).toBeInTheDocument();
    expect(tieRegions()).toBeUndefined();
  });

  it("Add region splits into a contiguous two-region list, Uniform resets it", () => {
    render(<RegionEditor />);
    fireEvent.click(screen.getByRole("button", { name: /add region|ajouter une zone/i }));
    const regions = tieRegions()!;
    expect(regions).toHaveLength(2);
    expect(regions[0]!.from).toBe(0);
    expect(regions[0]!.to).toBe(regions[1]!.from); // contiguous
    expect(regions[1]!.to).toBe(3000); // full column height

    fireEvent.click(screen.getByRole("button", { name: /uniform|uniforme/i }));
    expect(tieRegions()).toBeUndefined();
  });
});
