/**
 * v1.0.6-fix **R5** — owner decision **O-3c** (2026-07-11): a `Layer` on a **CIRCULAR** section.
 *
 * **The defect it closes.** `expandLayer` needed `{b,h}` section dims to offset a flexural layer inboard of
 * a FACE. A round section has no face, so the circular pipeline passed none and the expander returned `[]`:
 * placing a layer on a pile or a spiral column created a doc entry, listed it in the palette, and produced
 * **ZERO steel — silently**. It was unreachable only because the section canvas did not exist on those six
 * elements; R5's canvas makes it reachable, so it had to be answered rather than skipped.
 *
 * **The answer (O-3c, capability not a stub):** a layer on a round section is an inner, concentric **pitch
 * circle** — `count` bars at the equal angular step from the +u datum, radius `D/2 − inset − layerIndex·step`
 * (the same formula shape as the face layer, so the two section geometries stay one convention).
 *
 * The expander dispatches on the **section descriptor** (`sectionD` vs `sectionDims`), never on the element
 * — invariant 3.
 */
import { describe, it, expect } from "vitest";
import { solveCircular, solveSlab, barArea, type SolveResult, type Layer } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const spiral = loadShape("spirale_helice");

const D = 800;
const COVER = 50;

/** An inner ring of 6 Ø16 inside the pile's cage. `face`/`span` are inert on a closed circle. */
const ring = (count = 6, diameter = 16): Layer => ({
  kind: "layer",
  id: "RING",
  face: "TOP",
  layerIndex: 1,
  count,
  inset: COVER + diameter,
  span: 400,
  shape: droite,
  params: { L: 6000 },
  diameter,
});

function pile(placed?: Layer[]): SolveResult {
  return solveCircular({
    element: "E-FND-01",
    profile: "CIRCULAR_COLUMN",
    geometry: { D, H: 6000 },
    material: { f_c28: 25, f_e: 500 },
    cover: COVER,
    exposure: "EXTERIOR",
    longitudinal: [
      { zone: "As_total", groupId: "L1", shape: droite, params: { L: 6000 }, diameter: 25, count: 12, asReq: 6000, primary: true },
    ],
    transverse: [
      { zone: "Asw", groupId: "SP1", shape: spiral, params: { pitch: 150, helix_diameter: 680, turns: 40 }, diameter: 12, spacing: 150, nLegs: 2, aswReqPerM: 0 },
    ],
    ...(placed ? { placed } : {}),
    code,
  });
}

const placedOf = (r: SolveResult) => (r.longBars ?? []).filter((b) => b.standalone && !b.removed);

describe("R5 / O-3c — a Layer on a CIRCULAR section is an inner pitch circle", () => {
  it("expands to real steel — it used to expand to NOTHING, silently (the defect)", () => {
    const bars = placedOf(pile([ring()]));
    expect(bars).toHaveLength(6);
  });

  it("the bars sit on ONE concentric circle at the expected radius", () => {
    const l = ring();
    const step = l.diameter + Math.max(l.diameter, 20); // layerGap default
    const expectedR = D / 2 - l.inset - l.layerIndex * step;
    const radii = placedOf(pile([l])).map((b) => Math.hypot(b.position.u, b.position.v));
    for (const r of radii) expect(r).toBeCloseTo(expectedR, 6);
    expect(expectedR).toBeGreaterThan(0);
  });

  it("they are equally spaced from the +u datum — the native pitch circle's datum (§6.1)", () => {
    const n = 6;
    const bars = placedOf(pile([ring(n)]));
    // normalise to [0, 2π) — atan2 wraps at ±π, so compare the SET of angles, not consecutive diffs
    const twoPi = 2 * Math.PI;
    const angles = bars
      .map((b) => ((Math.atan2(b.position.v, b.position.u) % twoPi) + twoPi) % twoPi)
      .sort((a, b) => a - b);
    for (let i = 0; i < n; i++) expect(angles[i]).toBeCloseTo((i * twoPi) / n, 6);
  });

  it("the ring is CREDITED to the cage's As (R3's count-based circular credit sees it)", () => {
    const asOf = (r: SolveResult) => Number(r.validation.find((v) => v.rule === "provided_area:As_total")!.value);
    expect(asOf(pile([ring(6, 16)])) - asOf(pile())).toBeCloseTo(6 * barArea(16), 0);
  });

  it("the ring is drawn INSIDE the concrete — the placed-bounds rule (radial on CIRCULAR) is happy", () => {
    const r = pile([ring()]);
    expect(r.validation.some((v) => v.rule === "placed_section_bounds" && v.status === "FAIL")).toBe(false);
    for (const b of placedOf(r)) {
      expect(Math.hypot(b.position.u, b.position.v)).toBeLessThan(D / 2 - COVER);
    }
  });

  it("a RECT/slab section still gets a FACE layer — the descriptor dispatch, not an element branch", () => {
    const l: Layer = { ...ring(4, 12), inset: 25 + 12, span: 2000, params: { L: 5000 } };
    const r = solveSlab({
      element: "E-SLB-01",
      profile: "SLAB_ONEWAY",
      geometry: { Lx: 5000, Ly: 3000, t: 200 },
      material: { f_c28: 25, f_e: 500 },
      cover: 25,
      exposure: "INTERIOR",
      zones: [
        { zone: "As_main", groupId: "M", slabRole: "MAIN", shape: droite, params: { L: 5000 }, diameter: 12, spacing: 150, asReqPerM: 500, v: -75 },
        { zone: "As_dist", groupId: "D", slabRole: "SECONDARY", shape: droite, params: { L: 3000 }, diameter: 8, spacing: 250, asReqPerM: 200, v: -60 },
      ],
      placed: [l],
      code,
    });
    const bars = placedOf(r);
    expect(bars).toHaveLength(4);
    // a FACE layer: the bars share one v (the face offset) and spread along u — not a circle
    expect(new Set(bars.map((b) => Math.round(b.position.v * 1e6))).size).toBe(1);
    expect(new Set(bars.map((b) => Math.round(b.position.u))).size).toBe(4);
  });
});
