/**
 * v1.0.4 C1 ([REF-SYS-810], spec Part IV C1) — station-aware coupes.
 *   • `defaultCoupeFor` seeds the default cut where the longitudinal detailing is richest, so an
 *     offset/bent/relevé/extra bar a mid-span cut would miss is shown — but ONLY on the addressable
 *     channel; a plain grouped member keeps mid-length (byte-identical).
 *   • `suggestCoupeStations` offers meaningful cut stations (mid + each partial-length bar's midpoint).
 * ⚠ the G-COUPE conventions remain PROVISIONAL pending owner/engineer ratification (owner_tasks §B-7).
 */
import { describe, it, expect } from "vitest";
import {
  solveElement,
  defaultCoupeFor,
  suggestCoupeStations,
  sectionAt,
  type ElementSolveInput,
  type SolveResult,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { referenceBeam } from "./bbs-helpers";
import { loadShape } from "./p3-helpers";

const L = 6000;

/** The reference beam plus an independent extra bar sitting only over the right end ([5000,6000]). */
function beamWithEndExtra(): SolveResult {
  const code = makeBaelPack();
  const b = 300, h = 600, cover = 30, phiT = 8;
  const droite = loadShape("droite");
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
      { zone: "As_span_bottom", groupId: "B1", shape: droite, params: { L }, diameter: 20, faces: ["BOTTOM"], asReq: 900, tensionFace: "BOTTOM" },
      { zone: "As_top_support", groupId: "C1", shape: loadShape("chapeau"), params: { L: 1500 }, diameter: 16, faces: ["TOP"], asReq: 380, tensionFace: "TOP" },
    ],
    transverse: [
      { zone: "Asw_shear", groupId: "S1", shape: loadShape("etrier"), params: { w: b - 2 * cover - phiT, h: h - 2 * cover - phiT }, diameter: phiT, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    ],
    extraBars: [
      { id: "R1", position: { u: 0, v: 240 }, shape: droite, params: { L: 1000 }, diameter: 16, axisStart: 5000 },
    ],
    code,
  };
  return solveElement(input);
}

const barCount = (view: ReturnType<typeof sectionAt>): number =>
  view.annotations.reduce((s, a) => s + a.count, 0);

describe("C1 — defaultCoupeFor is station-aware", () => {
  it("keeps mid-length for a plain grouped member (byte-identical default)", () => {
    expect(defaultCoupeFor(referenceBeam()).origin.y).toBe(L / 2);
  });

  it("shifts the default to a richer station that reveals MORE longitudinal bars than mid-span", () => {
    const result = beamWithEndExtra();
    const cut = defaultCoupeFor(result);
    const midCut = { ...cut, origin: { ...cut.origin, y: L / 2 } };
    expect(cut.origin.y).not.toBe(L / 2);
    expect(barCount(sectionAt(result, cut))).toBeGreaterThan(barCount(sectionAt(result, midCut)));
  });
});

describe("C1 — suggestCoupeStations", () => {
  it("is just [mid] for a plain full-length member", () => {
    expect(suggestCoupeStations(referenceBeam())).toContain(L / 2);
  });

  it("offers mid plus a station over the offset extra's run", () => {
    const s = suggestCoupeStations(beamWithEndExtra());
    expect(s).toContain(L / 2);
    expect(s.some((x) => x > 5000 && x < 6000)).toBe(true);
  });

  it("is deterministic + sorted", () => {
    const s = suggestCoupeStations(beamWithEndExtra());
    expect(s).toEqual([...s].sort((a, b) => a - b));
    expect(suggestCoupeStations(beamWithEndExtra())).toEqual(s);
  });
});
