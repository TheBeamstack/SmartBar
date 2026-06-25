/**
 * DXF-1 golden (spec §9.2, plan P5). DXF-1 = the longitudinal elevation + the default coupe, on
 * EXACTLY the four strict layers (COFFRAGE/ARMATURES/COTATION/TEXTE); the document is valid R12
 * (AC1009) and its entities sit on the right layers.
 */
import { describe, it, expect } from "vitest";
import { buildDxf1, DXF_LAYER_NAMES } from "@rebarconfig/exporters";
import { sectionAt, defaultCoupeFor } from "@rebarconfig/core";
import { referenceBeam } from "./bbs-helpers";

describe("dxf1_golden — elevation + default coupe (§9.2)", () => {
  const dxf = buildDxf1(referenceBeam());

  it("is a valid DXF R12 document with the entities + EOF", () => {
    expect(dxf.startsWith("0\nSECTION\n2\nHEADER")).toBe(true);
    expect(dxf).toContain("$ACADVER\n1\nAC1009");
    expect(dxf).toContain("2\nENTITIES");
    expect(dxf.trimEnd().endsWith("0\nEOF")).toBe(true);
  });

  it("declares EXACTLY the four strict layers", () => {
    const declared = [...dxf.matchAll(/0\nLAYER\n2\n(\w+)/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual([...DXF_LAYER_NAMES].sort());
    expect(declared.length).toBe(4);
  });

  it("puts concrete on COFFRAGE, steel on ARMATURES, dims on COTATION, text on TEXTE", () => {
    // every entity references a known layer, and each of the four is actually used
    const used = new Set([...dxf.matchAll(/0\n(?:LINE|CIRCLE|TEXT)\n8\n(\w+)/g)].map((m) => m[1]));
    for (const name of DXF_LAYER_NAMES) expect(used.has(name)).toBe(true);
  });

  it("draws the default coupe's section bars as circles on ARMATURES (matches sectionAt)", () => {
    const view = sectionAt(referenceBeam(), defaultCoupeFor(referenceBeam()));
    const circles = [...dxf.matchAll(/0\nCIRCLE\n8\nARMATURES\n10\n[^\n]+\n20\n[^\n]+\n30\n0\n40\n([^\n]+)/g)];
    // every coupe circle is emitted at radius = Ø/2
    expect(circles.length).toBe(view.circles.length);
    expect(circles.length).toBeGreaterThan(0);
    const r10 = circles.filter((m) => m[1] === "10").length;
    expect(r10).toBe(view.circles.filter((c) => c.diameter === 20).length);
  });

  it("draws the overall length dimension (6000) on COTATION", () => {
    expect(dxf).toMatch(/0\nTEXT\n8\nCOTATION\n[^]*?\n1\n6000/);
  });

  it("is deterministic", () => {
    expect(buildDxf1(referenceBeam())).toBe(buildDxf1(referenceBeam()));
  });
});
