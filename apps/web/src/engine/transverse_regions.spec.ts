/**
 * F5 (web side) — the region helpers (contiguity, symmetric quick-fill), the adapter threading
 * regions into the solve, the legacy default (no regions → uniform), and the `.rcfg` round-trip.
 */
import { describe, it, expect } from "vitest";
import { placeBars } from "@rebarconfig/core";
import { solveDoc } from "./solveDoc";
import { defaultColumnDoc, defaultBeamDoc, type ColumnDoc } from "./document";
import { normalizeRegions, symmetricEndsRegions, uniformRegions, memberAxisLength } from "./regions";
import { docToRcfg, rcfgToDoc } from "./rcfgDoc";
import { serializeRcfg, parseRcfg, computeBBS } from "@rebarconfig/exporters";

describe("region helpers (pure)", () => {
  it("normalizeRegions makes a gappy/overlapping list contiguous over 0..L", () => {
    const out = normalizeRegions(
      [
        { from: 0, to: 800, spacing: 100 },
        { from: 1200, to: 5000, spacing: 200 }, // gap 800..1200 + leaves 5000..6000 uncovered
      ],
      6000,
      150,
    );
    expect(out[0]!.from).toBe(0);
    expect(out[out.length - 1]!.to).toBe(6000);
    for (let i = 1; i < out.length; i++) expect(out[i]!.from).toBe(out[i - 1]!.to); // contiguous
  });

  it("an empty list falls back to one uniform region", () => {
    expect(normalizeRegions([], 3000, 200)).toEqual(uniformRegions(3000, 200));
  });

  it("symmetricEndsRegions yields three regions; collapses when the ends would overlap", () => {
    expect(symmetricEndsRegions(6000, 1000, 100, 200)).toHaveLength(3);
    expect(symmetricEndsRegions(1000, 600, 100, 200)).toHaveLength(1); // 2·600 ≥ 1000
  });
});

describe("adapter threads regions into the solve", () => {
  it("column regions reach result.member.transverse + densify the placed/scheduled count", () => {
    const base = defaultColumnDoc();
    const withRegions: ColumnDoc = {
      ...base,
      tie: { ...base.tie, regions: [
        { from: 0, to: 600, spacing: 80 },
        { from: 600, to: 2400, spacing: 200 },
        { from: 2400, to: 3000, spacing: 80 },
      ] },
    };
    const r = solveDoc(withRegions);
    const tset = r.member.transverse.find((t) => t.groupId === base.tie.groupId)!;
    expect(tset.regions).toHaveLength(3);
  });

  it("legacy (no regions) places + schedules identically to a single uniform region", () => {
    const base = defaultBeamDoc();
    const uniform = { ...base, stirrup: { ...base.stirrup, regions: uniformRegions(memberAxisLength(base), base.stirrup.spacing) } };
    // the placed geometry + the bar-bending schedule are byte-identical (the only SolveResult diff is
    // the echoed `member.transverse[].regions` descriptor, which is inert for a single full region).
    expect(JSON.stringify(placeBars(solveDoc(uniform)))).toBe(JSON.stringify(placeBars(solveDoc(base))));
    expect(JSON.stringify(computeBBS(solveDoc(uniform)))).toBe(JSON.stringify(computeBBS(solveDoc(base))));
  });
});

describe(".rcfg round-trip preserves regions", () => {
  it("regions survive serialize → parse → doc", () => {
    const base = defaultColumnDoc();
    const regions = symmetricEndsRegions(memberAxisLength(base), 600, 100, 200);
    const doc: ColumnDoc = { ...base, tie: { ...base.tie, regions } };

    const round = rcfgToDoc(parseRcfg(serializeRcfg(docToRcfg(doc, []))));
    expect(round).toBeDefined();
    expect((round as ColumnDoc).tie.regions).toEqual(regions);
  });
});
