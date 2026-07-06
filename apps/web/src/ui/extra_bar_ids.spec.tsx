/**
 * H15 ([v1.0.4]) — independent extra bars get stable, collision-free ids. The old `X${length+1}`
 * scheme reused an id after a middle bar was removed (two bars → same React key + same schedule id).
 * The fix assigns the first free `x{n}`, so ids never collide and a freed slot is reused cleanly.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { useStore } from "../store/useStore";
import type { ColumnDoc } from "../engine/document";

const ids = () => (useStore.getState().doc as ColumnDoc).extraBars!.map((e) => e.id);

describe("H15 — collision-free extra-bar ids", () => {
  beforeEach(() => useStore.getState().reset());

  it("assigns unique ids and reuses a freed slot instead of colliding", () => {
    const { container } = render(<><Navbar /><Sidebar /></>);
    const panel = () => container.querySelector(".addressable") as HTMLElement;
    const addBtn = () => within(panel()).getByText(/Ajouter une barre|Add a bar/);

    fireEvent.click(addBtn());
    fireEvent.click(addBtn());
    fireEvent.click(addBtn());
    expect(ids()).toEqual(["x1", "x2", "x3"]);

    // remove the MIDDLE bar — the old scheme would then hand the next add a colliding "x3".
    fireEvent.click(within(panel()).getByLabelText(/Retirer x2|Remove x2/));
    expect(ids()).toEqual(["x1", "x3"]);

    fireEvent.click(addBtn());
    const after = ids();
    expect(new Set(after).size).toBe(after.length); // all unique
    expect(after).toEqual(["x1", "x3", "x2"]); // the freed "x2" is reused, no duplicate
  });
});
