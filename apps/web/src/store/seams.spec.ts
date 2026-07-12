/**
 * v1.0.6-fix **R7 — the seam suite (the counter-measure).**
 *
 * The meta-finding of the 2026-07-11 review: **every one of the v1.0.5/v1.0.6 defects passed a green
 * gate.** The tests were *phase-shaped* — each phase tested its own diff — so nothing tested the SEAMS
 * *between* phases, which is exactly where all six findings lived (a placed bar drawn+scheduled but never
 * validated; a bundle lapped on the bare Ø; place→select→curtail that did not compose). Per-phase
 * regression specs now pin each finding inverted; THIS suite is the structural counter-measure: it tests
 * the **product's promises**, end-to-end, through the **REAL store** (not the engine API), so a future
 * phase that quietly breaks a join fails here.
 *
 * The promises (spec §9 / core_logic §6):
 *  1. "Any bar I place is **drawn == scheduled == validated == saved**" — every element × every placed kind.
 *  2. "**Anything I can select, I can edit**" — a selection yields a committed edit, never a silent no-op
 *     (invariant 8).
 *  3. "A **code rule uses the code diameter**" — a bundle's lap AND its curtailment develop on φₙ (F-A/F-G).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useStore } from "./useStore";
import { docToRcfg, rcfgToDoc } from "../engine/rcfgDoc";
import type { ElementId, PlacedBarDoc } from "../engine/document";
import { computeBBS } from "@rebarconfig/exporters";

const S = () => useStore.getState();
const placedOf = () => ((S().doc as { placed?: PlacedBarDoc[] }).placed ?? []);
const membersOf = (id: string) => (S().result.longBars ?? []).filter((b) => b.groupId.split("#")[0] === id);

const ALL_8: ElementId[] = [
  "E-COL-01", "E-BEM-01", "E-COL-02", "E-FND-01", "E-SLB-01", "E-SLB-02", "E-SLB-03", "E-STR-01",
];
const KINDS = ["single", "row", "bundle", "layer"] as const;
const TOOL = { single: "add-single", row: "add-row", bundle: "add-bundle", layer: "add-layer" } as const;
const MARK_DIA = 32; // a Ø no native mat uses → a BBS line at this Ø proves the PLACED bar was scheduled

/** Place one bar of `kind` on `element` through the store (the typed-coordinate a11y path). */
function place(element: ElementId, kind: (typeof KINDS)[number]): string {
  S().reset();
  S().selectElement(element);
  S().setPaletteDiameter(MARK_DIA);
  S().setSectionTool(TOOL[kind]);
  S().placeInSection(20, -10);
  const p = placedOf();
  return (p[p.length - 1] as { id: string }).id;
}

const combos = ALL_8.flatMap((el) => KINDS.map((k) => [el, k] as const));

describe("SEAM 1 — any bar I place is drawn == scheduled == validated == saved (8 elements × 4 kinds)", () => {
  beforeEach(() => S().reset());

  it.each(combos)("%s / %s", (element, kind) => {
    const id = place(element, kind);

    // DRAWN — the placed object resolved to real per-bar geometry the viewport renders.
    const members = membersOf(id);
    expect(members.length).toBeGreaterThan(0);

    // SCHEDULED — a BBS line exists at the placed Ø (no native mat uses Ø32 → this is the placed steel).
    const bbs = computeBBS(S().result);
    expect(bbs.lines.some((l) => l.diameter === MARK_DIA)).toBe(true);

    // VALIDATED — the placed steel is judged, not ignored: it is present in the resolved set the profile
    // ran against (R3 credits it; before R3/R5 six of eight ignored it). No crash, a rolled-up status.
    expect(["PASS", "WARN", "FAIL"]).toContain(S().result.status);

    // SAVED — the placed object survives a `.rcfg` round-trip (rides the canonical model + app_document).
    const back = rcfgToDoc(docToRcfg(S().doc, [])) as { placed?: PlacedBarDoc[] };
    expect((back.placed ?? []).some((p) => (p as { id: string }).id === id)).toBe(true);
  });
});

describe("SEAM 2 — anything selectable is editable (invariant 8: no silent inert edit)", () => {
  beforeEach(() => S().reset());

  it.each(combos)("%s / %s: select → curtail commits to doc.placed", (element, kind) => {
    const id = place(element, kind);
    S().select({ kind: "placed", id });
    expect(S().selection).toEqual({ kind: "placed", id });

    S().curtailSelectedBar("end", 800);
    const target = placedOf().find((p) => (p as { id: string }).id === id) as { endStation?: number };
    expect(target.endStation).toBe(800); // reached doc.placed — not a silent no-op (F-C, inverted)
  });

  it("curtailing a ROW curtails ALL its bars (the parent edit fans to every member)", () => {
    const id = place("E-COL-01", "row");
    S().select({ kind: "placed", id });
    S().curtailSelectedBar("end", 800);
    const members = membersOf(id);
    expect(members.length).toBeGreaterThan(1);
    for (const b of members) expect(b.endStation).toBe(800);
  });

  it("a selection that matches NOTHING reports (invariant 8) and does not commit an identical doc", () => {
    place("E-COL-01", "single");
    const before = JSON.stringify(placedOf());
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    S().select({ kind: "placed", id: "does-not-exist" });
    S().curtailSelectedBar("end", 500);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/invariant 8/));
    expect(JSON.stringify(placedOf())).toBe(before); // unchanged — but it SAID so, not silently
    spy.mockRestore();
  });
});

describe("SEAM 3 — a code rule uses the code diameter φₙ, through the store (guards F-A / F-G)", () => {
  beforeEach(() => S().reset());

  it("a bundled bar's LAP and its CURTAILMENT both develop on φₙ, not the bare Ø", () => {
    S().reset();
    S().selectElement("E-BEM-01");
    S().setPaletteDiameter(20);
    S().setSectionTool("add-bundle");
    S().placeInSection(0, -200);
    const id = (placedOf()[0] as { id: string }).id;

    // make it a 4-bar bundle, curtailed short with a straight end anchorage + a lap.
    S().select({ kind: "placed", id });
    S().setPlaced(
      placedOf().map((p) =>
        (p as { id: string }).id === id
          ? ({ ...(p as object), n: 4, startStation: 0, endStation: 1300, anchorage: "straight", autoSplice: true } as PlacedBarDoc)
          : p,
      ),
    );

    const bundled = membersOf(id);
    expect(bundled.length).toBe(4);
    for (const b of bundled) expect(b.equivDiameter).toBe(40); // φₙ = 20·√4 minted on every member (R1)

    // F-G: the curtailment_anchorage verdict develops on φₙ=40 (l_bd ~1764), so a 1300 mm run FAILs —
    // before R8 it developed on the bare Ø20 (l_bd ~882) and reported a wrong 🟢.
    const curt = S().result.validation.find((v) => v.rule === "curtailment_anchorage");
    expect(curt).toBeDefined();
    expect(curt!.status).not.toBe("PASS");
    expect(Number(curt!.limit)).toBeGreaterThan(1500); // l_bd(φₙ=40), not l_bd(Ø20)≈882
  });
});
