/**
 * Shared builder for the v1.0.3 G2 addressable-bar tests: a reference rectangular column with
 * optional per-bar overrides + extra bars, fed straight through the generic `solveElement`.
 */
import type { ElementSolveInput, LongBarOverride, ExtraLongBar } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

export const code = makeBaelPack();
export const droite = loadShape("droite");
export const H = 3000;

export function column(opts: { overrides?: LongBarOverride[]; extra?: ExtraLongBar[] } = {}): ElementSolveInput {
  return {
    element: "E-COL-01",
    profile: "BAEL_COLUMN",
    section: "RECT",
    geometry: { b: 300, h: 600, H },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT: 8,
    phiLInset: 20,
    longitudinal: [
      {
        zone: "As_total",
        groupId: "L1",
        role: "PRIMARY_LONGITUDINAL",
        shape: droite,
        params: { L: H },
        diameter: 20,
        faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"],
        asReq: 1800,
        tensionFace: "BOTTOM",
      },
    ],
    transverse: [
      { zone: "Asw_confinement", groupId: "T1", shape: loadShape("cadre_rect"), params: { w: 244, h: 544 }, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    ],
    ...(opts.overrides ? { longOverrides: opts.overrides } : {}),
    ...(opts.extra ? { extraBars: opts.extra } : {}),
    code,
  };
}
