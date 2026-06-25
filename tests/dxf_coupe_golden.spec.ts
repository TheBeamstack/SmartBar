/**
 * DXF coupe golden (spec §9.2/§9.5, plan P5) — DXF-2. A user-defined coupe (incl. an OBLIQUE one)
 * becomes a DXF section view whose entities are stable; the cutting-line/tag for each coupe appears
 * on the elevation.
 */
import { describe, it, expect } from "vitest";
import { buildDxfCoupes } from "@rebarconfig/exporters";
import type { SectionCut } from "@rebarconfig/core";
import { referenceBeam } from "./bbs-helpers";

const cuts: SectionCut[] = [
  { id: "A", origin: { x: 0, y: 2000, z: 0 }, normal: { x: 0, y: 1, z: 0 } }, // perpendicular
  { id: "B", origin: { x: 0, y: 4000, z: 0 }, normal: { x: 0, y: 1, z: 0.4 } }, // oblique
];

describe("dxf_coupe_golden — multiple + oblique coupes (§9.5)", () => {
  const dxf = buildDxfCoupes(referenceBeam(), cuts);

  it("draws a cutting-line tag for each coupe on the elevation (TEXTE)", () => {
    const tags = [...dxf.matchAll(/0\nTEXT\n8\nTEXTE\n[^]*?\n1\n([AB])\n/g)].map((m) => m[1]);
    expect(new Set(tags)).toEqual(new Set(["A", "B"]));
  });

  it("emits a concrete coupe outline (COFFRAGE) and section bar circles (ARMATURES)", () => {
    expect(dxf).toContain("0\nLINE\n8\nCOFFRAGE");
    const circles = [...dxf.matchAll(/0\nCIRCLE\n8\nARMATURES/g)];
    expect(circles.length).toBeGreaterThan(0);
  });

  it("the oblique coupe's view box is wider in t than the upright section (stretched)", () => {
    // perpendicular only
    const perp = buildDxfCoupes(referenceBeam(), [cuts[0]!]);
    const obl = buildDxfCoupes(referenceBeam(), [cuts[1]!]);
    const span = (s: string) => {
      const ys = [...s.matchAll(/0\nLINE\n8\nCOFFRAGE\n10\n[^\n]+\n20\n([^\n]+)\n30\n0\n11\n[^\n]+\n21\n([^\n]+)/g)]
        .flatMap((m) => [Number(m[1]), Number(m[2])]);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(span(obl)).toBeGreaterThan(span(perp));
  });

  it("is deterministic", () => {
    expect(buildDxfCoupes(referenceBeam(), cuts)).toBe(buildDxfCoupes(referenceBeam(), cuts));
  });
});
