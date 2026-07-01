/**
 * F3 ([REF-UI-820]) — the pure `perZoneReadout` selector. One display row per flexural zone
 * (As,prov vs As,req + ok + d), generic over the element. Headless: no React, no WebGL.
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "../engine/solveDoc";
import { defaultColumnDoc, defaultBeamDoc, defaultGenericDoc } from "../engine/document";
import { perZoneReadout } from "./derived";

describe("perZoneReadout (F3 per-zone readout)", () => {
  it("column → one longitudinal row with the right As,prov/As,req/ok/d (mm² totals)", () => {
    const doc = defaultColumnDoc(); // 6Ø20, As,req 1800
    const rows = perZoneReadout(solveDoc(doc), doc, "fr");

    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.zone).toBe("As_total");
    expect(r.label).toBe("Longitudinal");
    expect(r.asProvMm2).toBeCloseTo(1884.96, 1); // 6 × π·10²
    expect(r.asReqMm2).toBeCloseTo(1800, 6);
    expect(r.ok).toBe(true); // 1885 ≥ 1800
    expect(r.d).not.toBeNull();
    expect(r.d!).toBeGreaterThan(0);
    expect(r.perMetre).toBe(false);
  });

  it("column readout flips to FAIL when As,req exceeds As,prov", () => {
    const doc = defaultColumnDoc();
    doc.longitudinal.asReq = 5000; // far above 6Ø20
    const r = perZoneReadout(solveDoc(doc), doc, "fr")[0]!;
    expect(r.ok).toBe(false);
  });

  it("beam → a row per built zone (span + chapeaux), each with its own As + d", () => {
    const doc = defaultBeamDoc(); // span 3Ø20, chapeaux 2Ø16 enabled, montage off
    const rows = perZoneReadout(solveDoc(doc), doc, "en");
    const zones = rows.map((x) => x.zone);

    expect(zones).toContain("As_span_bottom");
    expect(zones).toContain("As_top_support_left"); // G3: two supports V1/V2
    expect(zones).toContain("As_top_support_right");
    expect(zones).not.toContain("As_top_montage"); // montage off

    const span = rows.find((x) => x.zone === "As_span_bottom")!;
    expect(span.label).toBe("Span (bottom)");
    expect(span.asProvMm2).toBeCloseTo(942.48, 1); // 3 × π·10²
    expect(span.perMetre).toBe(false);
    expect(span.d!).toBeGreaterThan(0);
  });

  it("one-way slab → per-metre zones (mm²/m), flagged perMetre", () => {
    const doc = defaultGenericDoc("E-SLB-01");
    const rows = perZoneReadout(solveDoc(doc), doc, "fr");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.perMetre)).toBe(true);
    // generic zones carry their own labels (from the doc, not the chrome bundle)
    const main = rows[0]!;
    expect(main.label).toBe(doc.zones.find((z) => z.zone === main.zone)!.label_fr);
    expect(main.asReqMm2).toBeGreaterThan(0);
    expect(main.d!).toBeGreaterThan(0);
  });
});
