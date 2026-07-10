/**
 * v1.0.5 P2 ([REF-SYS-260], Part I) — per-bar curtailment replaces the inert `continuedToSupport`
 * fraction (fixes D3). A bar carries an explicit start/end station: its rendered + scheduled run is
 * clipped to `[startStation, endStation]` (cut length follows). The §7.7 end-support anchorage now
 * counts the bars that ACTUALLY run through to the supports (real geometry), and a legacy
 * `continuedToSupport = f` migrates to the equivalent per-bar set.
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "../apps/web/src/engine/solveDoc";
import { migrateDoc } from "../apps/web/src/engine/crossTies";
import { defaultBeamDoc, type BeamDoc, type ElementDoc } from "../apps/web/src/engine/document";
import { computeBBS } from "@rebarconfig/exporters";

const endSupport = (r: ReturnType<typeof solveDoc>) =>
  r.validation.find((v) => v.rule === "end_support_anchorage")!;
const spanIndices = (r: ReturnType<typeof solveDoc>): number[] =>
  (r.longBars ?? []).filter((b) => b.groupId === "B1").map((b) => b.barIndex);

describe("P2 — a curtailed bar is shorter in placement + BBS", () => {
  it("clips the span bar's run to [start,end]; cut length follows and the BBS schedules the short bar", () => {
    const plain = solveDoc(defaultBeamDoc());
    const spanBar = plain.longBars!.find((b) => b.groupId === "B1")!;
    const fullCut = spanBar.shape.cutLength;

    const base = defaultBeamDoc();
    const doc: BeamDoc = {
      ...base,
      span: { ...base.span, barOverrides: [{ index: spanBar.barIndex, startStation: 1000, endStation: 5000 }] },
    };
    const r = solveDoc(doc);
    const curtailed = r.longBars!.find((b) => b.barIndex === spanBar.barIndex)!;
    expect(curtailed.shape.cutLength).toBeLessThan(fullCut);
    expect(curtailed.shape.cutLength).toBeCloseTo(4000, 0); // 5000 − 1000
    expect(curtailed.axisStart).toBe(1000);
    expect(curtailed.startStation).toBe(1000);
    expect(curtailed.endStation).toBe(5000);
    // the shorter cut appears on the schedule
    const bbs = computeBBS(r);
    expect(bbs.lines.some((l) => Math.round(l.cutLength_mm) === 4000)).toBe(true);
  });
});

describe("P2 — runs-through drives end_support_anchorage from real geometry", () => {
  it("full-length span → all bars run through → PASS", () => {
    expect(endSupport(solveDoc(defaultBeamDoc())).status).toBe("PASS");
  });

  it("every span bar curtailed short of the supports → none run through → WARN", () => {
    const plain = solveDoc(defaultBeamDoc());
    const base = defaultBeamDoc();
    const doc: BeamDoc = {
      ...base,
      span: {
        ...base.span,
        barOverrides: spanIndices(plain).map((i) => ({ index: i, startStation: 600, endStation: 5400 })),
      },
    };
    const es = endSupport(solveDoc(doc));
    expect(es.status).toBe("WARN");
    expect(es.message_en).toMatch(/carry bars past support|<\s*0\.25/i);
  });
});

describe("P2 — legacy continuedToSupport migrates to per-bar curtailment", () => {
  it("f=0.1 → 0 innermost bars run through → all span bars curtail; fraction dropped; idempotent", () => {
    const base = defaultBeamDoc();
    const legacy = {
      ...base,
      span: { ...base.span, continuedToSupport: 0.1 },
    } as unknown as ElementDoc;

    const migrated = migrateDoc(legacy) as BeamDoc;
    expect((migrated.span as unknown as { continuedToSupport?: number }).continuedToSupport).toBeUndefined();
    const overrides = migrated.span.barOverrides ?? [];
    expect(overrides.length).toBe(base.span.nBottom); // round(0.1·3)=0 through → all 3 curtail
    expect(overrides.every((o) => o.startStation !== undefined && o.endStation !== undefined)).toBe(true);
    // idempotent — a second pass is a no-op
    expect(migrateDoc(migrated)).toEqual(migrated);
    // and it solves to a WARN end-support anchorage (no bar runs through)
    expect(endSupport(solveDoc(migrated)).status).toBe("WARN");
  });

  it("f=1 → all bars run through → no curtailment overrides, just the dropped fraction (PASS)", () => {
    const base = defaultBeamDoc();
    const legacy = { ...base, span: { ...base.span, continuedToSupport: 1 } } as unknown as ElementDoc;
    const migrated = migrateDoc(legacy) as BeamDoc;
    expect(migrated.span.barOverrides ?? []).toEqual([]);
    expect(endSupport(solveDoc(migrated)).status).toBe("PASS");
  });
});
