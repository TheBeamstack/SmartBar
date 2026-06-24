/**
 * Layout solver corner-sharing (spec §6.1.1–.3). nTop=nBottom=3, nLeft=nRight=2 → N=6,
 * shared corners counted once; an occupied face with <2 bars → tier-1 hard-invalid.
 */
import { describe, it, expect } from "vitest";
import { solveRectLayout, solveColumn } from "@rebarconfig/core";
import type { LayoutDescriptor } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const base: LayoutDescriptor = {
  section: "RECT",
  geometry: { b: 300, h: 600 },
  cover: 30,
  phiT: 8,
  phiL: 20,
  rect: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2, layers: 1 },
};

describe("rectangular layout — corner sharing", () => {
  it("N = 4 + Σ(nFace−2) = 6 with corners counted once", () => {
    const r = solveRectLayout(base);
    expect(r.count).toBe(6);
    expect(r.bars).toHaveLength(6); // 4 corners + 1 mid-top + 1 mid-bottom
    expect(r.bars.filter((b) => b.isCorner)).toHaveLength(4);
  });

  it("places the 4 corner bars at the core-rectangle corners (inset = c+φt+φℓ/2)", () => {
    const r = solveRectLayout(base);
    expect(r.inset).toBe(48); // 30 + 8 + 10
    expect(r.core).toEqual({ width: 300 - 96, height: 600 - 96 });
    const corners = r.bars.filter((b) => b.isCorner).map((b) => b.position);
    for (const c of corners) {
      expect(Math.abs(c.u)).toBeCloseTo(r.core.width / 2, 6);
      expect(Math.abs(c.v)).toBeCloseTo(r.core.height / 2, 6);
    }
  });

  it("flags an occupied face with <2 bars as tier-1 hard-invalid", () => {
    const r = solveRectLayout({
      ...base,
      rect: { ...base.rect!, nLeft: 1, nRight: 1, principle: "LAYERED" },
    });
    expect(r.underfilledFaces).toContain("LEFT");

    // end-to-end: the column validator surfaces it as a 🔴 FAIL
    const code = makeBaelPack();
    const res = solveColumn({
      element: "E-COL-01",
      geometry: { b: 300, h: 600, H: 3000 },
      material: { f_c28: 25, f_e: 500 },
      cover: 30,
      exposure: "EXTERIOR",
      longitudinal: {
        groupId: "L1",
        shape: loadShape("droite"),
        diameter: 20,
        layout: { principle: "LAYERED", nTop: 3, nBottom: 3, nLeft: 1, nRight: 1 },
        asReq: 1000,
      },
      tie: { groupId: "T1", shape: loadShape("cadre_rect"), diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 0 },
      code,
    });
    const face = res.validation.find((v) => v.rule === "face_min_bars");
    expect(face?.status).toBe("FAIL");
    expect(face?.tier).toBe(1);
    expect(face?.symbol).toBe("🔴");
  });
});
