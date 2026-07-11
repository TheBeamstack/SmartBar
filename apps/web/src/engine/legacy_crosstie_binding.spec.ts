/**
 * v1.0.6-fix **R4 (finding F-E)** — the legacy beam cross-tie binding.
 *
 * Cross-ties bind by STABLE BAR INDEX (D-P3-4). Two beam layouts disagreed on how many bars the TOP face
 * has, and the legacy `nLegs` migration used the wrong one:
 *   • `beamLayoutBars`        → `montage + chapeauLeft + chapeauRight` (the **SUM**)  → 7 bars
 *   • the ENGINE (`beamInput`) → `montage + max(chapeauL, chapeauR)`   (the **MAX**)  → 5 bars
 * (the two supports never share a cross-section, D-V103-5).
 *
 * So opening a v1.0.2 beam with `nLegs > 2` converted its épingles against a 7-bar layout and handed
 * those indices to a 5-bar solve — anchoring cross-ties onto the wrong bars, or off the end of the list,
 * SILENTLY. R4 binds the migration off the engine layout and deletes the divergent twin.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { migrateDoc, engineBeamLayoutBars } from "./crossTies";
import { defaultBeamDoc, isBeamDoc, type BeamDoc } from "./document";
import { solveDoc } from "./solveDoc";

/** A v1.0.2-era beam: a raw `nLegs` count, no `crossTies` array yet. */
function legacyBeam(nLegs: number, patch: Partial<BeamDoc> = {}): BeamDoc {
  const d = { ...defaultBeamDoc(), ...patch };
  const stirrup = { ...d.stirrup, nLegs } as BeamDoc["stirrup"] & { nLegs: number };
  delete (stirrup as { crossTies?: unknown }).crossTies;
  return { ...d, stirrup };
}

describe("R4 / F-E — a legacy beam's cross-ties bind to bars that actually exist", () => {
  it("every migrated tie indexes a REAL bar in the solved layout", () => {
    const migrated = migrateDoc(legacyBeam(6)); // 6 legs → 2 interior épingles
    expect(isBeamDoc(migrated)).toBe(true);
    const beam = migrated as BeamDoc;
    const ties = beam.stirrup.crossTies;
    expect(ties.length).toBeGreaterThan(0);

    // the indices must be valid against what the SOLVER placed — the pre-R4 code bound them against a
    // 7-bar layout while the solve produces 5, so a tie could point past the end of `result.bars`.
    const solved = solveDoc(beam);
    for (const t of ties) {
      expect(t.barA).toBeLessThan(solved.bars.length);
      expect(t.barB).toBeLessThan(solved.bars.length);
    }
  });

  it("the migration binds against the ENGINE layout, not a SUM-inflated one", () => {
    const beam = migrateDoc(legacyBeam(6)) as BeamDoc;
    const engine = engineBeamLayoutBars(beam);
    for (const t of beam.stirrup.crossTies) {
      expect(t.barA).toBeLessThan(engine.length);
      expect(t.barB).toBeLessThan(engine.length);
    }
    // and the engine layout is the MAX form: montage(2) + max(chapeauL, chapeauR), never the sum.
    const supL = beam.supports.left.chapeau, supR = beam.supports.right.chapeau;
    const nTop = Math.max(2, (beam.topBars.enabled ? beam.topBars.nTop : 0) + Math.max(supL.enabled ? supL.nTop : 0, supR.enabled ? supR.nTop : 0));
    expect(engine.filter((b) => b.faceTag === "TOP")).toHaveLength(nTop);
  });

  it("ASYMMETRIC supports — where SUM and MAX diverge most — still bind correctly", () => {
    const base = defaultBeamDoc();
    const asym = legacyBeam(8, {
      supports: {
        left: { ...base.supports.left, chapeau: { ...base.supports.left.chapeau, enabled: true, nTop: 4 } },
        right: { ...base.supports.right, chapeau: { ...base.supports.right.chapeau, enabled: true, nTop: 1 } },
      },
    });
    const beam = migrateDoc(asym) as BeamDoc;
    const solved = solveDoc(beam);
    for (const t of beam.stirrup.crossTies) {
      expect(t.barA).toBeLessThan(solved.bars.length);
      expect(t.barB).toBeLessThan(solved.bars.length);
    }
  });

  it("is idempotent + lossless (re-migrating an already-migrated doc changes nothing)", () => {
    const once = migrateDoc(legacyBeam(6));
    const twice = migrateDoc(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
    expect((once as BeamDoc).stirrup).not.toHaveProperty("nLegs"); // the legacy field is dropped
  });

  it("a beam with nLegs ≤ 2 migrates to no cross-ties (perimeter cadre only)", () => {
    expect((migrateDoc(legacyBeam(2)) as BeamDoc).stirrup.crossTies).toHaveLength(0);
  });

  it("GUARD — the divergent SUM layout is gone and must not come back", () => {
    // Two beam layout functions that disagree IS the bug (F-E). Keep there being exactly one.
    const src = fs.readFileSync(path.join(__dirname, "crossTies.ts"), "utf8");
    const declared = src.match(/export function\s+(\w*[bB]eamLayoutBars)\b/g) ?? [];
    expect(declared).toEqual(["export function engineBeamLayoutBars"]);
  });
});
