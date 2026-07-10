/**
 * v1.0.5 M3 (P-G, audit C1, [REF-SYS-950 / sectionAt.ts]) — coupe fidelity for every placed-bar type.
 *
 * The north star (drawn == scheduled) includes the COUPE. `sectionAt` reads the resolved `longBars`, so a
 * bundle shows `n` touching dots at its `(u,v)`, a layer shows a distinct row at its depth, a skin row
 * shows the side-face dots, and a placed bar the cut plane MISSES is correctly absent.
 */
import { describe, it, expect } from "vitest";
import {
  solveElement,
  sectionAt,
  defaultCoupeFor,
  type SolveResult,
  type SectionCut,
  type Bundle,
  type Layer,
  type BarRow,
  type SingleBar,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const etrier = loadShape("etrier");
const uFace = 300 / 2 - (30 + 8 + 20 / 2);

function beam(...placed: (Bundle | Layer | BarRow | SingleBar)[]): SolveResult {
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
    ...(placed.length ? { placed } : {}),
    code,
  });
}

const coupe = (r: SolveResult) => sectionAt(r, defaultCoupeFor(r));
/** An explicit perpendicular cut at member station `y` (mm). */
const cutAt = (y: number): SectionCut => ({ id: "X", origin: { x: 0, y, z: 0 }, normal: { x: 0, y: 1, z: 0 } });

describe("M3 P-G — each placed-bar type reads correctly in the coupe", () => {
  it("a bundle shows n touching dots at its (u,v)", () => {
    const b: Bundle = { kind: "bundle", id: "BND", position: { u: 90, v: -260 }, n: 3, shape: droite, params: { L: 6000 }, diameter: 25 };
    const dots = coupe(beam(b)).circles.filter((c) => c.groupId.startsWith("BND#"));
    expect(dots.length).toBe(3);
    const us = dots.map((c) => c.center.s).sort((a, b) => a - b); // s = section u
    expect(us[1]! - us[0]!).toBeCloseTo(25, 3); // touching (centre-to-centre = Ø)
    expect(dots.every((c) => Math.abs(c.center.t - -260) < 1e-6)).toBe(true); // all at one depth
  });

  it("a layer shows a distinct row at its offset depth", () => {
    const layer: Layer = { kind: "layer", id: "L2", face: "BOTTOM", layerIndex: 1, count: 3, inset: 48, span: 200, shape: droite, params: { L: 6000 }, diameter: 20 };
    const dots = coupe(beam(layer)).circles.filter((c) => c.groupId.startsWith("L2#"));
    expect(dots.length).toBe(3);
    // all at one depth, inboard of the −252 cover line (−212 = one 40 mm step up).
    expect(dots.every((c) => Math.abs(c.center.t - -212) < 1e-6)).toBe(true);
  });

  it("a skin row shows the side-face dots", () => {
    const skin: BarRow = { kind: "row", id: "SK", anchor: { u: -uFace, v: -150 }, direction: "v", extent: 300, count: 3, skin: true, shape: droite, params: { L: 6000 }, diameter: 10 };
    const dots = coupe(beam(skin)).circles.filter((c) => c.groupId.startsWith("SK#"));
    expect(dots.length).toBe(3);
    expect(dots.every((c) => Math.abs(c.center.s - -uFace) < 1e-6)).toBe(true); // on the side face
  });

  it("a placed bar the cut plane misses is correctly ABSENT (present only where it runs)", () => {
    // a bar curtailed to [0, 100] mm: crossed by a cut at y=50, missed by the mid-span cut at y=3000.
    const shortBar: SingleBar = { kind: "single", id: "SHORT", position: { u: 90, v: -260 }, shape: droite, params: { L: 6000 }, diameter: 32, startStation: 0, endStation: 100 };
    const r = beam(shortBar);
    expect(sectionAt(r, cutAt(50)).circles.some((c) => c.groupId === "SHORT")).toBe(true);
    expect(sectionAt(r, cutAt(3000)).circles.some((c) => c.groupId === "SHORT")).toBe(false);
  });
});
