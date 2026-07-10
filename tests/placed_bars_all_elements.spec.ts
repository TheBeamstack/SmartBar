/**
 * v1.0.5 M2 (P-A + P-B, [REF-SYS-530]) — free placement on ALL 8 elements.
 *
 * The canonical placed-bar model (`SingleBar`) + the shared `resolvePlacedBars` pass are wired into
 * every pipeline (RECT `solveElement` via `extraBars`; the four generic shims via `placed`). This
 * proves the M2 Definition-of-Done: **a free bar renders (placeBars) + schedules (computeBBS) + appears
 * in the coupe (sectionAt) for each of the 8 elements, and a doc WITHOUT placed bars is byte-identical**
 * (the grouped path — `longBars` stays `undefined`, the base render/schedule are unchanged).
 */
import { describe, it, expect } from "vitest";
import {
  solveElement,
  solveCircular,
  solveSlab,
  solveJoist,
  solveStair,
  placeBars,
  sectionAt,
  defaultCoupeFor,
  type SolveResult,
  type ExtraLongBar,
  type SingleBar,
} from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");
const etrier = loadShape("etrier");
const chapeau = loadShape("chapeau");
const mesh = loadShape("treillis_mesh");
const spiral = loadShape("spirale_helice");
const marche = loadShape("marche_palier");

const FREE_ID = "FREE1";
const FREE_DIA = 32; // distinctive Ø — never collides with a base bar in these fixtures

/** A free single bar spanning the full member at a distinctive (u,v) — as an `ExtraLongBar` (RECT). */
function freeExtra(memberLen: number): ExtraLongBar {
  return { id: FREE_ID, position: { u: 40, v: 40 }, shape: droite, params: { L: memberLen }, diameter: FREE_DIA };
}

/** The same free bar as a canonical `SingleBar` (the generic `placed` channel). */
function freeSingle(memberLen: number): SingleBar {
  return { kind: "single", id: FREE_ID, position: { u: 40, v: 40 }, shape: droite, params: { L: memberLen }, diameter: FREE_DIA };
}

// --- the 8 element factories (each: base result, with-free-bar result) ---------------------------

function column(withFree: boolean): SolveResult {
  return solveElement({
    element: "E-COL-01", profile: "BAEL_COLUMN", section: "RECT",
    geometry: { b: 300, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 }, cover: 30, exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT: 8, phiLInset: 20,
    longitudinal: [{ zone: "As_total", groupId: "L1", role: "PRIMARY_LONGITUDINAL", shape: droite, params: { L: 3000 }, diameter: 20, faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"], asReq: 1800, tensionFace: "BOTTOM" }],
    transverse: [{ zone: "Asw", groupId: "T1", shape: cadre, params: { w: 300 - 2 * 30 - 8, h: 600 - 2 * 30 - 8 }, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 }],
    ...(withFree ? { extraBars: [freeExtra(3000)] } : {}),
    code,
  });
}

function beam(withFree: boolean): SolveResult {
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
    ...(withFree ? { extraBars: [freeExtra(6000)] } : {}),
    code,
  });
}

function circularCol(withFree: boolean): SolveResult {
  return solveCircular({
    element: "E-COL-02", profile: "CIRCULAR_COLUMN", geometry: { D: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 }, cover: 40, exposure: "EXTERIOR",
    longitudinal: [{ zone: "As_total", groupId: "L1", shape: droite, params: { L: 3000 }, diameter: 20, count: 8, asReq: 2500, primary: true }],
    transverse: [{ zone: "Asw", groupId: "SP1", shape: spiral, params: { pitch: 100, helix_diameter: 500, turns: 30 }, diameter: 10, spacing: 100, nLegs: 2, aswReqPerM: 0 }],
    ...(withFree ? { placed: [freeSingle(3000)] } : {}),
    code,
  });
}

function pile(withFree: boolean): SolveResult {
  return solveCircular({
    element: "E-FND-01", profile: "CIRCULAR_COLUMN", geometry: { D: 800, H: 6000 },
    material: { f_c28: 25, f_e: 500 }, cover: 50, exposure: "EXTERIOR",
    longitudinal: [{ zone: "As_total", groupId: "L1", shape: droite, params: { L: 6000 }, diameter: 25, count: 12, asReq: 6000, primary: true }],
    transverse: [{ zone: "Asw", groupId: "SP1", shape: spiral, params: { pitch: 150, helix_diameter: 680, turns: 40 }, diameter: 12, spacing: 150, nLegs: 2, aswReqPerM: 0 }],
    ...(withFree ? { placed: [freeSingle(6000)] } : {}),
    code,
  });
}

function slabOneWay(withFree: boolean): SolveResult {
  return solveSlab({
    element: "E-SLB-01", profile: "SLAB_ONEWAY", geometry: { Lx: 5000, Ly: 3000, t: 200 },
    material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
    zones: [
      { zone: "As_main", groupId: "M", slabRole: "MAIN", shape: droite, params: { L: 5000 }, diameter: 12, spacing: 150, asReqPerM: 700, v: -75 },
      { zone: "As_dist", groupId: "D", slabRole: "SECONDARY", shape: droite, params: { L: 3000 }, diameter: 8, spacing: 250, asReqPerM: 200, v: -60 },
    ],
    ...(withFree ? { placed: [freeSingle(5000)] } : {}),
    code,
  });
}

function slabTwoWay(withFree: boolean): SolveResult {
  return solveSlab({
    element: "E-SLB-02", profile: "SLAB_TWOWAY", geometry: { Lx: 5000, Ly: 5000, t: 200 },
    material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
    zones: [
      { zone: "As_main_x", groupId: "MX", slabRole: "MAIN", shape: mesh, params: { pitch_x: 150, pitch_y: 150, Lx: 5000, Ly: 5000 }, diameter: 10, spacing: 150, asReqPerM: 400 },
      { zone: "As_main_y", groupId: "MY", slabRole: "MAIN", shape: mesh, params: { pitch_x: 150, pitch_y: 150, Lx: 5000, Ly: 5000 }, diameter: 10, spacing: 150, asReqPerM: 400 },
    ],
    ...(withFree ? { placed: [freeSingle(5000)] } : {}),
    code,
  });
}

function joist(withFree: boolean): SolveResult {
  return solveJoist({
    element: "E-SLB-03", profile: "JOIST_SLAB",
    geometry: { L: 4500, t_total: 250, t_topping: 50, b_joist: 100, block_w: 500, block_h: 200, joist_spacing: 600 },
    material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
    zones: [
      { zone: "As_joist_bottom", groupId: "JB", slabRole: "MAIN", shape: droite, params: { L: 4500 }, diameter: 14, spacing: 600, asReqPerM: 450 },
      { zone: "As_joist_top", groupId: "JT", slabRole: "TOP", shape: chapeau, params: { L: 1200 }, diameter: 12, spacing: 600, asReqPerM: 260 },
      { zone: "As_topping", groupId: "TM", slabRole: "SECONDARY", shape: mesh, params: { pitch_x: 150, pitch_y: 150, Lx: 4500, Ly: 600 }, diameter: 6, spacing: 150, asReqPerM: 120 },
    ],
    ...(withFree ? { placed: [freeSingle(4500)] } : {}),
    code,
  });
}

function stair(withFree: boolean): SolveResult {
  const span = 12 * 280;
  return solveStair({
    element: "E-STR-01", profile: "STAIR",
    geometry: { g: 280, r: 170, n_steps: 12, waist_t: 180, flight_width: 1200, landing_L: 1000 },
    material: { f_c28: 25, f_e: 500 }, cover: 25, exposure: "INTERIOR",
    zones: [
      { zone: "As_main", groupId: "SM", slabRole: "MAIN", shape: marche, params: { flight: span, landing: 1000, bend: 30 }, diameter: 12, spacing: 150, asReqPerM: 700, v: -65 },
      { zone: "As_dist", groupId: "SD", slabRole: "SECONDARY", shape: droite, params: { L: 1200 }, diameter: 8, spacing: 250, asReqPerM: 200, v: -55 },
    ],
    ...(withFree ? { placed: [freeSingle(span)] } : {}),
    code,
  });
}

const ELEMENTS: { name: string; make: (withFree: boolean) => SolveResult }[] = [
  { name: "E-COL-01 rectangular column", make: column },
  { name: "E-BEM-01 rectangular beam", make: beam },
  { name: "E-COL-02 circular spiral column", make: circularCol },
  { name: "E-FND-01 drilled-shaft pile", make: pile },
  { name: "E-SLB-01 one-way slab", make: slabOneWay },
  { name: "E-SLB-02 two-way slab", make: slabTwoWay },
  { name: "E-SLB-03 hollow-block joist slab", make: joist },
  { name: "E-STR-01 straight-flight stair", make: stair },
];

describe("M2 — a free placed bar flows on all 8 elements", () => {
  for (const { name, make } of ELEMENTS) {
    describe(name, () => {
      it("a doc WITHOUT placed bars keeps the grouped path (legacy byte-identical)", () => {
        const base = make(false);
        expect(base.longBars).toBeUndefined();
        expect(base.hasUserAddressableContent).toBeFalsy();
      });

      it("a free bar renders + schedules + appears in the coupe; the base is unchanged", () => {
        const base = make(false);
        const withFree = make(true);

        // 1. RENDER — the free bar appears in placeBars…
        const renderedBase = placeBars(base);
        const rendered = placeBars(withFree);
        expect(rendered.some((p) => p.groupId === FREE_ID)).toBe(true);
        // …and every base rendered bar is still present, byte-identical (nothing displaced).
        for (const b of renderedBase) {
          expect(
            rendered.some((r) => r.groupId === b.groupId && JSON.stringify(r.points) === JSON.stringify(b.points)),
          ).toBe(true);
        }
        expect(rendered.length).toBe(renderedBase.length + 1);

        // 2. SCHEDULE — the free bar is scheduled (its own line: distinctive Ø32).
        const bbs = computeBBS(withFree);
        expect(bbs.lines.some((l) => l.groupIds.includes(FREE_ID))).toBe(true);
        expect(bbs.summary.byDiameter.some((d) => d.diameter === FREE_DIA)).toBe(true);

        // 3. COUPE — a perpendicular default cut crosses the full-length free bar → a section circle.
        const view = sectionAt(withFree, defaultCoupeFor(withFree));
        expect(view.circles.some((c) => c.groupId === FREE_ID)).toBe(true);
      });
    });
  }
});
