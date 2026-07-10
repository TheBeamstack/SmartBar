/**
 * Beam profile + curtailment / shift rule (spec §7.4 beam, §7.5, §7.7). The chapeau extension
 * is `l_support_zone + a_l + l_bd` and flows into its cutLength; end-support bottom-bar
 * anchorage must carry ≥ 0.25·As,span past the support, else WARN.
 */
import { describe, it, expect } from "vitest";
import {
  solveElement,
  computeCurtailment,
  generateBarShape,
  type ElementSolveInput,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p3-helpers";

const code = makeBaelPack();
const material = { f_c28: 25, f_e: 500 };
const b = 300;
const h = 600;
const cover = 30;
const phiT = 8;

function beamSolve(opts: { chapeauL?: number } = {}) {
  const wStir = b - 2 * cover - phiT;
  const hStir = h - 2 * cover - phiT;
  const input: ElementSolveInput = {
    element: "E-BEM-01",
    profile: "BAEL_BEAM",
    section: "RECT",
    geometry: { b, h, L: 6000 },
    material,
    cover,
    exposure: "EXTERIOR",
    layout: { principle: "FREE", nTop: 2, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT,
    phiLInset: 20,
    longitudinal: [
      {
        zone: "As_span_bottom",
        groupId: "B1",
        shape: loadShape("droite"),
        params: { L: 6000 },
        diameter: 20,
        faces: ["BOTTOM"],
        asReq: 900,
        tensionFace: "BOTTOM",
      },
      {
        zone: "As_top_support",
        groupId: "C1",
        shape: loadShape("chapeau"),
        params: { L: opts.chapeauL ?? 1500 },
        diameter: 16,
        faces: ["TOP"],
        asReq: 380,
        tensionFace: "TOP",
      },
    ],
    transverse: [
      {
        zone: "Asw_shear",
        groupId: "S1",
        shape: loadShape("etrier"),
        params: { w: wStir, h: hStir },
        diameter: phiT,
        spacing: 200,
        nLegs: 2,
        aswReqPerM: 300,
      },
    ],
    code,
  };
  return solveElement(input);
}

describe("beam curtailment & shift (§7.7)", () => {
  it("chapeau horizontal run = l_support_zone + a_l + l_bd (and flows into cutLength)", () => {
    const supportZone = 1000;
    const d = 552; // computed effective depth for the b300×h600 beam
    const cur = computeCurtailment(code, { diameter: 16, material, supportZone, d, goodBond: false });
    expect(cur.shift).toBeCloseTo(d, 6); // a_l ≈ d
    expect(cur.extension).toBeCloseTo(supportZone + cur.shift + cur.lbd, 6);

    const chap = generateBarShape(loadShape("chapeau"), { L: cur.extension }, 16, code);
    // the chapeau's principal (horizontal) leg equals the curtailment extension …
    expect(chap.fiche.legs[0]!.length).toBeCloseTo(cur.extension, 6);
    // … and the fabrication cut length carries it (plus the 90° support returns)
    expect(chap.cutLength).toBeGreaterThan(cur.extension);
  });

  it("computes the span effective depth from the resolved bars (not 0.9h)", () => {
    const res = beamSolve();
    const span = res.zones.find((z) => z.zone === "As_span_bottom")!;
    expect(span.d).toBeCloseTo(552, 0); // h − cover − φt − φℓ/2 = 600−30−8−10
    expect(span.d).not.toBeCloseTo(0.9 * h, 0);
  });

  it("end-support anchorage PASSES when bottom bars run full length to the supports", () => {
    // v1.0.5 P2 (D3): a grouped span (no per-bar curtailment) → all bars run through → PASS.
    const res = beamSolve();
    const es = res.validation.find((v) => v.rule === "end_support_anchorage")!;
    expect(es.status).toBe("PASS");
  });
  // The WARN case (bars curtailed short of the support) is now driven by REAL per-bar curtailment
  // geometry — see tests/curtailment.spec.ts (the inert `continuedToSupport` fraction was removed).

  it("emits beam stirrup spacing s ≤ 0.75·d and per-zone provided-area rules", () => {
    const res = beamSolve();
    const ss = res.validation.find((v) => v.rule === "stirrup_spacing:Asw_shear")!;
    expect(ss).toBeDefined();
    expect(Number(ss.limit)).toBeCloseTo(0.75 * 552, 0);
    expect(res.validation.some((v) => v.rule === "provided_area:As_span_bottom")).toBe(true);
    expect(res.validation.some((v) => v.rule === "provided_area:As_top_support")).toBe(true);
    expect(res.status).not.toBe("FAIL");
  });
});
