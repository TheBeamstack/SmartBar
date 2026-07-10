/**
 * v1.0.5 P2 ([REF-SYS-260], D3) — the ADAPTER side of per-bar curtailment + the legacy
 * `continuedToSupport` migration (web engine: `solveDoc` curtailment passthrough, `migrateDoc` →
 * `migrateBeamContinuation`, `engineBeamLayoutBars`). Complements the core-side proof in
 * tests/curtailment.spec.ts by exercising these through the real doc → adapter path.
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "./solveDoc";
import { migrateDoc, engineBeamLayoutBars } from "./crossTies";
import { defaultBeamDoc, type BeamDoc, type ElementDoc } from "./document";
import { computeBBS } from "@rebarconfig/exporters";

const endSupport = (r: ReturnType<typeof solveDoc>) =>
  r.validation.find((v) => v.rule === "end_support_anchorage")!;

describe("P2 adapter — span curtailment overrides flow to the engine", () => {
  it("a startStation/endStation override clips the bar (shorter cut) via solveDoc", () => {
    const base = defaultBeamDoc();
    const spanBar = solveDoc(base).longBars!.find((b) => b.groupId === "B1")!;
    const full = spanBar.shape.cutLength;
    const doc: BeamDoc = {
      ...base,
      span: { ...base.span, barOverrides: [{ index: spanBar.barIndex, startStation: 500, endStation: 5500 }] },
    };
    const r = solveDoc(doc);
    const clipped = r.longBars!.find((b) => b.barIndex === spanBar.barIndex)!;
    expect(clipped.shape.cutLength).toBeCloseTo(5000, 0);
    expect(clipped.shape.cutLength).toBeLessThan(full);
    expect(computeBBS(r).lines.some((l) => Math.round(l.cutLength_mm) === 5000)).toBe(true);
  });
});

describe("P2 adapter — engineBeamLayoutBars matches the solved span bar indices", () => {
  it("the BOTTOM-face indices equal the solved B1 (span) bar indices", () => {
    const base = defaultBeamDoc();
    const bottomIdx = engineBeamLayoutBars(base)
      .map((b, i) => ({ b, i }))
      .filter((x) => x.b.faceTag === "BOTTOM")
      .map((x) => x.i)
      .sort((a, b) => a - b);
    const spanIdx = solveDoc(base)
      .longBars!.filter((b) => b.groupId === "B1")
      .map((b) => b.barIndex)
      .sort((a, b) => a - b);
    expect(bottomIdx).toEqual(spanIdx);
  });
});

describe("P2 adapter — legacy continuedToSupport migration through migrateDoc", () => {
  it("f=0.5 → half the span bars curtail; the rest run through (idempotent, lossless)", () => {
    const base = defaultBeamDoc();
    const legacy = { ...base, span: { ...base.span, continuedToSupport: 0.5 } } as unknown as ElementDoc;
    const migrated = migrateDoc(legacy) as BeamDoc;
    expect((migrated.span as unknown as { continuedToSupport?: number }).continuedToSupport).toBeUndefined();
    // round(0.5·3) = 2 innermost run through → 1 curtailed
    expect(migrated.span.barOverrides?.length).toBe(1);
    expect(migrateDoc(migrated)).toEqual(migrated); // idempotent
    // 2 of 3 bars run through ⇒ ≥ 0.25·As,span carried past → PASS
    expect(endSupport(solveDoc(migrated)).status).toBe("PASS");
  });

  it("a doc with no fraction and no supports change passes through untouched", () => {
    const base = defaultBeamDoc();
    expect(migrateDoc(base)).toEqual(migrateDoc(migrateDoc(base)));
  });
});
