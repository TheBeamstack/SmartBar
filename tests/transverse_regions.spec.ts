/**
 * F5 — user-defined transverse regions (spec §5, [REF-SYS-757]). The transverse-segment seam now
 * carries an ordered region list so cadre/stirrup spacing varies along the member. Verifies the pure
 * station math (region-by-region, byte-identical for a single full-length region), placement, the BBS
 * per-region totals, the elevation-fiche per-region callouts, and the seismic WARN reconciliation.
 */
import { describe, it, expect } from "vitest";
import {
  solveElement,
  solveColumn,
  placeBars,
  transverseStations,
  regionStations,
  regionStationCounts,
  type ElementSolveInput,
  type SolveResult,
  type TransverseRegion,
} from "@rebarconfig/core";
import { computeBBS, buildElevationFiche } from "@rebarconfig/exporters";
import { makeBaelPack, makeRpsOverlay } from "@rebarconfig/codepacks";
import { loadShape } from "./p3-helpers";

const code = makeBaelPack();
const L = 6000;

/** the reference beam, optionally with stirrup spacing regions. */
function beam(regions?: TransverseRegion[]): SolveResult {
  const b = 300, h = 600, cover = 30, phiT = 8;
  const input: ElementSolveInput = {
    element: "E-BEM-01",
    profile: "BAEL_BEAM",
    section: "RECT",
    geometry: { b, h, L },
    material: { f_c28: 25, f_e: 500 },
    cover,
    exposure: "EXTERIOR",
    layout: { principle: "FREE", nTop: 2, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT,
    phiLInset: 20,
    longitudinal: [
      { zone: "As_span_bottom", groupId: "B1", shape: loadShape("droite"), params: { L }, diameter: 20, faces: ["BOTTOM"], asReq: 900, tensionFace: "BOTTOM", continuedToSupport: 1 },
    ],
    transverse: [
      {
        zone: "Asw_shear",
        groupId: "S1",
        shape: loadShape("etrier"),
        params: { w: b - 2 * cover - phiT, h: h - 2 * cover - phiT },
        diameter: phiT,
        spacing: 200,
        nLegs: 2,
        aswReqPerM: 300,
        ...(regions ? { regions } : {}),
      },
    ],
    code,
  };
  return solveElement(input);
}

const denseEnds: TransverseRegion[] = [
  { from: 0, to: 1000, spacing: 100 },
  { from: 1000, to: 5000, spacing: 200 },
  { from: 5000, to: 6000, spacing: 100 },
];

describe("regionStations (pure)", () => {
  it("a single full-length region is byte-identical to uniform transverseStations", () => {
    expect(regionStations([{ from: 0, to: L, spacing: 200 }], L)).toEqual(transverseStations(L, 200));
  });

  it("emits stations region-by-region at each region's spacing", () => {
    const ys = regionStations(denseEnds, L);
    // dense ends (100) + loose middle (200) ⇒ more stations than uniform 200
    expect(ys.length).toBeGreaterThan(transverseStations(L, 200).length);
    // sorted + de-duplicated at the shared boundaries
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
  });

  it("regionStationCounts sums to the total and has one entry per region", () => {
    const counts = regionStationCounts(denseEnds, L);
    expect(counts).toHaveLength(3);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(regionStations(denseEnds, L).length);
    // the dense end regions each hold more cadres than the looser middle per unit length
    const perMm = (n: number, span: number) => n / span;
    expect(perMm(counts[0]!, 1000)).toBeGreaterThan(perMm(counts[1]!, 4000));
  });
});

describe("placeBars + BBS reflect regions", () => {
  it("a dense-end beam places more transverse loops than the uniform beam", () => {
    const uniformLoops = placeBars(beam()).filter((p) => p.groupId === "S1").length;
    const regionLoops = placeBars(beam(denseEnds)).filter((p) => p.groupId === "S1").length;
    expect(regionLoops).toBeGreaterThan(uniformLoops);
  });

  it("the BBS stirrup count equals the summed per-region stations", () => {
    const bbs = computeBBS(beam(denseEnds));
    const stirrup = bbs.lines.find((l) => l.groupIds.includes("S1"))!;
    expect(stirrup.count).toBe(regionStations(denseEnds, L).length);
    // and it exceeds the uniform schedule's count
    const uniform = computeBBS(beam()).lines.find((l) => l.groupIds.includes("S1"))!;
    expect(stirrup.count).toBeGreaterThan(uniform.count);
  });

  it("a single uniform region keeps the schedule byte-identical to no regions", () => {
    const a = computeBBS(beam());
    const b = computeBBS(beam([{ from: 0, to: L, spacing: 200 }]));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe("elevation fiche per-region callouts", () => {
  it("emits one Ø e=spacing callout per region (vs one for a uniform set)", () => {
    const uniform = buildElevationFiche(beam());
    expect(uniform.tieCallouts).toHaveLength(1);

    const region = buildElevationFiche(beam(denseEnds));
    expect(region.tieCallouts).toHaveLength(3);
    const texts = region.tieCallouts.map((c) => c.text);
    expect(texts.filter((tx) => tx.includes("e=100"))).toHaveLength(2);
    expect(texts.some((tx) => tx.includes("e=200"))).toBe(true);
  });
});

describe("seismic reconciliation (WARN, never silent override)", () => {
  function seismicColumn(regions?: TransverseRegion[]) {
    const overlay = makeRpsOverlay({ code: "RPS-2011", zone: 2, ductility: "ND2" });
    return solveColumn({
      element: "E-COL-01",
      geometry: { b: 400, h: 400, H: 3000 },
      material: { f_c28: 25, f_e: 500 },
      cover: 30,
      exposure: "EXTERIOR",
      longitudinal: { groupId: "L1", shape: loadShape("droite"), diameter: 20, layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 }, asReq: 1800 },
      tie: { groupId: "T1", shape: loadShape("cadre_rect"), diameter: 8, spacing: 100, nLegs: 4, aswReqPerM: 300, hookAngle: 135, hookExtFactor: 10, ...(regions ? { regions } : {}) },
      confinementPresent: ["SUPP_EPINGLE_CROSSTIE", "SUPP_DIAMANT_TIE"],
      seismic: { overlay, longBarsTotal: 8, longBarsEngaged: 8 },
      code,
    });
  }

  // s_crit ND2 = min(8·20, 0.5·400, 150) = 150 mm; l_c = 500 mm
  it("a looser-than-code end region warns (does not block)", () => {
    const r = seismicColumn([
      { from: 0, to: 500, spacing: 250 }, // end zone, > s_crit(150)
      { from: 500, to: 2500, spacing: 250 },
      { from: 2500, to: 3000, spacing: 100 },
    ]);
    const w = r.validation.find((v) => v.rule === "region_crit_spacing:Asw_confinement")!;
    expect(w.status).toBe("WARN");
    expect(r.status).not.toBe("FAIL"); // WARN-only — export not blocked by this rule
  });

  it("a compliant end region passes; no regions emits no region rule (goldens safe)", () => {
    const ok = seismicColumn([
      { from: 0, to: 500, spacing: 100 },
      { from: 500, to: 2500, spacing: 200 },
      { from: 2500, to: 3000, spacing: 100 },
    ]);
    expect(ok.validation.find((v) => v.rule === "region_crit_spacing:Asw_confinement")!.status).toBe("PASS");

    const none = seismicColumn();
    expect(none.validation.some((v) => v.rule.startsWith("region_crit_spacing"))).toBe(false);
  });
});
