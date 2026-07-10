/**
 * v1.0.4 B2 ([REF-SYS-260], spec Part III B2) — beam two-support precision:
 *  1. per-support AXIAL placement — each chapeau sits over ITS support (left starts at station 0,
 *     right ends at L = axisStart `L − extension`), not the representative station 0 for both;
 *  2. per-support ANCHORAGE — the bottom-bar anchorage into each support (V1/V2) is validated
 *     independently against a hooked design anchorage l_bd (two distinct verdicts).
 * The grouped fast path (a plain beam with no relevés/overrides) is unchanged — the axial placement
 * rides the addressable channel; the anchorage check is data-only (default hooked anchorage passes).
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "./solveDoc";
import { defaultBeamDoc, defaultColumnDoc, type BeamDoc } from "./document";
import { placeBars, type PlacedLongBar } from "@rebarconfig/core";

const L = 6000;
const withReleve = (): BeamDoc => ({
  ...defaultBeamDoc(),
  releves: [{ id: "R1", support: "left", count: 2, diameter: 12 }], // forces the addressable channel
});
const axisOf = (bars: PlacedLongBar[], groupId: string): number[] =>
  bars.filter((b) => b.groupId === groupId).map((b) => b.axisStart);

describe("B2 — per-support axial placement (addressable channel)", () => {
  it("the right chapeau sits over the right support (axisStart near L); the left starts at 0", () => {
    const r = solveDoc(withReleve());
    expect(r.longBars).toBeDefined();
    const left = axisOf(r.longBars!, "C_left");
    const right = axisOf(r.longBars!, "C_right");
    expect(left.length).toBe(2);
    expect(right.length).toBe(2);
    left.forEach((a) => expect(a).toBe(0)); // left chapeau anchored at the left support
    right.forEach((a) => {
      expect(a).toBeGreaterThan(L / 2); // right chapeau is on the right half…
      expect(a).toBeLessThan(L); // …starting before the far end
    });
    // symmetric supports ⇒ the two chapeaux are mirror images: right.axisStart = L − left.extent
    // (the left chapeau spans [0, ext]; the right ends at L).
  });

  it("the rendered right chapeau reaches the right support face (worldY ≈ L)", () => {
    const placed = placeBars(solveDoc(withReleve()));
    const yOf = (gid: string): number[] => {
      const pts = placed.filter((b) => b.groupId === gid).flatMap((b) => b.points);
      return pts.filter((_, i) => i % 3 === 1); // worldY = index 1,4,7,…
    };
    const rightY = yOf("C_right");
    const leftY = yOf("C_left");
    expect(Math.max(...rightY)).toBeGreaterThan(L - 200); // ends at the right support
    expect(Math.min(...leftY)).toBeLessThan(200); // left starts at the left support
  });

  it("a plain default beam now emits longBars for the two-support placement (v1.0.5 P1, D1/D2 fixed)", () => {
    const r = solveDoc(defaultBeamDoc());
    // multi-zone-per-face (montage + both chapeaux on TOP) forces the single per-bar placement path…
    expect(r.longBars).toBeDefined();
    // …but it is placement only — no USER addressable content (validation/coupe stay decoupled, A2).
    expect(r.hasUserAddressableContent).toBeFalsy();
    // both chapeaux are drawn, each over its own support (was: only the left chapeau, D1/D2).
    expect(axisOf(r.longBars!, "C_left")).toEqual([0, 0]);
    expect(axisOf(r.longBars!, "C_right").every((a) => a > L / 2 && a < L)).toBe(true);
  });
});

describe("B2 — per-support anchorage validation (§7.7, each support its own l_bd)", () => {
  it("a symmetric default beam gets two anchorage checks, both PASS (hooked anchorage clears l_bd)", () => {
    const r = solveDoc(defaultBeamDoc());
    const left = r.validation.find((v) => v.rule === "support_anchorage:left");
    const right = r.validation.find((v) => v.rule === "support_anchorage:right");
    expect(left?.status).toBe("PASS");
    expect(right?.status).toBe("PASS");
    // symmetric ⇒ identical required length + verdict
    expect(left?.limit).toBe(right?.limit);
    expect(r.status).not.toBe("FAIL"); // legacy no-op: the default beam is not regressed
  });

  it("a too-short anchorage on one support WARNs only that support", () => {
    const base = defaultBeamDoc();
    const doc: BeamDoc = {
      ...base,
      supports: {
        left: { ...base.supports.left, anchorage: 400 },
        right: { ...base.supports.right, anchorage: 80 }, // far below l_bd
      },
    };
    const r = solveDoc(doc);
    expect(r.validation.find((v) => v.rule === "support_anchorage:left")?.status).toBe("PASS");
    expect(r.validation.find((v) => v.rule === "support_anchorage:right")?.status).toBe("WARN");
  });

  it("a column (no supports) emits no per-support anchorage check", () => {
    const rules = solveDoc(defaultColumnDoc()).validation.map((v) => v.rule);
    expect(rules.some((x) => x.startsWith("support_anchorage:"))).toBe(false);
  });
});
