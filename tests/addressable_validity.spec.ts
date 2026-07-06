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
    // A2 fold: a Ø override is now spacing-checked (it can crowd its grid neighbour), but the wide
    // reference column stays comfortably above the minimum → the only addressable item is a PASS.
    const r = solveElement(column({ overrides: [{ barIndex: 0, diameter: 25 }] }));
    expect(r.longBars).toBeDefined(); // per-bar channel active
    expect(addressableRules(r).every((v) => v.status === "PASS")).toBe(true);
    expect(addressableRules(r).some((v) => v.rule === "addressable_section_bounds")).toBe(false); // no extras
  });
});
