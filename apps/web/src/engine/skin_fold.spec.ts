/**
 * v1.0.6-fix **R6 (finding F-F / DR-2)** — retire the DUAL skin path.
 *
 * v1.0.5 spec P-F required the legacy `SUPP_SKIN_SIDE` supplement fanout be *folded into* the skin
 * `BarRow` model, so there is exactly ONE way to add side-face steel. It never was: both survived, each
 * crediting `As,prov` on its own accounting path, so adding skin BOTH ways counted the same steel twice
 * (DR-2 reproduced: base 1885 → supplement 1998 → +skin row 2111.2 = +2×area). R6 folds every legacy skin
 * supplement into a `PlacedRowDoc{skin}` per lateral face at the `migrateDoc` (load) chokepoint — the same
 * idempotent pattern as `foldEpingleSupplements` — and drops `SUPP_SKIN_SIDE` from the scheme catalogs so
 * no NEW skin supplement can be created. These assert the inverted defect.
 */
import { describe, it, expect } from "vitest";
import { migrateDoc } from "./crossTies";
import { defaultBeamDoc, type BeamDoc, type PlacedRowDoc, type SupplementEdit } from "./document";
import { solveDoc } from "./solveDoc";

const skinSupplement = (over: Partial<SupplementEdit> = {}): SupplementEdit => ({
  instanceId: "sk1",
  supplementId: "SUPP_SKIN_SIDE",
  group: "B1",
  barIndices: [],
  diameter: 12,
  params: { count_per_side: 2 },
  ...over,
});

const beamWithSkin = (supp: SupplementEdit[] = [skinSupplement()]): BeamDoc =>
  ({ ...defaultBeamDoc(), supplements: supp }) as BeamDoc;

const skinRows = (doc: BeamDoc): PlacedRowDoc[] =>
  (doc.placed ?? []).filter((p): p is PlacedRowDoc => "kind" in p && p.kind === "row" && p.skin === true);

describe("R6 / F-F — a legacy skin supplement folds into the one skin-row model", () => {
  it("migrateDoc converts a SUPP_SKIN_SIDE supplement into a skin BarRow per lateral face", () => {
    const migrated = migrateDoc(beamWithSkin()) as BeamDoc;

    // the supplement is gone (its accounting path no longer runs) …
    expect(migrated.supplements.some((s) => s.supplementId === "SUPP_SKIN_SIDE")).toBe(false);
    // … replaced by exactly two skin rows (LEFT + RIGHT), each `count_per_side` bars of the same Ø.
    const rows = skinRows(migrated);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.count).toBe(2);
      expect(r.diameter).toBe(12);
      expect(r.direction).toBe("v"); // a side-face row runs up the section height
      expect(r.skin).toBe(true);
    }
    // one on each face (u = ±uMax)
    const us = rows.map((r) => Math.sign(r.anchor.u)).sort();
    expect(us).toEqual([-1, 1]);
  });

  it("is IDEMPOTENT — re-migrating adds no duplicate rows (the fold self-gates)", () => {
    const once = migrateDoc(beamWithSkin()) as BeamDoc;
    const twice = migrateDoc(once) as BeamDoc;
    expect(skinRows(twice)).toHaveLength(2);
    expect(twice.supplements.some((s) => s.supplementId === "SUPP_SKIN_SIDE")).toBe(false);
    expect(twice.placed).toEqual(once.placed); // stable ids → no growth
  });

  it("reaches the schedule ONCE and losslessly — exactly count_per_side×2 skin bars, single path", () => {
    const migrated = migrateDoc(beamWithSkin()) as BeamDoc;
    const withSkin = solveDoc(migrated);
    // the folded skin bars reach the resolved/scheduled steel (lossless: not dropped) …
    const skinBars = (withSkin.longBars ?? []).filter((b) => b.groupId.startsWith("sk1__skin"));
    // … exactly 2 faces × count_per_side (2) = 4 bars — credited ONCE, not doubled by a lingering
    // supplement path (which is gone). Before R6 the supplement AND a skin row could each add them.
    expect(skinBars).toHaveLength(4);
    expect(migrated.supplements.filter((s) => s.supplementId === "SUPP_SKIN_SIDE")).toHaveLength(0);
  });

  it("a beam with NO skin supplement is untouched (byte-identical placed)", () => {
    const plain = defaultBeamDoc();
    const migrated = migrateDoc(plain) as BeamDoc;
    expect(skinRows(migrated)).toHaveLength(0);
    expect(migrated.placed).toEqual(plain.placed); // absent → absent
  });
});
