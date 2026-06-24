/**
 * RPS 2000/2011 seismic-overlay engineering reference case (spec §7.10, plan P4b gate G-RPS).
 *
 * ⚠⚠ PROVISIONAL / UNSIGNED. These golden numbers are computed from the standard RPS relations
 * against the PROVISIONAL cells in packages/codepacks/src/seismic/rps-2011.json
 * (`"_provisional": true`). They are NOT yet ratified by the nominated structural engineer.
 * Gate **G-RPS** (current_state.md §6) blocks M4b *acceptance* — not coding — until signed off.
 *
 * The TABLE SHAPE + override mechanism are final (spec §7.10b note); only the cells await sign-off.
 */
import { describe, it, expect } from "vitest";
import { makeRpsOverlay } from "@rebarconfig/codepacks";

const nd2 = makeRpsOverlay({ code: "RPS-2011", zone: 2, ductility: "ND2" });

describe("RPS overlay reference (PROVISIONAL — G-RPS unsigned)", () => {
  it("the overlay reports itself provisional (gate visible, not silently 'done')", () => {
    expect(nd2._provisional).toBe(true);
    expect(nd2.id).toBe("RPS-2011");
  });

  it("critical-zone length l_c — column: max(h_section, H_clear/6, 450 mm)", () => {
    // governing H/6: H=3600 → 600
    expect(nd2.criticalZoneLength({ member: "COLUMN", hSectionMax: 400, clearLength: 3600 })).toBeCloseTo(600, 6);
    // governing section size: short stocky column
    expect(nd2.criticalZoneLength({ member: "COLUMN", hSectionMax: 700, clearLength: 2400 })).toBeCloseTo(700, 6);
    // floor 450
    expect(nd2.criticalZoneLength({ member: "COLUMN", hSectionMax: 300, clearLength: 2400 })).toBeCloseTo(450, 6);
  });

  it("critical-zone length l_c — beam: 2·h from the support face", () => {
    expect(nd2.criticalZoneLength({ member: "BEAM", hSectionMax: 500, clearLength: 6000 })).toBeCloseTo(1000, 6);
  });

  it("critical-zone tie spacing per ND class — s_crit = min(kφ·φℓ, k_b·b_min, cap)", () => {
    const nd1 = makeRpsOverlay({ code: "RPS-2011", zone: 2, ductility: "ND1" });
    const nd3 = makeRpsOverlay({ code: "RPS-2011", zone: 2, ductility: "ND3" });
    // φℓ=20, b_min=400
    expect(nd1.critSpacingMax({ phiL: 20, bMin: 400 })).toBeCloseTo(200, 6); // min(240,200,200)
    expect(nd2.critSpacingMax({ phiL: 20, bMin: 400 })).toBeCloseTo(150, 6); // min(160,200,150)
    expect(nd3.critSpacingMax({ phiL: 20, bMin: 400 })).toBeCloseTo(100, 6); // min(120,100,100)
  });

  it("critical-zone min tie ø: ND1 6 mm, ND2/ND3 8 mm", () => {
    expect(makeRpsOverlay({ code: "RPS-2011", zone: 2, ductility: "ND1" }).critTieDiameterMin()).toBe(6);
    expect(nd2.critTieDiameterMin()).toBe(8);
  });

  it("hook rule: 135° / ≥10φ (firm, RPS)", () => {
    expect(nd2.hookRule()).toEqual({ angle: 135, extFactor: 10 });
  });

  it("engagement rule: ND1 none, ND2 alternate, ND3 every", () => {
    expect(makeRpsOverlay({ code: "RPS-2011", zone: 2, ductility: "ND1" }).engagementRule()).toBe("none");
    expect(nd2.engagementRule()).toBe("alternate");
    expect(makeRpsOverlay({ code: "RPS-2011", zone: 2, ductility: "ND3" }).engagementRule()).toBe("every");
  });

  it("lap-in-critical-zone severity: ND1 WARN, ND2/ND3 FAIL", () => {
    expect(makeRpsOverlay({ code: "RPS-2011", zone: 2, ductility: "ND1" }).lapInCriticalZoneTier()).toBe("WARN");
    expect(nd2.lapInCriticalZoneTier()).toBe("FAIL");
  });

  it("segment injection clamps l_c so the two end zones never overrun the member", () => {
    const segs = nd2.injectCriticalSegments({ member: "COLUMN", memberLength: 800, l_c: 600, userSpacing: 100 });
    // l_c clamped to 400 (= length/2); middle = 0
    expect(segs.map((s) => s.extent)).toEqual([400, 0, 400]);
    expect(segs.filter((s) => s.critical)).toHaveLength(2);
  });
});
