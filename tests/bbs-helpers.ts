/**
 * Shared fixture for the P5 BBS golden suites: the reference beam (b300×h600×L6000) with a
 * 3Ø20 span + 2Ø16 chapeaux + Ø8@200 stirrups — solved through the generic pipeline.
 */
import {
  solveElement,
  type ElementSolveInput,
  type SolveResult,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p3-helpers";

export function referenceBeam(): SolveResult {
  const code = makeBaelPack();
  const b = 300, h = 600, cover = 30, phiT = 8;
  const wStir = b - 2 * cover - phiT;
  const hStir = h - 2 * cover - phiT;
  const input: ElementSolveInput = {
    element: "E-BEM-01",
    profile: "BAEL_BEAM",
    section: "RECT",
    geometry: { b, h, L: 6000 },
    material: { f_c28: 25, f_e: 500 },
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
        continuedToSupport: 1,
      },
      {
        zone: "As_top_support",
        groupId: "C1",
        shape: loadShape("chapeau"),
        params: { L: 1500 },
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
