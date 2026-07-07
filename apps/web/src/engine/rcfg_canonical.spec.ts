/**
 * v1.0.4 E1 ([REF-SYS], spec §E1) — the SPA now populates the canonical §10 `reinforcement[]`
 * (was empty, D-P5-7). `docToRcfg` solves the element and maps its groups onto `ReinforcingElement[]`;
 * the arrays survive a serialize→parse round-trip; the file writes the current `.rcfg` version (1.2).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { serializeRcfg, parseRcfg, CURRENT_RCFG_VERSION } from "@rebarconfig/exporters";
import { isBarGroup } from "@rebarconfig/core";
import { docToRcfg } from "./rcfgDoc";
import { defaultColumnDoc, defaultBeamDoc } from "./document";
import { useStore } from "../store/useStore";

describe("E1 — canonical reinforcement[] population", () => {
  beforeEach(() => useStore.getState().reset());

  it("a column doc yields populated, well-formed base groups (not empty)", () => {
    const proj = docToRcfg(defaultColumnDoc(), []);
    const base = proj.reinforcement.baseGroups;
    expect(base.length).toBeGreaterThanOrEqual(2); // longitudinal + ties
    for (const g of base) {
      expect(g.kind).toBe("REBAR_GROUP");
      expect(isBarGroup(g)).toBe(true);
      if (isBarGroup(g)) {
        expect(g.shapeArchetypeId).toBeTruthy();
        expect(g.diameter).toBeGreaterThan(0);
        expect(g.distribution).toBeTruthy();
      }
    }
    // the longitudinal group is a FIXED_COUNT of the section's bars
    const long = base.find((g) => isBarGroup(g) && g.role === "PRIMARY_LONGITUDINAL");
    expect(long && isBarGroup(long) && long.distribution.mode).toBe("FIXED_COUNT");
    // the ties repeat ALONG_PATH
    const ties = base.find((g) => isBarGroup(g) && g.role === "TRANSVERSE");
    expect(ties && isBarGroup(ties) && ties.distribution.mode).toBe("SPACING_ALONG_PATH");
  });

  it("writes the current rcfg version and round-trips the canonical arrays deep-equal", () => {
    const proj = docToRcfg(defaultColumnDoc(), []);
    expect(proj.rcfg_version).toBe(CURRENT_RCFG_VERSION);
    const round = parseRcfg(serializeRcfg(proj));
    expect(round.reinforcement.baseGroups).toEqual(proj.reinforcement.baseGroups);
    expect(round.reinforcement.supplementalGroups).toEqual(proj.reinforcement.supplementalGroups);
  });

  it("a beam doc also populates base groups (element-agnostic)", () => {
    const proj = docToRcfg(defaultBeamDoc(), []);
    expect(proj.reinforcement.baseGroups.length).toBeGreaterThanOrEqual(2);
    expect(proj.reinforcement.baseGroups.every((g) => g.kind === "REBAR_GROUP")).toBe(true);
  });
});
