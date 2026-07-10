/**
 * v1.0.5 M3 (P-D, [REF-SYS-611]) — multiple flexural layers.
 *
 * A `Layer` places an explicit 2nd/3rd row of bottom/top steel attaching to a face, offset inboard by
 * `Ø + layerGap`. Its bars feed the **area-weighted effective depth `d`** (`computeZoneGeometryWeighted`)
 * — a lower second layer correctly LOWERS `d`. A doc with no layer keeps the grouped path (byte-identical).
 */
import { describe, it, expect } from "vitest";
import { solveElement, type SolveResult, type Layer } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const etrier = loadShape("etrier");

/** A beam whose BOTTOM zone may carry a second layer placed as `input.placed`. */
function beam(layer?: Layer): SolveResult {
  return solveElement({
    element: "E-BEM-01", profile: "BAEL_BEAM", section: "RECT",
    geometry: { b: 300, h: 600, L: 6000 },
    material: { f_c28: 25, f_e: 500 }, cover: 30, exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 2, nBottom: 3, nLeft: 0, nRight: 0 },
    phiT: 8, phiLInset: 20,
    longitudinal: [
      { zone: "As_span_bottom", groupId: "B1", role: "PRIMARY_LONGITUDINAL", shape: droite, params: { L: 6000 }, diameter: 20, faces: ["BOTTOM"], asReq: 900, tensionFace: "BOTTOM" },
      { zone: "As_montage", groupId: "M1", role: "PRIMARY_LONGITUDINAL", shape: droite, params: { L: 6000 }, diameter: 12, faces: ["TOP"], asReq: 0, tensionFace: "TOP" },
    ],
    transverse: [{ zone: "Asw", groupId: "S1", shape: etrier, params: { w: 300 - 2 * 30 - 8, h: 600 - 2 * 30 - 8 }, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 }],
    ...(layer ? { placed: [layer] } : {}),
    code,
  });
}

/** A 2nd bottom layer of 3 Ø20 bars, one step inboard of the cover layer. */
// span 100 keeps all 3 layer bars nearest the BOTTOM face (a wider band would put the outer bars nearer
// LEFT/RIGHT, where the A2 region rule would credit them to a side zone instead of the bottom).
const secondLayer: Layer = {
  kind: "layer", id: "L2", face: "BOTTOM", layerIndex: 1, count: 3, inset: 48, span: 100,
  shape: droite, params: { L: 6000 }, diameter: 20,
};

const dOf = (r: SolveResult, zone: string) => r.zones.find((z) => z.zone === zone)!.d;

describe("M3 P-D — a second flexural layer lowers d", () => {
  it("a single-layer beam keeps the grouped path (byte-identical: no longBars)", () => {
    const base = beam();
    expect(base.longBars).toBeUndefined();
    expect(base.hasUserAddressableContent).toBeFalsy();
  });

  it("a 2nd bottom layer lowers the effective depth d of the bottom zone", () => {
    const base = beam();
    const withLayer = beam(secondLayer);
    expect(withLayer.hasUserAddressableContent).toBe(true);
    expect(dOf(withLayer, "As_span_bottom")).toBeLessThan(dOf(base, "As_span_bottom"));
  });

  it("d is the exact area-weighted mean of the two layers' depths", () => {
    const base = beam();
    const withLayer = beam(secondLayer);
    const d1 = dOf(base, "As_span_bottom"); // single layer: all 3 bars at the cover depth
    const d2 = withLayer.zones.find((z) => z.zone === "As_span_bottom")!.d;
    // uniform Ø → equal weights: 3 bars at d1 + 3 bars one step (Ø+max(Ø,20)=40 mm) shallower.
    const step = 20 + Math.max(20, 20);
    expect(d2).toBeCloseTo((3 * d1 + 3 * (d1 - step)) / 6, 3);
  });

  it("the layer bars schedule (3 real bars, one merged mark)", () => {
    const withLayer = beam(secondLayer);
    const layerBars = withLayer.longBars!.filter((b) => b.groupId.startsWith("L2#"));
    expect(layerBars.length).toBe(3);
  });
});
