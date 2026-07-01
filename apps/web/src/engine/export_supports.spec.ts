/**
 * v1.0.3 G7 follow-up — the app now threads the beam's V1/V2 bearing width + bottom-bar anchorage
 * into the shop-drawing exporters (previously the labels rendered but the width/anchorage annotations
 * were blank because the doc data never reached PdfMetadata/DXF). Verifies the extractor + that the
 * DXF export actually carries the `b=…` / `l.a=…` support annotations.
 */
import { describe, it, expect } from "vitest";
import { beamSupportsMeta, exportDxf } from "./exportActions";
import { solveDoc } from "./solveDoc";
import { defaultBeamDoc, defaultColumnDoc, type BeamDoc } from "./document";

describe("G7 export — beam support width/anchorage threading", () => {
  it("beamSupportsMeta extracts left/right width + anchorage from a beam doc", () => {
    const doc: BeamDoc = {
      ...defaultBeamDoc(),
      supports: {
        left: { ...defaultBeamDoc().supports.left, width: 350, anchorage: 450 },
        right: { ...defaultBeamDoc().supports.right, width: 300, anchorage: 400 },
      },
    };
    const meta = beamSupportsMeta(doc);
    expect(meta).toEqual([
      { side: "left", width: 350, anchorage: 450 },
      { side: "right", width: 300, anchorage: 400 },
    ]);
  });

  it("returns undefined for a non-beam element (no supports)", () => {
    expect(beamSupportsMeta(defaultColumnDoc())).toBeUndefined();
  });

  it("the DXF export carries the V1/V2 width + anchorage annotations when supports are supplied", () => {
    const doc = defaultBeamDoc(); // ships width 300 / anchorage 400 both sides
    const result = solveDoc(doc);
    // [] routes through buildDxf1 (it seeds its own default coupe) with the supports threaded in.
    const dxf = exportDxf(result, [], beamSupportsMeta(doc));
    // the support label now includes the bearing width + anchorage (b=… / l.a=…)
    expect(dxf).toContain("b=300");
    expect(dxf).toContain("l.a=400");
  });

  it("without the supports arg the DXF still builds (labels only, no width/anchorage)", () => {
    const doc = defaultBeamDoc();
    const result = solveDoc(doc);
    const dxf = exportDxf(result, []);
    expect(dxf).not.toContain("b=300");
    expect(dxf.length).toBeGreaterThan(0);
  });
});
