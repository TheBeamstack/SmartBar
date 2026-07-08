/**
 * v1.0.4 — §7.12 cover comfort-target WARN band. Cover below the durability+fire requirement is
 * 🔴 FAIL (unchanged); cover that MEETS the code minimum but sits below the comfort target
 * `reqCover·(1+band)` is now 🟠 WARN; comfortably above → 🟢 PASS. The band is the pack's
 * `warnBands.cover` (BAEL/EC2 default 0.1). Applied UNIFORMLY across element validators (a column via
 * `validateColumn`, a beam via the profile registry) — one "cover" rule, one behaviour.
 * ⚠ the comfort band (G-TOL) is PROVISIONAL pending owner/engineer sign-off (owner_tasks B-5).
 */
import { describe, it, expect } from "vitest";
import { solveColumn, solveElement, type ElementSolveInput } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const droite = loadShape("droite");
const cadre = loadShape("cadre_rect");
const code = makeBaelPack();

// BAEL EXTERIOR, Ø20 → reqCover = 30 mm; comfort target = 30·1.1 = 33 mm.
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

describe("cover — §7.12 comfort-target WARN band (column, validateColumn)", () => {
  it("below the code minimum (25 < 30) → 🔴 FAIL", () => {
    const c = columnCoverItem(25);
    expect(c.status).toBe("FAIL");
    expect(c.tier).toBe(1);
    expect(c.symbol).toBe("🔴");
  });

  it("at the bare minimum (30, ≥ 30 but < comfort 33) → 🟠 WARN", () => {
    const c = columnCoverItem(30);
    expect(c.status).toBe("WARN");
    expect(c.tier).toBe(2);
    expect(c.symbol).toBe("🟠");
  });

  it("just under the comfort target (32 < 33) → still 🟠 WARN", () => {
    expect(columnCoverItem(32).status).toBe("WARN");
  });

  it("comfortably above the comfort target (35 ≥ 33) → 🟢 PASS", () => {
    const c = columnCoverItem(35);
    expect(c.status).toBe("PASS");
    expect(c.tier).toBe(3);
  });

  it("the WARN message names both the requirement and the comfort target", () => {
    const c = columnCoverItem(31);
    expect(c.message_en).toContain("comfort target");
    expect(c.message_en).toContain("33");
  });
});

/** The SAME band fires through a profile validator (beam) — proves uniform, not column-only. */
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
      { zone: "As_span_bottom", groupId: "B1", shape: droite, params: { L }, diameter: 20, faces: ["BOTTOM"], asReq: 900, tensionFace: "BOTTOM", continuedToSupport: 1 },
    ],
    transverse: [
      { zone: "Asw_shear", groupId: "S1", shape: loadShape("etrier"), params: { w: b - 2 * cover - phiT, h: h - 2 * cover - phiT }, diameter: phiT, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    ],
    code,
  };
  return solveElement(input).validation.find((v) => v.rule === "cover")!.status;
}

describe("cover — the comfort band is uniform across validators (beam, profile registry)", () => {
  it("beam cover in the comfort band → 🟠 WARN (not silently PASS)", () => {
    expect(beamCoverStatus(31)).toBe("WARN");
  });
  it("beam cover comfortably above → 🟢 PASS; below minimum → 🔴 FAIL", () => {
    expect(beamCoverStatus(40)).toBe("PASS");
    expect(beamCoverStatus(20)).toBe("FAIL");
  });
});
