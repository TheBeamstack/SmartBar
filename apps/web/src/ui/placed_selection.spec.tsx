/**
 * v1.0.6-fix **R2 (finding F-C)** — the PLACED-BAR selection channel.
 *
 * Three phases built three halves of one feature and no phase owned the join:
 *   • **N5** writes new steel to `doc.placed` (the v1.0.5 canonical model);
 *   • **N2/N3** render every `standalone` resolved bar as a pickable square and route the click to
 *     `select({kind:"extra", id})`;
 *   • **N3's Inspector** resolves an `extra` against `doc.extraBars` — a DIFFERENT array.
 *
 * So a bar placed with the tool palette was drawn, was clickable, and selecting it showed **"nothing
 * selected"**; every N6 station action (curtail / splice / anchorage) then **silently no-op'd** on it.
 * The release's headline — *place a bar by pointing → select it → drag its end to curtail it* — did not
 * compose. R2 adds the missing `kind:"placed"` selection, so all three phases meet.
 *
 * Every test here FAILS on the pre-R2 code. `apps/web` only — no engine/`.rcfg`/golden change.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Inspector } from "./Inspector";
import { ToolPalette } from "./ToolPalette";
import { useStore } from "../store/useStore";
import type { ColumnDoc, PlacedBarDoc } from "../engine/document";

const S = () => useStore.getState();
const placedOf = () => ((S().doc as { placed?: PlacedBarDoc[] }).placed ?? []);
const idOf = (p: PlacedBarDoc) => (p as { id: string }).id;

/** Drop one bar of `kind` through the SHIPPED path (pick the tool, then the typed-coord Place twin). */
function place(tool: "add-single" | "add-row" | "add-bundle" | "add-layer", u = 50, v = 100): string {
  S().setSectionTool(tool);
  S().placeInSection(u, v);
  const p = placedOf();
  return idOf(p[p.length - 1]!);
}

describe("R2 / F-C — a placed bar is selectable AND editable", () => {
  beforeEach(() => S().reset());

  it("clicking a placed bar on the canvas selects it as `placed` (not as a phantom `extra`)", () => {
    const id = place("add-single");
    // the canvas renders it (it resolves to a standalone longBar) and picks route through this handler:
    expect((S().result.longBars ?? []).some((b) => b.standalone && b.groupId === id)).toBe(true);

    S().pickSectionExtra(id);
    expect(S().selection).toEqual({ kind: "placed", id }); // ← was {kind:"extra"} → dead end
  });

  it("selecting a placed bar OPENS the inspector on it (the F-C dead-end, inverted)", () => {
    const id = place("add-single");
    S().pickSectionExtra(id);
    render(<Inspector />);

    // it names the object, and its fields are editable — previously this said "nothing selected".
    expect(screen.getByText(new RegExp(id))).toBeInTheDocument();
    expect(screen.queryByText(/Sélectionnez une barre/)).toBeNull();

    const dia = screen.getByRole("spinbutton", { name: /Ø/ });
    fireEvent.change(dia, { target: { value: "20" } });
    expect((placedOf()[0] as { diameter: number }).diameter).toBe(20);
  });

  it("selecting any MEMBER of a row selects the PARENT object the user created", () => {
    const id = place("add-row"); // expands to p1#0, p1#1, p1#2
    const members = (S().result.longBars ?? []).filter((b) => b.standalone).map((b) => b.groupId);
    expect(members).toContain(`${id}#1`);

    S().pickSectionExtra(`${id}#1`); // click the middle bar of the row
    expect(S().selection).toEqual({ kind: "placed", id }); // → the ROW, not one anonymous bar

    // editing the ROW's count (the stepper — driven by its ± buttons, the house pattern) re-solves it
    render(<Inspector />);
    expect((placedOf()[0] as { count: number }).count).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "Nombre +" }));
    fireEvent.click(screen.getByRole("button", { name: "Nombre +" }));
    expect((placedOf()[0] as { count: number }).count).toBe(5);
    expect((S().result.longBars ?? []).filter((b) => b.standalone)).toHaveLength(5); // re-solved
  });

  it("N6's station edits REACH a placed bar — curtail / splice / anchorage all commit", () => {
    const id = place("add-single");
    S().pickSectionExtra(id);

    S().curtailSelectedBar("end", 800);
    S().addSelectedBarSplice(1500, "lap");
    S().setSelectedBarAnchorage("hook");

    const p = placedOf()[0] as { endStation?: number; splices?: { at: number }[]; anchorage?: string };
    expect(p.endStation).toBe(800); // ← all three were silent no-ops before R2
    expect(p.splices).toEqual([{ at: 1500, kind: "lap" }]);
    expect(p.anchorage).toBe("hook");

    // and the curtailment is REAL: the resolved bar is shorter than the member run.
    const bar = (S().result.longBars ?? []).find((b) => b.groupId === id)!;
    expect(bar.endStation).toBe(800);
    expect(bar.shape.cutLength).toBeLessThan((S().doc as ColumnDoc).geometry.H);
  });

  it("curtailing a selected ROW curtails every bar in it (one object, N bars)", () => {
    const id = place("add-row");
    S().pickSectionExtra(`${id}#0`);
    S().curtailSelectedBar("end", 900);

    const members = (S().result.longBars ?? []).filter((b) => b.standalone);
    expect(members.length).toBeGreaterThan(1);
    for (const b of members) expect(b.endStation).toBe(900);
  });

  it("the palette's placed list is a SELECTOR into the inspector (one editing surface, U3)", () => {
    const id = place("add-bundle");
    render(<ToolPalette />);
    fireEvent.click(screen.getByRole("button", { name: /Paquet · DROITE/ }));
    expect(S().selection).toEqual({ kind: "placed", id });
  });

  it("a legacy `extraBars` bar still routes to `extra` — no regression to the N3 path", () => {
    S().setExtraBars([{ id: "x1", u: 0, v: 0, shapeId: "DROITE", diameter: 12 }]);
    S().pickSectionExtra("x1");
    expect(S().selection).toEqual({ kind: "extra", id: "x1" });
  });

  it("the inspector now exists on a NON-RECT element (a slab) for its placed steel", () => {
    S().selectElement("E-SLB-01");
    const id = place("add-row", 0, 60);
    S().select({ kind: "placed", id });
    render(<Inspector />);
    expect(screen.getByText(new RegExp(id))).toBeInTheDocument(); // ← the whole panel used to be null
  });
});

describe("R2 — invariant 8: no silent inert edit", () => {
  beforeEach(() => S().reset());
  afterEach(() => vi.restoreAllMocks());

  it("a selection that matches no target REPORTS instead of committing an identical doc", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    S().select({ kind: "placed", id: "ghost" }); // nothing in doc.placed
    const before = JSON.stringify(S().doc);

    S().curtailSelectedBar("end", 500);

    expect(JSON.stringify(S().doc)).toBe(before); // still no phantom write …
    expect(err).toHaveBeenCalledWith(expect.stringContaining("invariant 8")); // … but it is no longer SILENT
  });
});
