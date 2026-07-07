/**
 * v1.0.4 H14 + B1 ([REF-SYS], §B1) — per-bar lap splices on the addressable channel:
 *   • H14 — an addressable bar auto-splits at the stock length; the BBS schedules its SEGMENTS.
 *   • B1  — a per-zone STAGGER check (sourced EC2 §8.7.2 rule: ≤ ½ of the zone's bars lapped within
 *           one 0.3·l0 section → PASS, else WARN). The cutLength invariant (D-P1-1) is preserved.
 */
import { describe, it, expect } from "vitest";
import { solveElement, evaluateLapStagger } from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";
import { column, droite } from "./g2-helpers";

const stagger = (r: ReturnType<typeof solveElement>) => r.validation.find((v) => v.rule.startsWith("lap_stagger"));

describe("B1 — evaluateLapStagger (sourced rule)", () => {
  it("coincident laps (>50% of the zone at one section) fail", () => {
    // 4 of 6 bars lap at station 1500 → 67% > 50% → not staggered.
    const r = evaluateLapStagger([[1500], [1500], [1500], [1500]], 800, 6);
    expect(r.pass).toBe(false);
    expect(r.worstFraction).toBeGreaterThan(0.5);
  });

  it("staggered laps (≤50% per 0.3·l0 section) pass", () => {
    const r = evaluateLapStagger([[1000], [1000], [2100], [2100]], 800, 6);
    expect(r.pass).toBe(true);
  });

  it("a lone spliced bar is trivially staggered", () => {
    expect(evaluateLapStagger([[1500]], 800, 6).pass).toBe(true);
  });
});

describe("H14/B1 — per-bar splices through the pipeline", () => {
  it("clustered per-bar laps ⇒ lap_stagger WARN", () => {
    const r = solveElement(
      column({
        overrides: [0, 1, 2, 3].map((barIndex) => ({ barIndex, splices: [{ at: 1500, kind: "lap" as const }] })),
      }),
    );
    const s = stagger(r);
    expect(s?.status).toBe("WARN");
  });

  it("staggered per-bar laps ⇒ lap_stagger PASS", () => {
    const r = solveElement(
      column({
        overrides: [
          { barIndex: 0, splices: [{ at: 1000, kind: "lap" }] },
          { barIndex: 1, splices: [{ at: 1000, kind: "lap" }] },
          { barIndex: 2, splices: [{ at: 2100, kind: "lap" }] },
          { barIndex: 3, splices: [{ at: 2100, kind: "lap" }] },
        ],
      }),
    );
    expect(stagger(r)?.status).toBe("PASS");
  });

  it("H14 auto-split: a >stock addressable bar schedules as segments (BBS)", () => {
    const r = solveElement(
      column({ extra: [{ id: "XB", position: { u: 0, v: -240 }, shape: droite, params: { L: 15000 }, diameter: 16, autoSplice: true }] }),
    );
    const segRows = computeBBS(r).lines.filter((l) => l.groupIds.some((g) => g.startsWith("XB#")));
    expect(segRows.length).toBe(2); // 15000 / 12000 → one interior lap → two segments
    // cutLength invariant (D-P1-1): Σ segment cuts = run + (#laps)·l_r > run.
    const total = segRows.reduce((s, l) => s + l.cutLength_mm * l.count, 0);
    expect(total).toBeGreaterThan(15000);
  });

  it("legacy no-op: an unspliced addressable doc emits no lap_stagger + no segment rows", () => {
    const r = solveElement(column({ overrides: [{ barIndex: 0, diameter: 25 }] }));
    expect(stagger(r)).toBeUndefined();
    expect(computeBBS(r).lines.every((l) => l.groupIds.every((g) => !g.includes("#")))).toBe(true);
  });
});
