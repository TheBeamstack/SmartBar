/**
 * P0.3 (v1.0.4_prep_plan) — CHARACTERIZATION of the façonnage adapter (solveDoc) on the CURRENT code,
 * BEFORE v1.0.4 rewrites it (H1/H2/H11/H13). These pin today's behaviour so every v1.0.4 "legacy no-op"
 * claim is provable and any unintended change surfaces as a diff.
 *
 * Cases tagged [WILL-CHANGE ...] encode a *known bug* whose expectation flips when the named H-item lands
 * (documented in v1.0.4_impl_plan). Cases tagged [MUST-HOLD] are the legacy byte-identical anchors.
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "./solveDoc";
import { defaultColumnDoc, defaultBeamDoc } from "./document";

const long = (r: ReturnType<typeof solveDoc>) => r.longBars;

describe("adapter characterization — grouped fast path (legacy)", () => {
  it("[MUST-HOLD] a legacy DROITE column emits NO longBars[] (grouped fast path)", () => {
    const r = solveDoc(defaultColumnDoc());
    expect(long(r)).toBeUndefined();
    expect(r.status).toBeDefined();
  });

  it("[MUST-HOLD] a legacy beam emits NO longBars[]", () => {
    const r = solveDoc(defaultBeamDoc());
    expect(long(r)).toBeUndefined();
  });
});

describe("adapter characterization — addressable channel activates on overrides/extras", () => {
  it("[MUST-HOLD] a DROITE column + Ø-only override enumerates all bars per-bar; bar 0 gets the new Ø", () => {
    const doc = defaultColumnDoc();
    doc.longitudinal.barOverrides = [{ index: 0, diameter: 25 }];
    const bars = long(solveDoc(doc))!;
    expect(bars).toBeDefined();
    // corner-shared rect layout: 3 top + 3 bottom + 0 interior left/right (corners shared) = 6 bars.
    expect(bars.length).toBe(6);
    expect(bars.find((b) => b.barIndex === 0)!.diameter).toBe(25);
    expect(bars.find((b) => b.barIndex === 1)!.diameter).toBe(20); // untouched bar keeps group Ø
  });

  it("[MUST-HOLD] a `removed` override drops the bar from longBars render/schedule", () => {
    const doc = defaultColumnDoc();
    doc.longitudinal.barOverrides = [{ index: 0, removed: true }];
    const bars = long(solveDoc(doc))!;
    expect(bars.find((b) => b.barIndex === 0)!.removed).toBe(true);
  });

  it("[WILL-CHANGE H5] removing a bar does NOT change As,prov today (count-group drives §7)", () => {
    const base = solveDoc(defaultColumnDoc());
    const doc = defaultColumnDoc();
    doc.longitudinal.barOverrides = [{ index: 0, removed: true }];
    const withRemoval = solveDoc(doc);
    const areaOf = (r: ReturnType<typeof solveDoc>) =>
      r.validation.find((v) => v.rule === "provided_area")?.value;
    // As,prov unchanged despite one fewer rendered/scheduled bar — the H5 gap.
    expect(areaOf(withRemoval)).toEqual(areaOf(base));
  });

  it("[MUST-HOLD] an extra bar appears as a standalone longBar at its (u,v)", () => {
    const doc = defaultColumnDoc();
    doc.extraBars = [{ id: "X1", u: 50, v: -100, shapeId: "DROITE", diameter: 12, length: 3000 }];
    const bars = long(solveDoc(doc))!;
    const x = bars.find((b) => b.standalone)!;
    expect(x).toBeDefined();
    expect(x.diameter).toBe(12);
    expect(x.position).toMatchObject({ u: 50, v: -100 });
  });
});

describe("adapter characterization — H2 LANDED: length drives the principal leg on a bent shape", () => {
  it("[H2 LANDED] a `length` on a bent override sets the fabricated cutLength (was a silent no-op)", () => {
    const doc = defaultColumnDoc();
    doc.longitudinal.shapeId = "BAIONNETTE";
    doc.longitudinal.faconnage = { shapeParams: { lower: 2000, crank: 200, upper: 800, angle: 11 } };
    // override bar 1 with a length AND supply the group faconnage so it doesn't crash (H1 is separate)
    doc.longitudinal.barOverrides = [
      { index: 1, length: 1234, faconnage: { shapeParams: { lower: 2000, crank: 200, upper: 800, angle: 11 } } },
    ];
    const bars = long(solveDoc(doc))!;
    const b1 = bars.find((b) => b.barIndex === 1)!;
    // H2: the length now drives the `lower` principal leg so cutLength == 1234 (±0.01), not ≈ 3000.
    expect(Math.abs(b1.shape.cutLength - 1234)).toBeLessThan(0.01);
  });
});
