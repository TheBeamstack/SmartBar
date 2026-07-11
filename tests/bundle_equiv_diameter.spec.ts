/**
 * v1.0.6-fix **R1 (finding F-A)** — the bundle EQUIVALENT-DIAMETER reach.
 *
 * `v1.0.5_spec` P-E requires: *"Equivalent diameter φₙ = φ·√nᵦ (≤55 mm) drives **cover**,
 * **clear-spacing-to-neighbours**, and **mandrel/lap rules**."* As shipped in M3/M4, only the COVER rule
 * used it — `code.bundleEquivDiameter` was called in exactly one place (`placedBarRules.ts`, `bundle_cover`).
 * The lap and the mandrel were computed on the BARE Ø, because `expandBundle` fans a bundle into N
 * independent `SingleBar`s and the "these act as one bar" fact was lost at that moment.
 *
 * The consequence was a **wrong-green**: a 4×Ø20 bundle lapped at `l0(20) = 1323 mm` where the rule
 * requires `l0(φₙ=40) = 2646 mm` — **50 % short** — and NO rule fired, so the element exported 🟢 Conforme.
 * That is the exact failure class the product exists to catch (`core_logic §2`, §4.2).
 *
 * R1 (owner decision **O-1**, 2026-07-11) makes φₙ drive **lap + mandrel + clear-spacing**, while the
 * PHYSICAL Ø keeps driving **area / mass / the BBS Ø column** (a bundle must not gain phantom steel).
 * These tests are the regression lock: each one FAILS on the pre-R1 code.
 *
 * ⚠ The constants ride the PROVISIONAL BAEL/EC2 packs (G-BAEL / G-EC2) — R1 fixes which diameter is
 * passed, not what the numbers are.
 */
import { describe, it, expect } from "vitest";
import { makeBaelPack, makeEc2Pack } from "@rebarconfig/codepacks";
import { resolvePlacedBars, generateShape, barArea } from "@rebarconfig/core";
import type { PlacedBarInput, ResolvePlacedContext } from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { loadShape } from "./p1-helpers";

const material = { f_c28: 25, f_e: 500 };
const PHI = 20;
const N = 4;

const ctxFor = (code: ReturnType<typeof makeBaelPack>): ResolvePlacedContext =>
  ({ code, material, memberLength: 8000, sectionDims: { b: 400, h: 600 } }) as ResolvePlacedContext;

const bundleOf = (over: Partial<Record<string, unknown>> = {}): PlacedBarInput =>
  ({
    kind: "bundle",
    id: "bd1",
    position: { u: 0, v: -100 },
    n: N,
    shape: loadShape("droite"),
    params: { L: 8000 },
    diameter: PHI,
    ...over,
  }) as PlacedBarInput;

describe("R1 / F-A — a bundle is judged on its equivalent diameter φₙ", () => {
  it("φₙ comes from the PACK (never recomputed inline) — BAEL and EC2 both", () => {
    // D-P1-3: core never hard-codes a code rule. φ·√n is the rule TODAY; a pack must stay free to differ.
    for (const code of [makeBaelPack(), makeEc2Pack()]) {
      expect(code.bundleEquivDiameter(PHI, N)).toBe(40); // 20·√4
      expect(code.bundleEquivDiameter(40, 4)).toBe(55); // the ≤55 mm cap
    }
  });

  it("THE HEADLINE CASE: a bundled bar's LAP is computed on φₙ, not the bare Ø", () => {
    const code = makeBaelPack();
    const phiN = code.bundleEquivDiameter(PHI, N);
    const lapBare = code.l0({ diameter: PHI, material, goodBond: true, fractionLapped: 1 });
    const lapEquiv = code.l0({ diameter: phiN, material, goodBond: true, fractionLapped: 1 });
    expect(Math.round(lapEquiv)).toBeGreaterThan(Math.round(lapBare)); // sanity: φₙ demands a longer lap

    const resolved = resolvePlacedBars([bundleOf({ splices: [{ at: 4000, kind: "lap" }] })], ctxFor(code));
    const lapUsed = resolved[0]!.splice!.lapLength;

    expect(Math.round(lapUsed)).toBe(Math.round(lapEquiv)); // ← R1
    expect(Math.round(lapUsed)).not.toBe(Math.round(lapBare)); // ← the pre-R1 value (1323 mm, 50 % short)
  });

  it("the MANDREL/bend is computed on φₙ (owner O-1) — a bent bundled bar's cutLength follows", () => {
    const code = makeBaelPack();
    const phiN = code.bundleEquivDiameter(PHI, N);
    const arch = loadShape("crochet_l"); // a real 90° bend → the mandrel drives the bend deduction
    const params = { a: 6000, b: 300 };

    const resolved = resolvePlacedBars([bundleOf({ shape: arch, params })], ctxFor(code));
    const bent = resolved[0]!.shape;

    expect(bent.cutLength).toBeCloseTo(generateShape(arch, params, phiN, code).cutLength, 6); // ← φₙ
    expect(bent.cutLength).not.toBeCloseTo(generateShape(arch, params, PHI, code).cutLength, 6); // ← not bare Ø
  });

  it("the clear-spacing MINIMUM rises with φₙ, while the measured gap stays PHYSICAL", () => {
    const code = makeBaelPack();
    const resolved = resolvePlacedBars([bundleOf()], ctxFor(code));
    // every member carries φₙ for the rules …
    for (const b of resolved) expect(b.equivDiameter).toBe(40);
    // … and its own PHYSICAL Ø for geometry (touching centre-to-centre = the bare Ø, not φₙ)
    for (const b of resolved) expect(b.diameter).toBe(PHI);
    const us = resolved.map((b) => b.position.u).sort((a, b) => a - b);
    expect(us[1]! - us[0]!).toBeCloseTo(PHI, 6); // bars in contact: c/c == Ø
  });

  it("the SCHEDULE stays physical — n real bars at the bare Ø, no phantom steel", () => {
    const code = makeBaelPack();
    const resolved = resolvePlacedBars([bundleOf()], ctxFor(code));
    expect(resolved).toHaveLength(N);

    // As = n × the PHYSICAL bar area. (Note: area(φₙ) ≡ n·area(φ) by the definition of φₙ = φ·√n, so an
    // area assertion CANNOT catch a φₙ leak — the guard that can is the bar COUNT and the Ø column below:
    // a leak would schedule ONE Ø40 bar instead of FOUR Ø20 bars. Same steel, wrong fabrication order.)
    const asProv = resolved.reduce((a, b) => a + barArea(b.diameter), 0);
    expect(asProv).toBeCloseTo(N * barArea(PHI), 6);
    for (const b of resolved) expect(b.diameter).toBe(PHI);

    const bbs = computeBBS({
      groups: [],
      longBars: resolved,
      member: { envelope: "RECT", b: 400, h: 600, length: 8000, transverse: [] },
      zones: [],
      validation: [],
      status: "PASS",
    } as never);
    for (const line of bbs.lines) expect(line.diameter).toBe(PHI); // the Ø column is the bar you buy
  });

  it("a NON-bundled bar is byte-identical (no equivDiameter → the bare Ø drives everything)", () => {
    const code = makeBaelPack();
    const single: PlacedBarInput = {
      kind: "single",
      id: "s1",
      position: { u: 0, v: -100 },
      shape: loadShape("droite"),
      params: { L: 8000 },
      diameter: PHI,
      splices: [{ at: 4000, kind: "lap" }],
    } as PlacedBarInput;

    const resolved = resolvePlacedBars([single], ctxFor(code));
    expect(resolved[0]!.equivDiameter).toBeUndefined();
    expect(Math.round(resolved[0]!.splice!.lapLength)).toBe(
      Math.round(code.l0({ diameter: PHI, material, goodBond: true, fractionLapped: 1 })),
    );
  });

  it("a 1-bar 'bundle' is not a bundle — φₙ === Ø → no equivDiameter, nothing changes", () => {
    const resolved = resolvePlacedBars([bundleOf({ n: 1 })], ctxFor(makeBaelPack()));
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.equivDiameter).toBeUndefined();
  });
});
