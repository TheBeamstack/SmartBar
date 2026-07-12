/**
 * v1.0.6-fix **R9 (finding F-H, Review #2)** — a placed band can credit the Y direction on a two-way slab.
 *
 * On a two-way slab the adapter gives both bottom MAIN zones (and both TOP zones) the SAME level `v`, so
 * `creditPlacedPerMetre → nearestZone`'s tie always resolved to the first-listed (X) zone. A placed band's
 * axis is always the member axis, so the Y zones (`As_main_y_bot`, `As_top_y`) could NEVER be credited: a
 * Y-direction deficiency was un-fixable on the drawing board (F-B's symptom, ¼-live). Reproduced:
 * `As_main_x_bot` 523.6→1654.6, `As_main_y_bot` 523.6→523.6 (FAIL).
 *
 * Owner decision **O-5** (2026-07-12) = the FIX path: a `PlacedBarInput` carries an optional `spanAxis`
 * ("x"|"y"), a two-way slab's zones declare their `axis`, and the credit routes an axis-declaring band to
 * the matching-axis zone. These assert the inverted defect; each FAILS on the pre-R9 code.
 */
import { describe, it, expect } from "vitest";
import { solveSlab, barArea, type SolveResult, type BarRow, type SlabZoneInput } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");

const BAND_DIA = 12;
const BAND_N = 5;
const BAND_EXTENT = 2000;
const EXPECTED_PER_M = (BAND_N * barArea(BAND_DIA)) / (BAND_EXTENT / 1000);

/** A bottom band with an explicit span axis (both bottom zones sit at v = −75, so only `axis` tells them apart). */
const band = (axis: "x" | "y", over: Partial<BarRow> = {}): BarRow => ({
  kind: "row",
  id: `BAND_${axis}`,
  anchor: { u: -BAND_EXTENT / 2, v: -75 },
  direction: "u",
  extent: BAND_EXTENT,
  count: BAND_N,
  shape: droite,
  params: { L: 5000 },
  diameter: BAND_DIA,
  spanAxis: axis,
  ...over,
});

/** A two-way slab whose bottom X and Y mats share the level v = −75 (the F-H set-up). */
function twoWay(placed?: BarRow[], reqXY: { x: number; y: number } = { x: 400, y: 400 }): SolveResult {
  const z = (zone: string, groupId: string, axis: "x" | "y", asReqPerM: number, v: number, role: SlabZoneInput["slabRole"]): SlabZoneInput => ({
    zone, groupId, slabRole: role, shape: droite, params: { L: 5000 }, diameter: 10, spacing: 150, asReqPerM, v, axis,
  });
  return solveSlab({
    element: "E-SLB-02", profile: "SLAB_TWOWAY", geometry: { Lx: 5000, Ly: 5000, t: 200 },
    material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
    zones: [
      z("As_main_x_bot", "MX", "x", reqXY.x, -75, "MAIN"),
      z("As_main_y_bot", "MY", "y", reqXY.y, -75, "MAIN"),
      z("As_top_x", "TX", "x", 200, 75, "TOP"),
      z("As_top_y", "TY", "y", 200, 75, "TOP"),
    ],
    ...(placed ? { placed } : {}),
    code,
  });
}

const provided = (r: SolveResult, zone: string) => r.validation.find((v) => v.rule === `provided_area:${zone}`);
const val = (r: SolveResult, zone: string) => Number(provided(r, zone)!.value);

describe("R9 / F-H — a two-way slab band credits the direction it declares", () => {
  it("THE INVERTED CASE: a Y band raises As_main_y_bot and leaves As_main_x_bot untouched", () => {
    const base = twoWay();
    const withY = twoWay([band("y")]);
    // the Y zone rises by exactly the O-2 credit (before R9 it could NEVER move) …
    expect(val(withY, "As_main_y_bot") - val(base, "As_main_y_bot")).toBeCloseTo(EXPECTED_PER_M, 0);
    // … and the X zone is untouched (the credit no longer always lands on the first-listed zone).
    expect(val(withY, "As_main_x_bot")).toBeCloseTo(val(base, "As_main_x_bot"), 0);
  });

  it("an X band still credits As_main_x_bot (the other direction unchanged)", () => {
    const base = twoWay();
    const withX = twoWay([band("x")]);
    expect(val(withX, "As_main_x_bot") - val(base, "As_main_x_bot")).toBeCloseTo(EXPECTED_PER_M, 0);
    expect(val(withX, "As_main_y_bot")).toBeCloseTo(val(base, "As_main_y_bot"), 0);
  });

  it("a Y-only deficiency clears on the drawing board — 🔴 → 🟢 with a Y band (the whole point)", () => {
    // X ok (400), Y under-provided (900 > mat ~523) → Y FAILs, X PASSes.
    const short = twoWay(undefined, { x: 400, y: 900 });
    expect(provided(short, "As_main_y_bot")!.status).toBe("FAIL");
    expect(provided(short, "As_main_x_bot")!.status).toBe("PASS");
    // a Y band supplies the deficit → Y clears; before R9 the band credited X and Y stayed red forever.
    const fixed = twoWay([band("y"), band("y", { id: "BAND_y2" })], { x: 400, y: 900 });
    expect(provided(fixed, "As_main_y_bot")!.status).toBe("PASS");
  });

  it("count ↔ spacing forms of the same Y band credit Y identically", () => {
    const byCount = twoWay([band("y")]);
    const bySpacing = twoWay([band("y", { count: undefined, spacing: BAND_EXTENT / (BAND_N - 1) })]);
    expect(val(bySpacing, "As_main_y_bot")).toBeCloseTo(val(byCount, "As_main_y_bot"), 0);
  });

  it("a band with NO spanAxis falls back to nearest-level (first zone, X) — the documented pre-R9 behaviour", () => {
    const base = twoWay();
    const noAxis = twoWay([band("x", { spanAxis: undefined, id: "NOAXIS" })]);
    expect(val(noAxis, "As_main_x_bot")).toBeGreaterThan(val(base, "As_main_x_bot")); // first zone at the level
    expect(val(noAxis, "As_main_y_bot")).toBeCloseTo(val(base, "As_main_y_bot"), 0);
  });

  it("LEGACY BYTE-IDENTICAL: no placed bars → the two-way slab validation is unchanged", () => {
    const a = JSON.stringify(twoWay().validation);
    const b = JSON.stringify(twoWay().validation);
    expect(a).toBe(b);
    expect(twoWay().longBars).toBeUndefined();
  });
});
