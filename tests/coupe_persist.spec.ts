/**
 * Coupe persistence (spec §9.5/§10, plan P5). `section_cuts[]` round-trips through `.rcfg`
 * deep-equal, unknown cut fields are preserved, and a file with NO cuts loads the seeded default
 * representative coupe.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  serializeRcfg,
  parseRcfg,
  sectionCutsOrDefault,
  type RcfgProject,
} from "@rebarconfig/exporters";
import { defaultCoupeFor, type SectionCut } from "@rebarconfig/core";
import { FIXTURES_DIR } from "./helpers";
import { referenceBeam } from "./bbs-helpers";

const baseProject = (): RcfgProject =>
  parseRcfg(fs.readFileSync(path.join(FIXTURES_DIR, "valid", "column.rcfg.json"), "utf8"));

describe("coupe_persist (§9.5/§10)", () => {
  const cuts: SectionCut[] = [
    { id: "A", label_fr: "Coupe A-A", origin: { x: 0, y: 1500, z: 0 }, normal: { x: 0, y: 1, z: 0 }, isDefault: true },
    // an oblique user coupe carrying an UNKNOWN cut field (future tooling) → must survive
    { id: "B", origin: { x: 0, y: 2200, z: 0 }, normal: { x: 0, y: 1, z: 0.3 }, lookBehind_mm: 140, renderHint: { style: "hatched" } } as SectionCut,
  ];

  it("section_cuts[] round-trips deep-equal (incl. the unknown cut field)", () => {
    const project: RcfgProject = { ...baseProject(), section_cuts: cuts };
    const round = parseRcfg(serializeRcfg(project));
    expect(round.section_cuts).toEqual(cuts);
    expect((round.section_cuts![1] as Record<string, unknown>)["renderHint"]).toEqual({ style: "hatched" });
  });

  it("a file with no section_cuts loads the seeded default coupe", () => {
    const project = baseProject();
    expect(project.section_cuts).toBeUndefined();
    const result = referenceBeam();
    const loaded = sectionCutsOrDefault(project, result);
    expect(loaded.length).toBe(1);
    expect(loaded[0]!.isDefault).toBe(true);
    expect(loaded[0]).toEqual(defaultCoupeFor(result));
  });

  it("uses the persisted cuts when present (does not re-seed)", () => {
    const project: RcfgProject = { ...baseProject(), section_cuts: cuts };
    const loaded = sectionCutsOrDefault(project, referenceBeam());
    expect(loaded).toBe(project.section_cuts);
    expect(loaded.length).toBe(2);
  });
});
