/**
 * v1.0.4 E2 ([REF-SYS], spec §E2) — migration + forward-compat hardening.
 *   • every prior `.rcfg` fixture loads (parse migrates it up to the current version) and re-serialises
 *     byte-identical + idempotently (parse∘serialize∘parse is a fixed point);
 *   • the `migrateRcfg` version step is additive (no field dropped) and idempotent;
 *   • an unknown kind / top-level field still survives (the §10 forward-compat contract).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { serializeRcfg, parseRcfg, migrateRcfg, CURRENT_RCFG_VERSION, type RcfgProject } from "@rebarconfig/exporters";
import { FIXTURES_DIR } from "./helpers";

const validDir = path.join(FIXTURES_DIR, "valid");
const fixtures = fs.readdirSync(validDir).filter((f) => f.endsWith(".rcfg.json"));

describe("E2 — migration chain + forward-compat corpus", () => {
  it("has at least one .rcfg fixture", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const name of fixtures) {
    describe(name, () => {
      const raw = fs.readFileSync(path.join(validDir, name), "utf8");

      it("loads + migrates to the current version", () => {
        expect(parseRcfg(raw).rcfg_version).toBe(CURRENT_RCFG_VERSION);
      });

      it("parse → serialize → parse is a fixed point (idempotent)", () => {
        const a = parseRcfg(raw);
        const b = parseRcfg(serializeRcfg(a));
        expect(b).toEqual(a);
      });

      it("re-migrating an already-current project changes nothing (idempotent migrator)", () => {
        const a = parseRcfg(raw);
        expect(migrateRcfg(a)).toEqual(a);
      });
    });
  }

  it("a genuinely FUTURE version is loaded as-is, never dropped (forward-compat)", () => {
    const base = parseRcfg(fs.readFileSync(path.join(validDir, "column.rcfg.json"), "utf8"));
    const future: RcfgProject = { ...base, rcfg_version: "9.9.9", futureOnly: 123 };
    const out = migrateRcfg(future);
    expect(out.rcfg_version).toBe("9.9.9"); // unknown newer version untouched
    expect(out["futureOnly"]).toBe(123);
  });

  it("the version step preserves unknown kinds + top-level fields", () => {
    const base = parseRcfg(fs.readFileSync(path.join(validDir, "tendon-forward-compat.rcfg.json"), "utf8"));
    const tagged: RcfgProject = { ...base, rcfg_version: "1.0", vendorX: { keep: true } };
    const migrated = migrateRcfg(tagged);
    expect(migrated.rcfg_version).toBe(CURRENT_RCFG_VERSION);
    expect(migrated["vendorX"]).toEqual({ keep: true });
    expect(migrated.reinforcement.baseGroups[0]!.kind).toBe("TENDON"); // unknown kind survived
  });

  // v1.0.5 M7 (Track E): forward-compat for our OWN new kind — a reader that predates PLACED_BAR must
  // round-trip a file containing it without dropping the kind or its per-bar detail (the D-P0-2 guarantee
  // now exercised by PLACED_BAR, not just a synthetic vendor kind).
  it("round-trips a PLACED_BAR file without dropping the new kind or its per-bar detail", () => {
    const raw = fs.readFileSync(path.join(validDir, "placed-bar-forward-compat.rcfg.json"), "utf8");
    const loaded = parseRcfg(raw); // migrates 1.0.2 → current
    expect(loaded.rcfg_version).toBe(CURRENT_RCFG_VERSION);
    const roundTripped = parseRcfg(serializeRcfg(loaded));
    const bar = roundTripped.reinforcement.placedBars![0] as Record<string, unknown>;
    expect(bar["kind"]).toBe("PLACED_BAR"); // our new kind survived
    expect(bar["shapeArchetypeId"]).toBe("DROITE");
    expect(bar["cutLength"]).toBe(4000);
    expect(bar["startStation"]).toBe(1000); // per-bar curtailment detail intact
    expect(bar["endStation"]).toBe(5000);
    expect(bar["anchorage"]).toEqual({ start: "hook", end: "straight" });
    expect(roundTripped.seismic).toEqual({ code: "RPS-2011", zone: 3, ductility: "ND2" });
  });
});
