/**
 * Shop-drawing annotation model (spec §7 [REF-SYS-930], v1.0.3 G7, plan P7). The `shopDrawing`
 * layer turns a solved element into the full reference-drawing annotation set — leader lines with
 * `mark · nØd · l=`, per-element sequential marks, coupe markers (A-A…), stirrup-zone notation
 * (`count × spacing` per region), and beam support labels V1/V2 — built once over the fiche + BBS +
 * sectionAt so the PDF and DXF agree. Pure + deterministic.
 */
import { describe, it, expect } from "vitest";
import { shopDrawing, computeBBS } from "@rebarconfig/exporters";
import {
  solveElement,
  transverseStations,
  type ElementSolveInput,
  type SolveResult,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { referenceBeam } from "./bbs-helpers";
import { loadShape } from "./p3-helpers";

/** A beam with TWO independent supports V1/V2 (asymmetric chapeaux) — the G3 two-support model. */
function twoSupportBeam(): SolveResult {
  const code = makeBaelPack();
  const b = 300, h = 600, cover = 30, phiT = 8;
  const wStir = b - 2 * cover - phiT;
  const hStir = h - 2 * cover - phiT;
  const input: ElementSolveInput = {
    element: "E-BEM-01",
    profile: "BAEL_BEAM",
    section: "RECT",
    geometry: { b, h, L: 6000 },
    material: { f_c28: 25, f_e: 500 },
    cover,
    exposure: "EXTERIOR",
    layout: { principle: "FREE", nTop: 2, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT,
    phiLInset: 20,
    longitudinal: [
      { zone: "As_span_bottom", groupId: "B1", shape: loadShape("droite"), params: { L: 6000 }, diameter: 20, faces: ["BOTTOM"], asReq: 900, tensionFace: "BOTTOM", continuedToSupport: 1 },
      { zone: "As_top_support_left", groupId: "C_left", shape: loadShape("chapeau"), params: { L: 1500 }, diameter: 16, faces: ["TOP"], asReq: 380, tensionFace: "TOP", providedCount: 2 },
      { zone: "As_top_support_right", groupId: "C_right", shape: loadShape("chapeau"), params: { L: 1550 }, diameter: 16, faces: ["TOP"], asReq: 380, tensionFace: "TOP", providedCount: 2 },
    ],
    transverse: [
      { zone: "Asw_shear", groupId: "S1", shape: loadShape("etrier"), params: { w: wStir, h: hStir }, diameter: phiT, spacing: 200, nLegs: 2, aswReqPerM: 300,
        regions: [ { from: 0, to: 1000, spacing: 100 }, { from: 1000, to: 5000, spacing: 200 }, { from: 5000, to: 6000, spacing: 100 } ] },
    ],
    code,
  };
  return solveElement(input);
}

describe("shop_drawing — leader lines + marks (§7.1/§7.2)", () => {
  const result = referenceBeam();
  const shop = shopDrawing(result);

  it("emits one leader per distinct longitudinal group, labelled `mark nØd l=cut`", () => {
    expect(shop.leaders.length).toBeGreaterThan(0);
    for (const led of shop.leaders) {
      expect(led.text).toMatch(/^\S+ \d+Ø\d+ l=\d+$/);
      expect(led.mark).not.toBe("");
    }
    // the 3Ø20 span bar (l=6000) has a leader
    const span = shop.leaders.find((l) => /3Ø20 l=6000$/.test(l.text));
    expect(span).toBeDefined();
  });

  it("uses the BBS ordinal marks as the per-element sequential repères", () => {
    const bbsMarks = new Set(computeBBS(result).lines.map((l) => l.mark));
    for (const m of shop.marks) expect(bbsMarks.has(m.mark)).toBe(true);
    // the sequential marks are the bare ordinals (no project prefix)
    expect(shop.marks.every((m) => /^\d+$/.test(m.mark))).toBe(true);
  });

  it("respects a project markPrefix (namespaced marks, separate from per-element repères)", () => {
    const shopP = shopDrawing(result, { markPrefix: "P1" });
    expect(shopP.leaders.every((l) => l.mark.startsWith("P1-"))).toBe(true);
  });

  it("gives distinct labels non-coincident anchors (basic anti-overlap)", () => {
    const tos = shop.leaders.map((l) => `${Math.round(l.to.x)},${Math.round(l.to.y)}`);
    expect(new Set(tos).size).toBe(shop.leaders.length);
  });
});

describe("shop_drawing — coupe markers (§7.3)", () => {
  it("emits the default coupe marker A-A with a cutting line on the elevation", () => {
    const shop = shopDrawing(referenceBeam());
    expect(shop.coupeMarkers.length).toBeGreaterThanOrEqual(1);
    const a = shop.coupeMarkers[0]!;
    expect(a.tag).toBe("A");
    expect(a.label).toBe("Coupe A-A");
    expect(a.from).not.toEqual(a.to);
  });
});

describe("shop_drawing — stirrup-zone notation (§7.4)", () => {
  it("labels a uniform stirrup set `count × spacing`", () => {
    const shop = shopDrawing(referenceBeam());
    const zones = shop.stirrupZones.filter((z) => z.groupId === "S1");
    expect(zones.length).toBe(1);
    const expected = transverseStations(6000, 200).length;
    expect(zones[0]!.count).toBe(expected);
    expect(zones[0]!.label).toBe(`${expected}×200`);
  });

  it("labels each spacing region `count × spacing` (G6 region stations)", () => {
    const shop = shopDrawing(twoSupportBeam());
    const zones = shop.stirrupZones.filter((z) => z.groupId === "S1");
    expect(zones.length).toBe(3); // dense end · loose middle · dense end
    expect(zones.map((z) => z.spacing)).toEqual([100, 200, 100]);
    for (const z of zones) expect(z.label).toBe(`${z.count}×${z.spacing}`);
    expect(zones.every((z) => z.count > 0)).toBe(true);
  });
});

describe("shop_drawing — support labels V1/V2 (§7.5, G3)", () => {
  it("derives V1/V2 labels from the two chapeau zones", () => {
    const shop = shopDrawing(twoSupportBeam());
    expect(shop.supportLabels.map((s) => s.tag)).toEqual(["V1", "V2"]);
    expect(shop.supportLabels[0]!.at).not.toEqual(shop.supportLabels[1]!.at); // opposite ends
  });

  it("annotates bearing width + bottom-bar anchorage when supplied (G3 drawing data)", () => {
    const shop = shopDrawing(twoSupportBeam(), {
      supports: [ { side: "left", width: 300, anchorage: 400 }, { side: "right", width: 350, anchorage: 420 } ],
    });
    const v1 = shop.supportLabels.find((s) => s.tag === "V1")!;
    expect(v1.width).toBe(300);
    expect(v1.anchorage).toBe(400);
    expect(v1.label).toContain("b=300");
    expect(v1.label).toContain("l.a=400");
  });

  it("emits NO support labels for a non-two-support element (e.g. a legacy single-chapeau beam)", () => {
    const shop = shopDrawing(referenceBeam()); // single `As_top_support` zone
    expect(shop.supportLabels.length).toBe(0);
  });
});

describe("shop_drawing — determinism", () => {
  it("is byte-identical for the same input", () => {
    expect(JSON.stringify(shopDrawing(referenceBeam()))).toBe(JSON.stringify(shopDrawing(referenceBeam())));
  });
});
