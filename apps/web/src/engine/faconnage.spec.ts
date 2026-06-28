/**
 * F6 (web side) — the doc façonnage (shape params + hooks) flows through `solveDoc` to the solved
 * group shape; a legacy doc (no façonnage) is byte-identical to the v1.0.1 default; and the choice
 * survives a `.rcfg` round-trip.
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "./solveDoc";
import { defaultColumnDoc, type ColumnDoc } from "./document";
import { docToRcfg, rcfgToDoc } from "./rcfgDoc";
import { serializeRcfg, parseRcfg } from "@rebarconfig/exporters";

describe("façonnage flows through the adapter", () => {
  it("a chosen shape + params reach the solved longitudinal group", () => {
    const base = defaultColumnDoc();
    const doc: ColumnDoc = {
      ...base,
      longitudinal: {
        ...base.longitudinal,
        shapeId: "Z_BAR",
        faconnage: { shapeParams: { run1: 800, riser: 300, run2: 800, angle: 90 } },
      },
    };
    const g = solveDoc(doc).groups.find((x) => x.groupId === base.longitudinal.groupId)!;
    expect(g.shape.archetypeId).toBe("Z_BAR");
    expect(g.shape.fiche.legs).toHaveLength(3); // run1 / riser / run2
  });

  it("end hooks add hooks to the straight default bar", () => {
    const base = defaultColumnDoc();
    const hooked: ColumnDoc = {
      ...base,
      longitudinal: { ...base.longitudinal, faconnage: { hooks: { start: 135, end: "none" } } },
    };
    const g = solveDoc(hooked).groups.find((x) => x.groupId === base.longitudinal.groupId)!;
    expect(g.shape.fiche.hooks).toHaveLength(1);
    expect(g.shape.fiche.hooks[0]!.angle).toBe(135);
  });

  it("a legacy doc (no façonnage) is byte-identical to the v1.0.1 default", () => {
    const base = defaultColumnDoc();
    const withEmpty: ColumnDoc = { ...base, longitudinal: { ...base.longitudinal, faconnage: undefined } };
    expect(JSON.stringify(solveDoc(withEmpty))).toBe(JSON.stringify(solveDoc(base)));
  });

  it(".rcfg round-trips the façonnage", () => {
    const base = defaultColumnDoc();
    const faconnage = { shapeParams: { L: 3200 }, hooks: { start: 180 as const, end: 90 as const } };
    const doc: ColumnDoc = { ...base, longitudinal: { ...base.longitudinal, faconnage } };
    const round = rcfgToDoc(parseRcfg(serializeRcfg(docToRcfg(doc, []))));
    expect((round as ColumnDoc).longitudinal.faconnage).toEqual(faconnage);
  });
});
