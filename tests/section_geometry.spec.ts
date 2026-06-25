/**
 * Section / Coupe engine (spec §9.5, [REF-SYS-950]) — `sectionAt` golden behaviour, plan P5.
 *
 * Pure `sectionAt(result, cut) → CoupeView`:
 *  - a PERPENDICULAR cut of a column = the cross-section layout (bars as circles at their (u,v),
 *    the tie outline as lines, the concrete rectangle);
 *  - an OBLIQUE cut yields a convex concrete polygon + projected bar centres;
 *  - a NEAR-PARALLEL bar renders as a line (elevation run), not a circle (threshold §14);
 *  - the LOOK-BEHIND picks the nearest transverse set when the plane lands between two stirrups;
 *  - determinism: same (result, cut) → identical CoupeView.
 */
import { describe, it, expect } from "vitest";
import {
  solveColumn,
  solveCircular,
  sectionAt,
  defaultCoupeFor,
  type ColumnSolveInput,
  type SectionCut,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const LONG_ID = "L1";
const TIE_ID = "T1";

/** The P1 reference column: b300×h600×H3000, 6Ø20 (3T/3B/2L/2R) + Ø8@200. */
const refColumn = (): ColumnSolveInput => ({
  element: "E-COL-01",
  geometry: { b: 300, h: 600, H: 3000 },
  material: { f_c28: 25, f_e: 500 },
  cover: 30,
  exposure: "EXTERIOR",
  dg: 20,
  longitudinal: {
    groupId: LONG_ID,
    shape: loadShape("droite"),
    diameter: 20,
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    asReq: 1800,
  },
  tie: {
    groupId: TIE_ID,
    shape: loadShape("cadre_rect"),
    diameter: 8,
    spacing: 200,
    nLegs: 2,
    aswReqPerM: 300,
  },
  code: makeBaelPack(),
});

describe("sectionAt — perpendicular column coupe", () => {
  const result = solveColumn(refColumn());
  const cut = defaultCoupeFor(result); // mid-height, normal +Y

  it("seeds the default representative coupe perpendicular at mid-length", () => {
    expect(cut.isDefault).toBe(true);
    expect(cut.origin).toEqual({ x: 0, y: 1500, z: 0 });
    expect(cut.normal).toEqual({ x: 0, y: 1, z: 0 });
  });

  it("concrete outline is the 300×600 cross-section rectangle", () => {
    const view = sectionAt(result, cut);
    const ss = view.concrete.outline.map((p) => p.s);
    const ts = view.concrete.outline.map((p) => p.t);
    expect(view.concrete.outline.length).toBe(4);
    expect(Math.min(...ss)).toBeCloseTo(-150, 3);
    expect(Math.max(...ss)).toBeCloseTo(150, 3);
    expect(Math.min(...ts)).toBeCloseTo(-300, 3);
    expect(Math.max(...ts)).toBeCloseTo(300, 3);
  });

  it("shows the 6 longitudinal bars as Ø20 circles at their (u,v)", () => {
    const view = sectionAt(result, cut);
    const longCircles = view.circles.filter((c) => c.groupId === LONG_ID);
    expect(longCircles.length).toBe(6);
    expect(longCircles.every((c) => c.diameter === 20)).toBe(true);
    const key = (s: number, t: number) => `${Math.round(s)}:${Math.round(t)}`;
    const got = new Set(longCircles.map((c) => key(c.center.s, c.center.t)));
    // corner bars sit on the core rectangle (±102, ±252); face-mid bars at u=0.
    for (const k of ["-102:252", "0:252", "102:252", "-102:-252", "0:-252", "102:-252"])
      expect(got.has(k)).toBe(true);
  });

  it("shows the nearest tie as an outline (lines), annotates n Ø d", () => {
    const view = sectionAt(result, cut);
    expect(view.lines.some((l) => l.groupId === TIE_ID)).toBe(true);
    const ann = view.annotations.find((a) => a.groupId === LONG_ID)!;
    expect(ann.count).toBe(6);
    expect(ann.diameter).toBe(20);
  });

  it("is deterministic: same (result, cut) → identical CoupeView", () => {
    expect(JSON.stringify(sectionAt(result, cut))).toBe(JSON.stringify(sectionAt(result, cut)));
  });
});

describe("sectionAt — oblique cut", () => {
  const result = solveColumn(refColumn());
  const cut: SectionCut = {
    id: "B",
    origin: { x: 0, y: 1500, z: 0 },
    normal: { x: 0, y: 1, z: 0.35 }, // tilted off the axis
  };

  it("yields a convex concrete polygon and still projects the bar centres", () => {
    const view = sectionAt(result, cut);
    expect(view.concrete.outline.length).toBeGreaterThanOrEqual(4);
    // longitudinal bars still cross steeply → 6 circles
    expect(view.circles.filter((c) => c.groupId === LONG_ID).length).toBe(6);
    // an oblique cut stretches the section along t (the cut is longer than the upright height)
    const ts = view.concrete.outline.map((p) => p.t);
    expect(Math.max(...ts) - Math.min(...ts)).toBeGreaterThan(600);
  });
});

describe("sectionAt — near-parallel bars render as lines", () => {
  const result = solveColumn(refColumn());
  // a vertical plane containing the member axis (normal +X) → longitudinal bars run IN the plane
  const cut: SectionCut = { id: "C", origin: { x: 0, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 } };

  it("draws the longitudinal bars as runs, not section dots", () => {
    const view = sectionAt(result, cut);
    expect(view.circles.some((c) => c.groupId === LONG_ID)).toBe(false);
    expect(view.lines.some((l) => l.groupId === LONG_ID)).toBe(true);
  });
});

describe("sectionAt — look-behind shows the nearest transverse set", () => {
  const result = solveColumn(refColumn());
  // stations are stepped by the 200 mm spacing from a 50 mm margin: …1450, 1650… A cut at
  // y=1500 lands BETWEEN two ties (the nearer one, 1450, is in FRONT of the viewing arrow).
  const cut: SectionCut = {
    id: "D",
    origin: { x: 0, y: 1500, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    lookBehind_mm: 120,
  };

  it("still shows a tie outline even though the cut is between stirrups", () => {
    const view = sectionAt(result, cut);
    expect(view.lookBehind_mm).toBe(120);
    expect(view.lines.some((l) => l.groupId === TIE_ID)).toBe(true);
  });
});

describe("sectionAt — circular column coverage", () => {
  const result = solveCircular({
    element: "E-COL-02",
    profile: "CIRCULAR_COLUMN",
    geometry: { D: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 50,
    exposure: "EXTERIOR",
    longitudinal: [
      {
        zone: "As_total",
        groupId: "L1",
        shape: loadShape("droite"),
        params: { L: 3000 },
        diameter: 20,
        count: 8,
        asReq: 1500,
        primary: true,
      },
    ],
    transverse: [
      {
        zone: "Asw_spiral",
        groupId: "SP1",
        shape: loadShape("spirale_helice"),
        params: { pitch: 60, helix_diameter: 500, turns: 50 },
        diameter: 8,
        spacing: 60,
        nLegs: 2,
        aswReqPerM: 0,
      },
    ],
    code: makeBaelPack(),
  });

  it("a perpendicular cut of a round column produces a near-circular outline + bar dots", () => {
    const view = sectionAt(result, defaultCoupeFor(result));
    // the sampled lateral intersection approximates the Ø600 circle
    const radii = view.concrete.outline.map((p) => Math.hypot(p.s, p.t));
    expect(Math.min(...radii)).toBeGreaterThan(295);
    expect(Math.max(...radii)).toBeLessThan(305);
    expect(view.circles.filter((c) => c.groupId === "L1").length).toBe(8);
  });
});
