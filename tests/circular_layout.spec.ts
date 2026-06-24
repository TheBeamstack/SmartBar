/**
 * Circular layout solver — EQUAL_PERIMETER (spec §6.1, plan P4a). 6 bars on the pitch circle at
 * 60°; s_arc = 2·R_p·sin(180/N) − φ_ℓ; < 6 bars → tier-1 hard-invalid. End-to-end via solveCircular
 * (E-COL-02). Pack-agnostic.
 */
import { describe, it, expect } from "vitest";
import { solveCircularLayout, solveCircular } from "@rebarconfig/core";
import type { LayoutDescriptor } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();

const desc = (count: number): LayoutDescriptor => ({
  section: "CIRCULAR",
  geometry: { D: 600 },
  cover: 50,
  phiT: 8,
  phiL: 20,
  circularCount: count,
});

describe("circular layout — EQUAL_PERIMETER", () => {
  it("places N bars on the pitch circle R_p = D/2 − c − φt − φℓ/2 at 360/N", () => {
    const r = solveCircularLayout(desc(6));
    expect(r.Rp).toBeCloseTo(232, 6); // 300 − 50 − 8 − 10
    expect(r.count).toBe(6);
    expect(r.bars).toHaveLength(6);
    expect(r.bars[0]!.position.u).toBeCloseTo(232, 6); // datum at +u
    expect(r.bars[0]!.position.v).toBeCloseTo(0, 6);
    // bar 1 at 60°
    expect(r.bars[1]!.position.u).toBeCloseTo(232 * Math.cos(Math.PI / 3), 6);
    expect(r.bars[1]!.position.v).toBeCloseTo(232 * Math.sin(Math.PI / 3), 6);
  });

  it("arc clear spacing s_arc = 2·R_p·sin(180/N) − φ_ℓ", () => {
    const r = solveCircularLayout(desc(6));
    expect(r.sArc).toBeCloseTo(2 * 232 * Math.sin(Math.PI / 6) - 20, 6); // = 232 − 20 = 212
  });

  it("flags < 6 bars as underfilled (tier-1 hard-invalid)", () => {
    expect(solveCircularLayout(desc(5)).underfilled).toBe(true);
    expect(solveCircularLayout(desc(6)).underfilled).toBe(false);
  });

  it("end-to-end (E-COL-02): 6 bars PASS min-bars, 5 bars → 🔴 FAIL", () => {
    const make = (count: number) =>
      solveCircular({
        element: "E-COL-02",
        profile: "CIRCULAR_COLUMN",
        geometry: { D: 600, H: 3000 },
        material: { f_c28: 25, f_e: 500 },
        cover: 50,
        exposure: "EXTERIOR",
        longitudinal: [
          {
            zone: "As_total",
            groupId: "L1",
            shape: loadShape("droite"),
            params: { L: 3000 },
            diameter: 20,
            count,
            asReq: 1500,
            primary: true,
          },
        ],
        transverse: [
          {
            zone: "Asw_spiral",
            groupId: "SP1",
            shape: loadShape("spirale_helice"),
            params: { pitch: 60, helix_diameter: 500, turns: 50 },
            diameter: 8,
            spacing: 60,
            nLegs: 2,
            aswReqPerM: 0,
          },
        ],
        code,
      });

    const ok = make(6).validation.find((v) => v.rule === "min_bars")!;
    expect(ok.status).toBe("PASS");

    const bad = make(5).validation.find((v) => v.rule === "min_bars")!;
    expect(bad.status).toBe("FAIL");
    expect(bad.tier).toBe(1);
    expect(bad.symbol).toBe("🔴");
  });
});
