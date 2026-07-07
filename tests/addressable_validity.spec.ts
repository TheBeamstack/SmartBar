/**
 * H8 ([v1.0.4], owner A-5) — geometric validity for ADDRESSABLE bars (per-bar overrides + independent
 * extra bars). Three pure predicates over the resolved `longBars[]`, wired into `solveElement`:
 *   • `addressable_axial_extent`   — a bar leaving [0, memberLength] → 🔴 FAIL (blocks export).
 *   • `addressable_section_bounds` — an extra whose (u,v) breaks the cover envelope → 🔴 FAIL.
 *   • `addressable_clear_spacing`  — an extra below the code minimum → 🔴 FAIL / 🟠 WARN if merely tight.
 * Legacy no-op: a doc with no addressable bars (grouped fast path) and a benign Ø-only override add
 * NO addressable item and are byte-identical.
 */
import { describe, it, expect } from "vitest";
import { solveElement } from "@rebarconfig/core";
import { column, droite, H } from "./g2-helpers";

const rule = (r: ReturnType<typeof solveElement>, name: string) =>
  r.validation.find((v) => v.rule === name);
const addressableRules = (r: ReturnType<typeof solveElement>) =>
  r.validation.filter((v) => v.rule.startsWith("addressable_"));

const extra = (over: Partial<{ id: string; u: number; v: number; L: number; axisStart: number; diameter: number }> = {}) => ({
  id: over.id ?? "X1",
  position: { u: over.u ?? 0, v: over.v ?? 0 },
  shape: droite,
  params: { L: over.L ?? H },
  diameter: over.diameter ?? 16,
  ...(over.axisStart !== undefined ? { axisStart: over.axisStart } : {}),
});

describe("H8 — addressable-bar validity", () => {
  it("a valid extra bar PASSes all three predicates and does not block export", () => {
    const r = solveElement(column({ extra: [extra({ u: 0, v: 0 })] }));
    expect(rule(r, "addressable_section_bounds")?.status).toBe("PASS");
    expect(addressableRules(r).some((v) => v.status === "FAIL")).toBe(false);
  });

  it("an extra bar outside the concrete/cover envelope FAILs and blocks export", () => {
    const r = solveElement(column({ extra: [extra({ u: 200, v: 0 })] })); // u=200 > b/2=150
    const item = rule(r, "addressable_section_bounds");
    expect(item?.status).toBe("FAIL");
    expect(item?.tier).toBe(1);
    expect(r.status).toBe("FAIL"); // export-lock gate
  });

  it("a bar carried past the member end (axial extent) FAILs", () => {
    const r = solveElement(column({ extra: [extra({ axisStart: 500, L: H })] })); // 500+3000 > 3000
    expect(rule(r, "addressable_axial_extent")?.status).toBe("FAIL");
    expect(r.status).toBe("FAIL");
  });

  it("a bar starting before the member (negative axisStart) FAILs axial extent", () => {
    const r = solveElement(column({ extra: [extra({ axisStart: -100 })] }));
    expect(rule(r, "addressable_axial_extent")?.status).toBe("FAIL");
  });

  it("two extras merely tighter than the minimum WARN (not FAIL)", () => {
    // sMin = max(Ø16, dg20+5, 20) = 25 mm; clear = dist − Ø = 41.6 − 16 = 25.6 mm ∈ [25, 26.25) → WARN
    const r = solveElement(column({ extra: [extra({ id: "X1", u: 0, v: 0 }), extra({ id: "X2", u: 0, v: 41.6 })] }));
    const item = rule(r, "addressable_clear_spacing");
    expect(item?.status).toBe("WARN");
    expect(item?.tier).toBe(2);
  });

  it("two extras below the minimum clear spacing FAIL", () => {
    const r = solveElement(column({ extra: [extra({ id: "X1", u: 0, v: 0 }), extra({ id: "X2", u: 0, v: 25 })] }));
    // clear = 25 − 16 = 9 mm < 25 mm min → FAIL
    expect(rule(r, "addressable_clear_spacing")?.status).toBe("FAIL");
    expect(r.status).toBe("FAIL");
  });

  it("legacy no-op: a doc with no addressable bars emits NO addressable rule", () => {
    const r = solveElement(column());
    expect(r.longBars).toBeUndefined();
    expect(addressableRules(r)).toHaveLength(0);
  });

  it("legacy-safe: a benign Ø-only override on a spacious grid never FAILs/WARNs", () => {
    // A2 fold: a Ø override is now spacing- AND section-bounds-checked (its enlarged Ø can crowd a
    // neighbour or eat the cover), but the modest Ø25 on the wide reference column stays within both
    // → the only addressable items are PASSes.
    const r = solveElement(column({ overrides: [{ barIndex: 0, diameter: 25 }] }));
    expect(r.longBars).toBeDefined(); // per-bar channel active
    expect(addressableRules(r).every((v) => v.status === "PASS")).toBe(true);
    expect(rule(r, "addressable_section_bounds")?.status).toBe("PASS"); // override IS bounds-checked now
  });

  it("Finding-2 fix: an OVERSIZED Ø override that eats the cover FAILs section_bounds + blocks export", () => {
    // barIndex 0 is the top corner at (−102, 252) (group Ø20, cover 30). Override to Ø40 → the bar
    // surface passes the cover line (envU = 150−30−20 = 100 < |−102|) → 🔴, previously unflagged
    // (the grouped `cover` check reads the group Ø, and section_bounds only saw standalone extras).
    const r = solveElement(column({ overrides: [{ barIndex: 0, diameter: 40 }] }));
    const item = rule(r, "addressable_section_bounds");
    expect(item?.status).toBe("FAIL");
    expect(item?.tier).toBe(1);
    expect(r.status).toBe("FAIL"); // export-lock gate
  });
});

describe("A2 completeness — min_bars / face_min over the real placed set (Finding-1 fix)", () => {
  it("removing bars below the column minimum FAILs min_bars (was: PASS on the nominal layout)", () => {
    // the reference column has 6 bars; remove 3 → 3 real bars < 4. Before the fix min_bars reported
    // the layout count (6, PASS) → an un-buildable 3-bar column exported green.
    const overrides = [0, 1, 2].map((barIndex) => ({ barIndex, removed: true }));
    const r = solveElement(column({ overrides }));
    const mb = rule(r, "min_bars");
    expect(mb?.value).toBe(3); // real placed count, not the layout's 6
    expect(mb?.status).toBe("FAIL");
    expect(r.status).toBe("FAIL"); // export blocked
  });

  it("removing a corner bar drops its face below 2 → face_min_bars FAILs (min_bars still ≥4)", () => {
    // barIndex 2 = top-right corner; removing it leaves the RIGHT face with 1 bar. Total stays 5 (≥4),
    // so this is isolated to the per-face check.
    const r = solveElement(column({ overrides: [{ barIndex: 2, removed: true }] }));
    expect(rule(r, "min_bars")?.value).toBe(5);
    const fm = rule(r, "face_min_bars");
    expect(fm?.status).toBe("FAIL");
    expect(String(fm?.value)).toContain("RIGHT");
  });

  it("legacy no-op: a grouped column's min_bars / face_min are byte-identical (layout counts)", () => {
    const r = solveElement(column());
    expect(r.longBars).toBeUndefined();
    expect(rule(r, "min_bars")?.value).toBe(6); // nominal layout count
    expect(rule(r, "face_min_bars")).toBeUndefined(); // symmetric layout → not flagged
  });
});
