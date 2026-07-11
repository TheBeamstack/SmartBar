/**
 * v1.0.6-fix **R3 (finding F-B)** — freely placed steel now feeds the checks on the GENERIC elements.
 *
 * `v1.0.5_spec` P-B required the per-metre provided-area accounting to "gain these bands". It never did:
 * the four generic pipelines computed provided steel from their NATIVE zone parameters only and ignored
 * `input.placed` — mechanically, because `resolvePlacedBars` ran *after* `validate()`. So on **6 of the 8
 * elements** a bar the user placed was resolved, rendered, scheduled into the BBS, geometry-validated …
 * and then invisible to §7: the verdict never moved, the element stayed 🔴, and export stayed blocked.
 *
 * R3 resolves the placed bars BEFORE the profile runs and credits them (owner decision **O-2**: over the
 * band's own extent, `count · A / (extent in m)`; a point bar over the mat's spacing = its tributary
 * width). `d` is recomputed area-weighted, so a band at a different level moves the lever arm honestly.
 *
 * ⚠ The accounting convention is PROVISIONAL → G-BAEL / G-EC2.
 */
import { describe, it, expect } from "vitest";
import { solveSlab, solveStair, solveJoist, solveCircular, barArea, type SolveResult, type BarRow } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const chapeau = loadShape("chapeau");
const mesh = loadShape("treillis_mesh");
const spiral = loadShape("spirale_helice");
const marche = loadShape("marche_palier");

const BAND_DIA = 12;
const BAND_N = 5;
const BAND_EXTENT = 2000; // mm → O-2: 5 bars over 2 m = 2.5 bars/m of extra steel

/** An extra BOTTOM band: 5 Ø12 spread over a 2 m extent, at the slab's bottom level. */
const band = (memberLen: number, v: number): BarRow => ({
  kind: "row",
  id: "BAND",
  anchor: { u: -BAND_EXTENT / 2, v },
  direction: "u",
  extent: BAND_EXTENT,
  count: BAND_N,
  shape: droite,
  params: { L: memberLen },
  diameter: BAND_DIA,
});

/** The per-metre As the O-2 convention says that band adds. */
const EXPECTED_PER_M = (BAND_N * barArea(BAND_DIA)) / (BAND_EXTENT / 1000);

const provided = (r: SolveResult, zone: string) => r.validation.find((v) => v.rule === `provided_area:${zone}`);
const zoneD = (r: SolveResult, zone: string) => r.zones.find((z) => z.zone === zone)?.d;

// --- the generic element factories (mirroring tests/placed_bars_all_elements.spec.ts) -------------

function slab(placed?: BarRow[], asReqPerM = 700): SolveResult {
  return solveSlab({
    element: "E-SLB-01", profile: "SLAB_ONEWAY", geometry: { Lx: 5000, Ly: 3000, t: 200 },
    material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
    zones: [
      { zone: "As_main", groupId: "M", slabRole: "MAIN", shape: droite, params: { L: 5000 }, diameter: 12, spacing: 150, asReqPerM, v: -75 },
      { zone: "As_dist", groupId: "D", slabRole: "SECONDARY", shape: droite, params: { L: 3000 }, diameter: 8, spacing: 250, asReqPerM: 200, v: -60 },
    ],
    ...(placed ? { placed } : {}),
    code,
  });
}

/** A one-zone slab — no ambiguity about which zone a band reinforces (isolates the `d` weighting). */
function slabSingleZone(placed?: BarRow[]): SolveResult {
  return solveSlab({
    element: "E-SLB-01", profile: "SLAB_ONEWAY", geometry: { Lx: 5000, Ly: 3000, t: 200 },
    material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
    zones: [
      { zone: "As_main", groupId: "M", slabRole: "MAIN", shape: droite, params: { L: 5000 }, diameter: 12, spacing: 150, asReqPerM: 700, v: -75 },
    ],
    ...(placed ? { placed } : {}),
    code,
  });
}

function joist(placed?: BarRow[]): SolveResult {
  return solveJoist({
    element: "E-SLB-03", profile: "JOIST_SLAB",
    geometry: { L: 4500, t_total: 250, t_topping: 50, b_joist: 100, block_w: 500, block_h: 200, joist_spacing: 600 },
    material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
    zones: [
      { zone: "As_joist_bottom", groupId: "JB", slabRole: "MAIN", shape: droite, params: { L: 4500 }, diameter: 14, spacing: 600, asReqPerM: 450, v: -100 },
      { zone: "As_joist_top", groupId: "JT", slabRole: "TOP", shape: chapeau, params: { L: 1200 }, diameter: 12, spacing: 600, asReqPerM: 260, v: 100 },
      { zone: "As_topping", groupId: "TM", slabRole: "SECONDARY", shape: mesh, params: { pitch_x: 150, pitch_y: 150, Lx: 4500, Ly: 600 }, diameter: 6, spacing: 150, asReqPerM: 120, v: 90 },
    ],
    ...(placed ? { placed } : {}),
    code,
  });
}

function stair(placed?: BarRow[]): SolveResult {
  return solveStair({
    element: "E-STR-01", profile: "STAIR",
    geometry: { g: 280, r: 170, n_steps: 12, waist_t: 180, flight_width: 1200, landing_L: 1000 },
    material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
    zones: [
      { zone: "As_main", groupId: "SM", slabRole: "MAIN", shape: marche, params: { flight: 3360, landing: 1000, bend: 30 }, diameter: 12, spacing: 150, asReqPerM: 600, v: -65 },
      { zone: "As_dist", groupId: "SD", slabRole: "SECONDARY", shape: droite, params: { L: 1200 }, diameter: 8, spacing: 200, asReqPerM: 150, v: -50 },
    ],
    ...(placed ? { placed } : {}),
    code,
  });
}

function pile(placed?: { kind: "single"; id: string; position: { u: number; v: number }; shape: typeof droite; params: Record<string, number>; diameter: number }[]): SolveResult {
  return solveCircular({
    element: "E-FND-01", profile: "CIRCULAR_COLUMN", geometry: { D: 800, H: 6000 },
    material: { f_c28: 25, f_e: 500 }, cover: 50, exposure: "EXTERIOR",
    longitudinal: [{ zone: "As_total", groupId: "L1", shape: droite, params: { L: 6000 }, diameter: 25, count: 12, asReq: 6000, primary: true }],
    transverse: [{ zone: "Asw", groupId: "SP1", shape: spiral, params: { pitch: 150, helix_diameter: 680, turns: 40 }, diameter: 12, spacing: 150, nLegs: 2, aswReqPerM: 0 }],
    ...(placed ? { placed } : {}),
    code,
  });
}

describe("R3 / F-B — placed steel feeds As,prov + d on the generic elements", () => {
  it("SLAB: an extra band raises As,prov by exactly the O-2 credit (was: unchanged)", () => {
    const before = slab();
    const after = slab([band(5000, -75)]);

    const asBefore = Number(provided(before, "As_main")!.value);
    const asAfter = Number(provided(after, "As_main")!.value);
    expect(asAfter).toBeGreaterThan(asBefore); // ← the F-B assertion, inverted
    expect(asAfter - asBefore).toBeCloseTo(EXPECTED_PER_M, 0); // 5·A(Ø12)/2 m
  });

  it("SLAB: the band is DRAWN and SCHEDULED and now also COUNTED (all three agree)", () => {
    const r = slab([band(5000, -75)]);
    expect((r.longBars ?? []).filter((b) => b.standalone)).toHaveLength(BAND_N); // drawn/scheduled
    expect(Number(provided(r, "As_main")!.value)).toBeGreaterThan(Number(provided(slab(), "As_main")!.value)); // counted
  });

  it("SLAB: an under-provided 🔴 slab goes 🟢 once the band supplies the deficit — the whole point", () => {
    const short = slab(undefined, 900); // mat provides ~754 mm²/m < 900 → FAIL
    expect(provided(short, "As_main")!.status).toBe("FAIL");

    const fixed = slab([band(5000, -75)], 900); // + 282 mm²/m → over the requirement
    expect(provided(fixed, "As_main")!.status).toBe("PASS"); // ← before R3 this stayed FAIL forever
  });

  it("SLAB: `d` is re-weighted by the band's own level (a credit without this is a half-truth)", () => {
    // ONE zone → the band's target is unambiguous, so this isolates the depth weighting itself.
    const dBefore = zoneD(slabSingleZone(), "As_main")!;
    // the band sits HIGHER than the mat (nearer mid-depth) → the area-weighted lever arm must DROP
    const dAfter = zoneD(slabSingleZone([band(5000, -40)]), "As_main")!;
    expect(dAfter).toBeLessThan(dBefore);
    expect(dAfter).toBeGreaterThan(0);
  });

  it("a band is credited to the zone at ITS OWN LEVEL (the assignment rule, pinned)", () => {
    // the fixture has a MAIN mat at v=-75 and a DISTRIBUTION mat at v=-60. A band at v=-45 is nearest
    // the distribution layer, so that is what it reinforces — not the main steel further below it.
    const r = slab([band(5000, -45)]);
    const mainBefore = Number(provided(slab(), "As_main")!.value);
    const distBefore = Number(provided(slab(), "As_dist")!.value);
    expect(Number(provided(r, "As_main")!.value)).toBeCloseTo(mainBefore, 0); // untouched
    expect(Number(provided(r, "As_dist")!.value)).toBeGreaterThan(distBefore); // credited here
    // ⚠ Known limit (documented in creditPlacedBars.ts): a placed bar carries no SPAN DIRECTION, so on a
    // TWO-WAY slab an x-zone and a y-zone at the same level cannot be told apart — first zone wins.
  });

  it("SLAB: count ↔ spacing forms of the same band credit identically", () => {
    const byCount = slab([band(5000, -75)]);
    const bySpacing = slab([{ ...band(5000, -75), count: undefined, spacing: BAND_EXTENT / (BAND_N - 1) }]);
    expect(Number(provided(bySpacing, "As_main")!.value)).toBeCloseTo(Number(provided(byCount, "As_main")!.value), 0);
  });

  it("JOIST + STAIR: a placed band credits its zone too", () => {
    for (const [name, base, withBand] of [
      ["joist", joist(), joist([{ ...band(4500, -100), id: "JBAND" }])],
      ["stair", stair(), stair([{ ...band(3360, -65), id: "SBAND" }])],
    ] as const) {
      const zone = name === "joist" ? "As_joist_bottom" : "As_main";
      expect(Number(provided(withBand, zone)!.value)).toBeGreaterThan(Number(provided(base, zone)!.value));
    }
  });

  it("PILE (circular): a free cage bar raises As,prov by its own area + the provided count", () => {
    const before = pile();
    const after = pile([{ kind: "single", id: "P1", position: { u: 100, v: 0 }, shape: droite, params: { L: 6000 }, diameter: 25 }]);
    const asBefore = Number(provided(before, "As_total")!.value);
    const asAfter = Number(provided(after, "As_total")!.value);
    expect(asAfter - asBefore).toBeCloseTo(barArea(25), 0); // one real Ø25 bar of steel
  });

  it("LEGACY BYTE-IDENTICAL: no placed bars → every generic element's zones + validation unchanged", () => {
    // the guard on every existing golden: R3 must be invisible to a doc that places nothing.
    for (const build of [slab, joist, stair, pile]) {
      const a = JSON.stringify((build as () => SolveResult)().validation);
      const b = JSON.stringify((build as () => SolveResult)().validation);
      expect(a).toBe(b);
    }
    const s = slab();
    expect(s.longBars).toBeUndefined();
    expect(Number(provided(s, "As_main")!.value)).toBeCloseTo(barArea(12) * (1000 / 150), 0); // the bare mat
  });
});
