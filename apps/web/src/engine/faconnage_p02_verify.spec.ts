/**
 * P0.2 (v1.0.4_prep_plan) — EMPIRICAL VERIFICATION of the two most severe façonnage defects, on the
 * CURRENT (pre-v1.0.4) code. These tests assert the *buggy* behaviour so it is confirmed, not assumed.
 * When v1.0.4 H1/H2 land, these expectations flip (documented in the impl plan). Temporary probe.
 */
import { describe, it, expect } from "vitest";
import { solveDoc, baelPack } from "./solveDoc";
import { defaultColumnDoc } from "./document";
import { generateBarShape } from "@rebarconfig/core";
import { loadShape } from "./manifests";

describe("P0.2 — H1: Ø-only override on a façonné group crashes the solve", () => {
  it("throws when a BAIONNETTE-façonné column has one bar's Ø overridden with no faconnage", () => {
    const doc = defaultColumnDoc();
    // make the whole longitudinal group a façonné BAIONNETTE (valid params for a 3 m column)
    doc.longitudinal.shapeId = "BAIONNETTE";
    doc.longitudinal.faconnage = { shapeParams: { lower: 2000, crank: 200, upper: 800, angle: 11 } };
    // sanity: the group alone solves fine
    expect(() => solveDoc(doc)).not.toThrow();
    // now override ONLY the diameter of bar 0 — no shapeId, no faconnage
    doc.longitudinal.barOverrides = [{ index: 0, diameter: 25 }];
    // EXPECTED (current bug): the adapter regenerates BAIONNETTE with {L:H} params → evalExpr throws
    expect(() => solveDoc(doc)).toThrow();
  });

  it("does NOT throw when the same override is on a DROITE group (the L-param case)", () => {
    const doc = defaultColumnDoc(); // DROITE by default
    doc.longitudinal.barOverrides = [{ index: 0, diameter: 25 }];
    expect(() => solveDoc(doc)).not.toThrow();
  });
});

describe("P0.2 — H2: a unique `length` is a silent no-op on a bent shape", () => {
  it("BAIONNETTE cutLength ignores an injected L param (only DROITE reads L)", () => {
    const shape = loadShape("BAIONNETTE");
    const params = { lower: 2000, crank: 200, upper: 800, angle: 11 };
    const base = generateBarShape(shape, params, 20, baelPack);
    const withL = generateBarShape(shape, { ...params, L: 9999 }, 20, baelPack);
    expect(withL.cutLength).toBeCloseTo(base.cutLength, 3); // L had no effect
    expect(withL.cutLength).not.toBeCloseTo(9999, 0); // and it is NOT the requested length
  });

  it("DROITE cutLength DOES track L (the only shape with an L param)", () => {
    const shape = loadShape("DROITE");
    const r = generateBarShape(shape, { L: 4321 }, 20, baelPack);
    expect(r.cutLength).toBeCloseTo(4321, 0);
  });
});
