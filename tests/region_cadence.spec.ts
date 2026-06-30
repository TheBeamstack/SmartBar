/**
 * G6 — per-zone stirrup cadence continuity (spec §6.1, [REF-SYS-757b]; plan P2). When a new spacing
 * region starts, its first cadre is placed ONE new-spacing step after the last placed cadre of the
 * previous region (the region `from` only marks where the new spacing takes over) — so there is no
 * illogical short stub at a boundary. A single full-length region stays byte-identical to uniform.
 */
import { describe, it, expect } from "vitest";
import {
  regionStations,
  regionStationCounts,
  transverseStations,
  type TransverseRegion,
} from "@rebarconfig/core";

const L = 6000;
const denseEnds: TransverseRegion[] = [
  { from: 0, to: 1000, spacing: 100 },
  { from: 1000, to: 5000, spacing: 200 },
  { from: 5000, to: 6000, spacing: 100 },
];

function gaps(ys: number[]): number[] {
  const g: number[] = [];
  for (let i = 1; i < ys.length; i++) g.push(ys[i]! - ys[i - 1]!);
  return g;
}

describe("cadence continuity across region boundaries", () => {
  const ys = regionStations(denseEnds, L);

  it("stations are strictly increasing", () => {
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
  });

  it("never leaves a short stub: no gap is smaller than the smallest region spacing", () => {
    const minSpacing = Math.min(...denseEnds.map((r) => r.spacing));
    for (const g of gaps(ys)) expect(g).toBeGreaterThanOrEqual(minSpacing - 1e-6);
  });

  it("the boundary step equals the NEW region's spacing (not a reset to `from`)", () => {
    // the first station of region 1 (200 mm) sits one 200-step past region 0's last 100-step station
    const lastR0 = Math.max(...ys.filter((y) => y < 1000));
    const firstR1 = Math.min(...ys.filter((y) => y >= 1000 && y < 5000));
    expect(firstR1 - lastR0).toBeCloseTo(200, 6);
    // and it is strictly past `from` — `from` itself is not forced as a station
    expect(firstR1).toBeGreaterThan(1000);
  });

  it("a single full-length region is byte-identical to uniform transverseStations", () => {
    expect(regionStations([{ from: 0, to: L, spacing: 200 }], L)).toEqual(transverseStations(L, 200));
  });

  it("per-region counts still partition the stations (one entry per region, summing to the total)", () => {
    const counts = regionStationCounts(denseEnds, L);
    expect(counts).toHaveLength(3);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(ys.length);
  });
});
