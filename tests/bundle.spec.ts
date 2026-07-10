/**
 * v1.0.5 M3 (P-E, [REF-SYS-Bundle]) — bundled bars.
 *
 * A `Bundle` = 2–4 bars in contact at one position: scheduled as the REAL count (one mark), `As = n·area`,
 * with an equivalent diameter `φₙ = φ·√n ≤ 55 mm` (`code.bundleEquivDiameter`) that drives cover /
 * clear-spacing / mandrel-lap (checked in Track V/M4). It resolves to `n` touching `SingleBar`s.
 */
import { describe, it, expect } from "vitest";
import { solveElement, placeBars, barArea, type SolveResult, type Bundle } from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { makeEc2Pack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");
const BND_DIA = 25;

function column(bundle?: Bundle): SolveResult {
  return solveElement({
    element: "E-COL-01", profile: "BAEL_COLUMN", section: "RECT",
    geometry: { b: 400, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 }, cover: 30, exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT: 8, phiLInset: 20,
    longitudinal: [{ zone: "As_total", groupId: "L1", role: "PRIMARY_LONGITUDINAL", shape: droite, params: { L: 3000 }, diameter: 20, faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"], asReq: 1800, tensionFace: "BOTTOM" }],
    transverse: [{ zone: "Asw", groupId: "T1", shape: cadre, params: { w: 314, h: 524 }, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 }],
    ...(bundle ? { placed: [bundle] } : {}),
    code,
  });
}

const triple: Bundle = { kind: "bundle", id: "BND", position: { u: 100, v: -260 }, n: 3, shape: droite, params: { L: 3000 }, diameter: BND_DIA };

describe("M3 P-E — a bundle schedules the real count, one mark", () => {
  it("a triple bundle resolves to 3 touching bars (centre-to-centre = Ø)", () => {
    const bars = placeBars(column(triple)).filter((b) => b.groupId.startsWith("BND#"));
    expect(bars.length).toBe(3);
    const us = bars.map((b) => b.points[0]!).sort((a, b) => a - b);
    expect(us[1]! - us[0]!).toBeCloseTo(BND_DIA, 3); // touching
    expect(us[2]! - us[1]!).toBeCloseTo(BND_DIA, 3);
  });

  it("schedules as ONE merged mark with count 3", () => {
    const line = computeBBS(column(triple)).lines.find((l) => l.diameter === BND_DIA)!;
    expect(line.count).toBe(3);
    expect(line.groupIds).toEqual(["BND#0", "BND#1", "BND#2"]);
  });

  it("As,prov = n · bar area", () => {
    const asOf = (r: SolveResult) => r.validation.find((v) => v.rule === "provided_area")!.value as number;
    expect(asOf(column(triple)) - asOf(column())).toBeCloseTo(3 * barArea(BND_DIA), 0);
  });

  it("code.bundleEquivDiameter = φ·√n, capped at 55 mm (BAEL + EC2)", () => {
    expect(code.bundleEquivDiameter(25, 3)).toBeCloseTo(25 * Math.sqrt(3), 4);
    expect(code.bundleEquivDiameter(32, 4)).toBe(55); // 64 → capped
    expect(makeEc2Pack().bundleEquivDiameter(20, 2)).toBeCloseTo(20 * Math.SQRT2, 4);
  });
});
