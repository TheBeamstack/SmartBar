/**
 * G6 — coupe section dimensions + cover, and elevation region-length dims (spec §6.4, [REF-SYS-925c];
 * plan P2). `sectionAt` now populates the `CoupeView.dimensions` (width/height + enrobage on each
 * face) the PDF coupe previously ignored; the DXF coupe already drew them, so they flow to both. The
 * elevation fiche gains per-region length dimension lines under the overall length.
 */
import { describe, it, expect } from "vitest";
import {
  solveElement,
  sectionAt,
  defaultCoupeFor,
  type ElementSolveInput,
  type SolveResult,
  type TransverseRegion,
} from "@rebarconfig/core";
import { buildDxf1, buildElevationFiche, buildPdf } from "@rebarconfig/exporters";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();

/** A reference column with bars on all four faces (so both faces carry a cover dimension). */
function column(regions?: TransverseRegion[]): SolveResult {
  const b = 300, h = 600, cover = 30, phiT = 8;
  const input: ElementSolveInput = {
    element: "E-COL-01",
    profile: "BAEL_COLUMN",
    section: "RECT",
    geometry: { b, h, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover,
    exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT,
    phiLInset: 20,
    longitudinal: [
      { zone: "As_total", groupId: "L1", shape: loadShape("droite"), params: { L: 3000 }, diameter: 20, faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"], asReq: 1800, tensionFace: "BOTTOM" },
    ],
    transverse: [
      { zone: "Asw", groupId: "T1", shape: loadShape("cadre_rect"), params: { w: b - 2 * cover - phiT, h: h - 2 * cover - phiT }, diameter: phiT, spacing: 200, nLegs: 2, aswReqPerM: 0, ...(regions ? { regions } : {}) },
    ],
    code,
  };
  return solveElement(input);
}

describe("sectionAt emits section dimensions + cover on both faces", () => {
  const view = sectionAt(column(), defaultCoupeFor(column()));
  const kinds = view.dimensions.map((d) => d.kind);

  it("includes a WIDTH and a HEIGHT dimension matching the section", () => {
    expect(kinds).toContain("WIDTH");
    expect(kinds).toContain("HEIGHT");
    expect(view.dimensions.find((d) => d.kind === "WIDTH")!.value).toBeCloseTo(300, 0);
    expect(view.dimensions.find((d) => d.kind === "HEIGHT")!.value).toBeCloseTo(600, 0);
  });

  it("includes a COVER dimension on EACH face (top + bottom)", () => {
    const covers = view.dimensions.filter((d) => d.kind === "COVER");
    expect(covers).toHaveLength(2);
    // enrobage to the bar centroid ≈ cover + φt + φℓ/2 = 30 + 8 + 10 = 48 mm on each face
    for (const c of covers) expect(c.value).toBeCloseTo(48, 0);
  });
});

describe("the cover/section dims flow to the exporters", () => {
  it("the DXF coupe writes the enrobage cover labels on COTATION", () => {
    const dxf = buildDxf1(column());
    expect(dxf).toMatch(/0\nTEXT\n8\nCOTATION\n[^]*?\n1\nenr\. \d+/);
  });

  it("the PDF renders without error (drawCoupe now draws the dimensions)", async () => {
    const bytes = await buildPdf(column(), { date: "2026-06-30" });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

describe("elevation fiche region-length dimensions", () => {
  // region lengths (500/2000/500) chosen so none collide with the section depth (600) label
  const denseEnds: TransverseRegion[] = [
    { from: 0, to: 500, spacing: 100 },
    { from: 500, to: 2500, spacing: 200 },
    { from: 2500, to: 3000, spacing: 100 },
  ];

  it("adds one length dim per region (plus the overall length)", () => {
    const uniform = buildElevationFiche(column());
    const region = buildElevationFiche(column(denseEnds));
    // the region fiche carries strictly more dimension lines (the per-region lengths)
    expect(region.dims.length).toBe(uniform.dims.length + 3);
    const labels = region.dims.map((d) => d.label);
    expect(labels).toContain("3000"); // overall length retained
    expect(labels.filter((l) => l === "500")).toHaveLength(2); // the two dense end regions
    expect(labels).toContain("2000"); // the loose middle region length
  });
});
