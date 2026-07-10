/**
 * v1.0.5 M4 (Track V, spec Part III) — honest validation of the freely-placed steel.
 *
 * M2/M3 gave the engine bundles / multi-layer / skin / curtailed placed bars; M4 JUDGES them with the
 * three honest tiers. One case per rule at 🔴 / 🟠 / 🟢, the **F1 guarantee** asserted for every band (an
 * exactly-at-limit design is 🟢, never 🟠), the affected-bar id (a FAIL reds exactly the offending bar[s]),
 * and the generic-geometry rules generalised to a non-RECT (slab) element (V-A). Plus the correctness fix
 * this phase carries: a legitimate bundle's touching members no longer trip the clear-spacing check.
 */
import { describe, it, expect } from "vitest";
import {
  solveElement, solveSlab,
  type SolveResult, type Bundle, type Layer, type BarRow, type SingleBar,
} from "@rebarconfig/core";
import { makeBaelPack, makeEc2Pack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");
const etrier = loadShape("etrier");

const ruleOf = (r: SolveResult, rule: string) => r.validation.find((v) => v.rule === rule);
const statusOf = (r: SolveResult, rule: string) => ruleOf(r, rule)?.status;

// --- a 400×600 column that may carry one placed input ------------------------------------------------
function column(placed?: (Bundle | Layer | BarRow | SingleBar)[], h = 600): SolveResult {
  return solveElement({
    element: "E-COL-01", profile: "BAEL_COLUMN", section: "RECT",
    geometry: { b: 400, h, H: 3000 },
    material: { f_c28: 25, f_e: 500 }, cover: 30, exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT: 8, phiLInset: 20,
    longitudinal: [{ zone: "As_total", groupId: "L1", role: "PRIMARY_LONGITUDINAL", shape: droite, params: { L: 3000 }, diameter: 20, faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"], asReq: 1800, tensionFace: "BOTTOM" }],
    transverse: [{ zone: "Asw", groupId: "T1", shape: cadre, params: { w: 314, h: h - 76 }, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 }],
    ...(placed ? { placed } : {}),
    code,
  });
}

// --- a 300×600×6000 beam whose bottom may carry a placed bar/layer -----------------------------------
function beam(placed?: (Layer | SingleBar)[]): SolveResult {
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
    transverse: [{ zone: "Asw", groupId: "S1", shape: etrier, params: { w: 218, h: 518 }, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 }],
    ...(placed ? { placed } : {}),
    code,
  });
}

const bnd = (over: Partial<Bundle>): Bundle => ({
  kind: "bundle", id: "BND", position: { u: 0, v: 0 }, n: 3, shape: droite, params: { L: 3000 }, diameter: 16, ...over,
});

// ---------------------------------------------------------------------------------------------------
describe("V-B — bundle count (bundle_max)", () => {
  it("🟢 4 bars = at the limit (F1: at-limit is green)", () => {
    expect(statusOf(column([bnd({ n: 4 })]), "bundle_max")).toBe("PASS");
  });
  it("🔴 5 bars > max → un-buildable", () => {
    const r = column([bnd({ n: 5 })]);
    expect(statusOf(r, "bundle_max")).toBe("FAIL");
    // affected-bar id: the FAIL reds every member of the bundle, nothing else.
    expect(ruleOf(r, "bundle_max")!.affectedGroupIds).toEqual(["BND#0", "BND#1", "BND#2", "BND#3", "BND#4"]);
  });
  it("🟢/🔴 at a lap the limit tightens to 3", () => {
    expect(statusOf(column([bnd({ n: 3, autoSplice: true })]), "bundle_max")).toBe("PASS");
    expect(statusOf(column([bnd({ n: 4, autoSplice: true })]), "bundle_max")).toBe("FAIL");
  });
});

describe("V-B — bundle cover (bundle_cover), F1-banded", () => {
  const phiN = code.bundleEquivDiameter(16, 3); // 16·√3
  // place the bundle at a chosen clear cover on the +u face: providedCover = 200 − u − φₙ/2.
  const atCover = (cov: number): Bundle => bnd({ position: { u: 200 - phiN / 2 - cov, v: 0 } });
  it("🟢 exactly at the cover minimum (F1)", () => {
    expect(statusOf(column([atCover(30)]), "bundle_cover")).toBe("PASS");
  });
  it("🟠 just below the minimum (inside the band)", () => {
    expect(statusOf(column([atCover(29)]), "bundle_cover")).toBe("WARN"); // 30·0.95 = 28.5 < 29 < 30
  });
  it("🔴 the bundle pokes out of the concrete", () => {
    expect(statusOf(column([atCover(-5)]), "bundle_cover")).toBe("FAIL");
  });
});

describe("V-B — a legitimate bundle's touching bars are NOT a clear-spacing FAIL (correctness fix)", () => {
  it("a well-placed triple bundle is 🟢 overall (no spurious addressable_clear_spacing)", () => {
    const r = column([bnd({ n: 3, position: { u: 0, v: 0 } })]);
    expect(statusOf(r, "addressable_clear_spacing")).not.toBe("FAIL");
    expect(r.status).toBe("PASS");
  });
});

describe("V-D — between-layer clear spacing (layer_clear_spacing), F1-banded", () => {
  const layer = (gap?: number): Layer => ({
    kind: "layer", id: "L2", face: "BOTTOM", layerIndex: 1, count: 3, inset: 48, span: 100,
    shape: droite, params: { L: 6000 }, diameter: 20, ...(gap !== undefined ? { layerGap: gap } : {}),
  });
  it("🟢 the M3 default gap meets the floor exactly (F1)", () => {
    expect(statusOf(beam([layer()]), "layer_clear_spacing")).toBe("PASS"); // default max(Ø,20)=20 == min 20
  });
  it("🟠 a slightly tight gap warns", () => {
    expect(statusOf(beam([layer(19.5)]), "layer_clear_spacing")).toBe("WARN"); // 20·0.95=19 < 19.5 < 20
  });
  it("🔴 the layers clash", () => {
    expect(statusOf(beam([layer(8)]), "layer_clear_spacing")).toBe("FAIL");
  });
});

describe("V-C — depth-triggered skin minimum (skin_minimum)", () => {
  // a side-face skin row: fixed on the ±u face, spread along v within the (deep) section (h=1200 → ±600).
  const skinRow = (id: string, u: number, count: number): BarRow => ({
    kind: "row", id, anchor: { u, v: -300 }, direction: "v", extent: 600, count, skin: true,
    shape: droite, params: { L: 3000 }, diameter: 12,
  });
  it("no item when the section is shallow (not mandatory)", () => {
    expect(ruleOf(column([skinRow("SKR", 150, 4)], 600), "skin_minimum")).toBeUndefined();
  });
  it("🟢 deep section with adequate skin on both faces (F1: at/above min)", () => {
    // h=1200 → min = 0.001·400·1200 = 480 mm²/face; 5 Ø12 = 5·113 = 565 ≥ 480.
    const r = column([skinRow("SKR", 150, 5), skinRow("SKL", -150, 5)], 1200);
    expect(statusOf(r, "skin_minimum")).toBe("PASS");
  });
  it("🟠 deep section, skin under the minimum → judgement WARN (never blocks)", () => {
    const r = column([skinRow("SKR", 150, 2), skinRow("SKL", -150, 2)], 1200);
    expect(statusOf(r, "skin_minimum")).toBe("WARN");
    expect(r.status).not.toBe("FAIL"); // skin under-provision must never hard-block
  });
  it("🟠 deep section with NO skin steel → actionable WARN", () => {
    // a benign centred bar keeps the addressable path active without adding skin.
    const filler: SingleBar = { kind: "single", id: "X", position: { u: 0, v: 0 }, shape: droite, params: { L: 3000 }, diameter: 12 };
    expect(statusOf(column([filler], 1200), "skin_minimum")).toBe("WARN");
  });
});

describe("V-E — curtailment / anchorage (curtailment_anchorage), F1-banded", () => {
  const cut = (over: Partial<SingleBar>): SingleBar => ({
    kind: "single", id: "CB", position: { u: 0, v: -260 }, shape: droite, params: { L: 6000 }, diameter: 20,
    startStation: 0, endStation: 4000, anchorage: { end: "straight" }, ...over,
  });
  it("🟢 a curtailed bar with an adequate straight anchorage develops (F1)", () => {
    expect(statusOf(beam([cut({})]), "curtailment_anchorage")).toBe("PASS");
  });
  it("🔴 a bare interior cut-off (no anchorage) can't develop", () => {
    const r = beam([cut({ anchorage: { end: "none" } })]);
    expect(statusOf(r, "curtailment_anchorage")).toBe("FAIL");
    expect(ruleOf(r, "curtailment_anchorage")!.affectedGroupIds).toEqual(["CB"]); // reds exactly one bar
  });
  it("🔴 a curtailed segment far too short to develop both ends", () => {
    const r = beam([cut({ startStation: 2900, endStation: 3000, anchorage: { start: "straight", end: "straight" } })]);
    expect(statusOf(r, "curtailment_anchorage")).toBe("FAIL");
  });
  it("no item for a full-length bar (member end to member end)", () => {
    expect(ruleOf(beam([cut({ startStation: 0, endStation: 6000 })]), "curtailment_anchorage")).toBeUndefined();
  });
});

// --- V-A: the element-agnostic geometry rules, generalised to a non-RECT (slab) element --------------
function slab(placed?: SingleBar[]): SolveResult {
  return solveSlab({
    element: "E-SLB-01", profile: "SLAB_ONEWAY", geometry: { Lx: 5000, Ly: 3000, t: 200 },
    material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
    zones: [
      { zone: "As_main", groupId: "M", slabRole: "MAIN", shape: droite, params: { L: 5000 }, diameter: 12, spacing: 150, asReqPerM: 700, v: -75 },
      { zone: "As_dist", groupId: "D", slabRole: "SECONDARY", shape: droite, params: { L: 3000 }, diameter: 8, spacing: 250, asReqPerM: 200, v: -60 },
    ],
    ...(placed ? { placed } : {}),
    code,
  });
}

describe("V-A — element-agnostic geometry generalised to a slab (placed_axial_extent / placed_section_bounds)", () => {
  const bar = (over: Partial<SingleBar>): SingleBar => ({
    kind: "single", id: "P1", position: { u: 0, v: -70 }, shape: droite, params: { L: 5000 }, diameter: 16, ...over,
  });
  it("🟢 a free bar inside the slab is fine on both rules", () => {
    const r = slab([bar({})]);
    expect(statusOf(r, "placed_axial_extent")).toBe("PASS");
    expect(statusOf(r, "placed_section_bounds")).toBe("PASS");
  });
  it("🔴 a bar running past the member end → axial-extent FAIL", () => {
    const r = slab([bar({ startStation: 0, endStation: 6000 })]); // member is 5000 long
    expect(statusOf(r, "placed_axial_extent")).toBe("FAIL");
    expect(ruleOf(r, "placed_axial_extent")!.affectedGroupIds).toEqual(["P1"]);
  });
  it("🔴 a bar outside the concrete → section-bounds FAIL", () => {
    const r = slab([bar({ position: { u: 1500, v: -70 } })]); // Ly/2 = 1500 → on the edge, out of cover
    expect(statusOf(r, "placed_section_bounds")).toBe("FAIL");
  });
});

describe("V-F — the F1 guarantee holds across packs (BAEL + EC2)", () => {
  it("an at-limit bundle cover is 🟢 under EC2 too", () => {
    const ec2 = makeEc2Pack();
    const phiN = ec2.bundleEquivDiameter(16, 3);
    const r = solveElement({
      element: "E-COL-01", profile: "BAEL_COLUMN", section: "RECT",
      geometry: { b: 400, h: 600, H: 3000 },
      material: { f_c28: 25, f_e: 500 }, cover: 30, exposure: "EXTERIOR",
      layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
      phiT: 8, phiLInset: 20,
      longitudinal: [{ zone: "As_total", groupId: "L1", role: "PRIMARY_LONGITUDINAL", shape: droite, params: { L: 3000 }, diameter: 20, faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"], asReq: 1800, tensionFace: "BOTTOM" }],
      transverse: [{ zone: "Asw", groupId: "T1", shape: cadre, params: { w: 314, h: 524 }, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 }],
      placed: [bnd({ position: { u: 200 - phiN / 2 - 30, v: 0 } })],
      code: ec2,
    });
    expect(statusOf(r, "bundle_cover")).toBe("PASS");
  });
});

describe("legacy safety — no placed content adds no Track-V item", () => {
  it("a plain column/beam/slab carries none of the new rules", () => {
    for (const r of [column(), beam(), slab()]) {
      for (const rule of ["bundle_max", "bundle_cover", "layer_clear_spacing", "skin_minimum", "curtailment_anchorage", "placed_axial_extent", "placed_section_bounds"]) {
        expect(ruleOf(r, rule)).toBeUndefined();
      }
    }
  });
});
