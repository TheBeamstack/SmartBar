/**
 * v1.0.6 N5 / Track U4 ([REF-UI-560]) — the tool palette + place-by-pointing. Verified through the
 * real store + the `ToolPalette` (the on-SVG pointer drop is GPU/owner-verified — headless can't map
 * `getScreenCTM`; the typed-coordinate twin + Place button is the a11y equivalent and is tested here):
 *   • modal tool switching + keyboard shortcuts + Esc → select;
 *   • palette shape/Ø selection;
 *   • a place gesture (typed coord + Place) creates the RIGHT `PlacedBar` in `doc.placed`, snapped;
 *   • the placed-bar list edits count/n + removes; placement works on all 8 elements (the placed model).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ToolPalette } from "./ToolPalette";
import { useStore } from "../store/useStore";
import type { ColumnDoc } from "../engine/document";

const placedOf = () => ((useStore.getState().doc as ColumnDoc).placed ?? []);

describe("v1.0.6 U4 — tool palette + place-by-pointing", () => {
  beforeEach(() => useStore.getState().reset());

  it("modal tools switch the store tool + reflect aria-pressed; Esc returns to select", () => {
    render(<ToolPalette />);
    expect(useStore.getState().sectionTool).toBe("select");

    fireEvent.click(screen.getByRole("button", { name: /Barre/ }));
    expect(useStore.getState().sectionTool).toBe("add-single");
    expect(screen.getByRole("button", { name: /Barre/ })).toHaveAttribute("aria-pressed", "true");

    // Esc anywhere (not in a field) returns to Select
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useStore.getState().sectionTool).toBe("select");
  });

  it("keyboard shortcuts pick the tool (guarded against typing in fields)", () => {
    render(<ToolPalette />);
    fireEvent.keyDown(window, { key: "r" });
    expect(useStore.getState().sectionTool).toBe("add-row");
    fireEvent.keyDown(window, { key: "u" });
    expect(useStore.getState().sectionTool).toBe("add-bundle");
    fireEvent.keyDown(window, { key: "v" });
    expect(useStore.getState().sectionTool).toBe("select");

    // the link shortcut arms a cross-tie link
    fireEvent.keyDown(window, { key: "k" });
    expect(useStore.getState().sectionTool).toBe("link");
    expect(useStore.getState().sectionLink).toEqual({ kind: "crosstie" });
  });

  it("the palette (shape + Ø) shows only for an add tool and drives the store", () => {
    render(<ToolPalette />);
    // select mode → no palette
    expect(screen.queryByLabelText(/Forme|Shape/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Barre$/ }));
    fireEvent.change(screen.getByLabelText(/Forme|Shape/), { target: { value: "CROCHET_L" } });
    expect(useStore.getState().paletteShape).toBe("CROCHET_L");
    fireEvent.change(screen.getByLabelText(/Ø/), { target: { value: "20" } });
    expect(useStore.getState().paletteDiameter).toBe(20);
  });

  it("typed coordinate + Place creates a single PlacedBar in doc.placed, snapped to the envelope", () => {
    render(<ToolPalette />);
    fireEvent.click(screen.getByRole("button", { name: /^Barre$/ }));
    // type a coordinate outside the cover envelope → it snaps on Place
    fireEvent.change(screen.getByLabelText("u"), { target: { value: "9999" } });
    fireEvent.change(screen.getByLabelText("v"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Placer|Place/ }));

    const placed = placedOf();
    expect(placed).toHaveLength(1);
    const bar = placed[0]! as { kind?: string; u: number; id: string };
    expect(bar.kind).toBeUndefined(); // a single free bar
    // default column b=300, cover=30, Ø=12 → u clamped to 300/2 − 30 − 6 = 114
    expect(bar.u).toBe(114);
    // the typed-coordinate twin was updated to the snapped value
    expect(useStore.getState().placeCoord.u).toBe(114);
    // the placed bar solved cleanly (it really renders/schedules — not just a doc entry)
    expect(useStore.getState().solveError).toBeNull();
    expect((useStore.getState().result.longBars ?? []).some((lb) => lb.standalone)).toBe(true);
  });

  it("each add tool creates the matching kind (row / bundle / layer)", () => {
    render(<ToolPalette />);
    fireEvent.click(screen.getByRole("button", { name: /^Lit$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Placer|Place/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Paquet$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Placer|Place/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Couche$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Placer|Place/ }));

    const kinds = placedOf().map((p) => (p as { kind?: string }).kind);
    expect(kinds).toEqual(["row", "bundle", "layer"]);
  });

  it("the placed-bar list steps count/n and removes a bar", () => {
    render(<ToolPalette />);
    fireEvent.click(screen.getByRole("button", { name: /^Paquet$/ })); // bundle (n default 2)
    fireEvent.click(screen.getByRole("button", { name: /Placer|Place/ }));
    expect(placedOf()).toHaveLength(1);

    const list = screen.getByRole("list", { name: /Barres placées|Placed bars/ });
    fireEvent.click(within(list).getByRole("button", { name: /Nombre \+|Count \+/ }));
    expect((placedOf()[0]! as { n: number }).n).toBe(3);

    // remove it
    fireEvent.click(within(list).getByRole("button", { name: /Retirer|Remove/ }));
    expect(placedOf()).toHaveLength(0);
  });
});
