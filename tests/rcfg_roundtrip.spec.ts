/**
 * `.rcfg` save/load round-trip (spec §10, plan P5). Full project parse → serialize → parse is
 * deep-equal, and a v1.0 reader PRESERVES unknown `kind`s + unknown top-level fields (re-assert
 * the §10 forward-compat contract through the actual P5 I/O functions).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { serializeRcfg, parseRcfg, CURRENT_RCFG_VERSION, type RcfgProject } from "@rebarconfig/exporters";
import { isBarGroup } from "@rebarconfig/core";
import { FIXTURES_DIR } from "./helpers";

const load = (name: string): RcfgProject =>
  parseRcfg(fs.readFileSync(path.join(FIXTURES_DIR, "valid", name), "utf8"));

describe("rcfg_roundtrip (§10)", () => {
  it("parse → serialize → parse is deep-equal", () => {
    const a = load("column.rcfg.json");
    const b = parseRcfg(serializeRcfg(a));
    expect(b).toEqual(a);
  });

  it("preserves an unknown kind (TENDON) + unknown nested fields through the I/O", () => {
    const doc = load("tendon-forward-compat.rcfg.json");
    const tendon = doc.reinforcement.baseGroups[0]!;
    expect(tendon.kind).toBe("TENDON");
    expect(isBarGroup(tendon)).toBe(false);
    const round = parseRcfg(serializeRcfg(doc));
    expect(round.reinforcement.baseGroups[0]).toEqual(tendon);
    expect((round.reinforcement.baseGroups[0] as Record<string, unknown>)["futureField"]).toEqual({
      nested: [1, 2, 3],
    });
  });

  it("preserves an unknown TOP-LEVEL field on round-trip", () => {
    const doc = load("column.rcfg.json");
    const tagged: RcfgProject = { ...doc, vendorExtension: { future: true, n: 42 } };
    const round = parseRcfg(serializeRcfg(tagged));
    expect(round["vendorExtension"]).toEqual({ future: true, n: 42 });
  });

  it("rejects a non-object / version-less document", () => {
    expect(() => parseRcfg("[]")).toThrow();
    expect(() => parseRcfg(JSON.stringify({ region: "FR" }))).toThrow(/rcfg_version/);
  });

  it("the fixture is already at the current writer version", () => {
    expect(load("column.rcfg.json").rcfg_version).toBe(CURRENT_RCFG_VERSION);
  });
});
