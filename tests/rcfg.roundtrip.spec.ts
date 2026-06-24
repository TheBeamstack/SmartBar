/**
 * P0 contract test — .rcfg round-trips losslessly, and a v1.0 reader PRESERVES unknown
 * ReinforcingElement.kind`s + unknown fields (spec §10 forward-compat, NORMATIVE).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isBarGroup, type RcfgDocument } from "@rebarconfig/core";
import { FIXTURES_DIR } from "./helpers";

function loadRcfg(name: string): RcfgDocument {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "valid", name), "utf8")) as RcfgDocument;
}

describe("rcfg round-trip", () => {
  it("column fixture parse → serialize → parse is deep-equal", () => {
    const doc = loadRcfg("column.rcfg.json");
    const round = JSON.parse(JSON.stringify(doc));
    expect(round).toEqual(doc);
  });

  it("preserves an unknown kind (TENDON) and unknown nested fields on round-trip", () => {
    const doc = loadRcfg("tendon-forward-compat.rcfg.json");
    const tendon = doc.reinforcement.baseGroups[0];
    expect(tendon).toBeDefined();
    expect(tendon!.kind).toBe("TENDON");
    // a v1.0 reader does not understand TENDON → must not treat it as a BarGroup …
    expect(isBarGroup(tendon!)).toBe(false);
    // … and must preserve its fields verbatim through a save/load cycle.
    const round = JSON.parse(JSON.stringify(doc));
    expect(round.reinforcement.baseGroups[0]).toEqual(tendon);
    expect((round.reinforcement.baseGroups[0] as any).futureField).toEqual({ nested: [1, 2, 3] });
  });

  it("identifies the v1.0 concrete kind via the type guard", () => {
    const doc = loadRcfg("column.rcfg.json");
    const groups = [...doc.reinforcement.baseGroups, ...doc.reinforcement.supplementalGroups];
    expect(groups.every(isBarGroup)).toBe(true);
    const bar = doc.reinforcement.baseGroups.find(isBarGroup)!;
    expect(bar.diameter).toBe(16);
    expect(bar.distribution.mode).toBe("FIXED_COUNT");
  });
});
