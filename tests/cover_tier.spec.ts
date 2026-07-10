/**
 * §7.3 cover check — FAIL/PASS, applied UNIFORMLY across element validators via the shared
 * `coverItem` helper (a column through `validateColumn`, a beam through the profile registry).
 *
 * Cover BELOW the durability+fire minimum → 🔴 FAIL. Cover that MEETS the minimum (including exactly
 * AT it) → 🟢 PASS: a cover at the code minimum is **code-compliant**, so it is green, not amber
 * (validity-tier philosophy, core_logic §4.2 — 🟢 = "within the rules").
 *
 * History: a §7.12 "comfort-target" WARN band was tried (v1.0.4, Amer) and reverted (review F1, Zayd
 * 2026-07-08) — it turned the shipped default column/beam (cover at the code minimum) amber
 * "À vérifier", and every design sitting on a binding minimum (fire / cast-against-earth). If a
 * comfort nudge is ever wanted it must be advisory-only and must NOT roll up to the drawing stamp
 * (owner decision owner_tasks B-5a).
 */
import { describe, it, expect } from "vitest";
import { solveColumn, solveElement, type ElementSolveInput } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");
const code = makeBaelPack();

// BAEL EXTERIOR, Ø20 → reqCover = 30 mm.
function columnCoverItem(cover: number) {
  const r = solveColumn({
    element: "E-COL-01",
    geometry: { b: 300, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500, f_ck: 25, f_yk: 500 },
    cover,
    exposure: "EXTERIOR",
    dg: 20,
    longitudinal: { groupId: "L1", shape: droite, diameter: 20, layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 }, asReq: 1800 },
    tie: { groupId: "T1", shape: cadre, diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    code,
  });
  return r.validation.find((v) => v.rule === "cover")!;
}

describe("cover — §7.3 FAIL/PASS (column, validateColumn)", () => {
  it("below the code minimum (25 < 30) → 🔴 FAIL", () => {
    const c = columnCoverItem(25);
    expect(c.status).toBe("FAIL");
    expect(c.tier).toBe(1);
    expect(c.symbol).toBe("🔴");
  });

  it("exactly AT the code minimum (30) → 🟢 PASS (compliant, not amber)", () => {
    const c = columnCoverItem(30);
    expect(c.status).toBe("PASS");
    expect(c.tier).toBe(3);
    expect(c.symbol).toBe("🟢");
  });

  it("comfortably above the minimum (35) → 🟢 PASS", () => {
    expect(columnCoverItem(35).status).toBe("PASS");
  });

  it("the PASS message names the requirement", () => {
    const c = columnCoverItem(31);
    expect(c.message_en).toContain("required");
    expect(c.message_en).toContain("30");
  });
});

/** The SAME helper drives a profile validator (beam) — proves the cover rule is uniform, not column-only. */
function beamCoverStatus(cover: number): string {
  const b = 300, h = 600, L = 6000, phiT = 8;
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
    ],
    transverse: [
      { zone: "Asw_shear", groupId: "S1", shape: loadShape("etrier"), params: { w: b - 2 * cover - phiT, h: h - 2 * cover - phiT }, diameter: phiT, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    ],
    code,
  };
  return solveElement(input).validation.find((v) => v.rule === "cover")!.status;
}

describe("cover — the FAIL/PASS rule is uniform across validators (beam, profile registry)", () => {
  it("beam cover at/above the minimum → 🟢 PASS; below → 🔴 FAIL", () => {
    expect(beamCoverStatus(30)).toBe("PASS"); // exactly at the EXTERIOR minimum
    expect(beamCoverStatus(40)).toBe("PASS");
    expect(beamCoverStatus(20)).toBe("FAIL");
  });
});
