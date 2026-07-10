/**
 * v1.0.5 M3 (P-F, [REF-SYS-Skin]) — side-face / skin reinforcement rows.
 *
 * Skin steel is a `BarRow` (`skin: true`) on a beam's LEFT/RIGHT face — distributed longitudinal bars up
 * the side of a deep beam. It is first-class: counted, curtailable, rendered + scheduled (the old
 * presence-only SKIN supplement fanout is superseded by the row model). The depth-triggered skin MINIMUM
 * is Track V/M4; here we prove the placement + schedule + As credit.
 */
import { describe, it, expect } from "vitest";
import { solveElement, placeBars, barArea, type SolveResult, type BarRow } from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const droite = loadShape("droite");
const etrier = loadShape("etrier");
const SKIN_DIA = 10; // distinctive small Ø for the skin bars
const uFace = 300 / 2 - (30 + 8 + 20 / 2); // ±(b/2 − inset): the LEFT/RIGHT cover line

/** A deep beam with optional skin rows on both side faces (placed as `input.placed`). */
function beam(...skin: BarRow[]): SolveResult {
  return solveElement({
    element: "E-BEM-01", profile: "BAEL_BEAM", section: "RECT",
    geometry: { b: 300, h: 900, L: 6000 },
    material: { f_c28: 25, f_e: 500 }, cover: 30, exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 2, nBottom: 3, nLeft: 0, nRight: 0 },
    phiT: 8, phiLInset: 20,
    longitudinal: [
      { zone: "As_span_bottom", groupId: "B1", role: "PRIMARY_LONGITUDINAL", shape: droite, params: { L: 6000 }, diameter: 20, faces: ["BOTTOM"], asReq: 900, tensionFace: "BOTTOM" },
      { zone: "As_montage", groupId: "M1", role: "PRIMARY_LONGITUDINAL", shape: droite, params: { L: 6000 }, diameter: 12, faces: ["TOP"], asReq: 0, tensionFace: "TOP" },
    ],
    transverse: [{ zone: "Asw", groupId: "S1", shape: etrier, params: { w: 300 - 2 * 30 - 8, h: 900 - 2 * 30 - 8 }, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 }],
    ...(skin.length ? { placed: skin } : {}),
    code,
  });
}

/** A skin row of 3 bars running up a side face (direction "v"), full member length. */
function skinRow(id: string, u: number): BarRow {
  return { kind: "row", id, anchor: { u, v: -200 }, direction: "v", extent: 400, count: 3, skin: true, shape: droite, params: { L: 6000 }, diameter: SKIN_DIA };
}

describe("M3 P-F — skin rows on both side faces", () => {
  it("renders 3 bars on EACH side face at the side-face u", () => {
    const rendered = placeBars(beam(skinRow("SKL", -uFace), skinRow("SKR", uFace)));
    const left = rendered.filter((b) => b.groupId.startsWith("SKL#"));
    const right = rendered.filter((b) => b.groupId.startsWith("SKR#"));
    expect(left.length).toBe(3);
    expect(right.length).toBe(3);
    expect(left.every((b) => Math.abs(b.points[0]! - -uFace) < 1e-6)).toBe(true);
    expect(right.every((b) => Math.abs(b.points[0]! - uFace) < 1e-6)).toBe(true);
  });

  it("schedules the skin bars (Ø10, 6 bars → one merged mark)", () => {
    const line = computeBBS(beam(skinRow("SKL", -uFace), skinRow("SKR", uFace))).lines.find((l) => l.diameter === SKIN_DIA)!;
    expect(line).toBeDefined();
    expect(line.count).toBe(6); // 3 + 3 identical bars
  });

  it("credits skin steel to a longitudinal region (As,prov rises)", () => {
    // the beam validator emits `provided_area:<zone>` — sum across zones (skin folds into the nearest).
    const asTotal = (r: SolveResult) =>
      r.validation.filter((v) => v.rule.startsWith("provided_area")).reduce((s, v) => s + (v.value as number), 0);
    expect(asTotal(beam(skinRow("SKL", -uFace), skinRow("SKR", uFace)))).toBeGreaterThan(asTotal(beam()));
  });
});
