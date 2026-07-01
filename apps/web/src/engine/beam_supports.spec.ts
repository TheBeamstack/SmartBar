/**
 * v1.0.3 G3 ([REF-SYS-260], spec §3) — the beam two-support model (V1/V2), first-class relevés and
 * auto-seeded editable stirrup regions. Exercises the web adapter (`solveDoc`) + the pure region
 * seed helper + the legacy migration (a v1.0.2 single-`chapeau` beam → symmetric supports).
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "./solveDoc";
import { migrateDoc } from "./crossTies";
import { supportSeededRegions } from "./regions";
import { defaultBeamDoc, type BeamDoc, type ElementDoc } from "./document";
import { placeBars, type SolveResult } from "@rebarconfig/core";
import { computeBBS } from "@rebarconfig/exporters";

const groupCut = (r: SolveResult, groupId: string): number =>
  r.groups.find((g) => g.groupId === groupId)?.shape.cutLength ?? NaN;

describe("G3 — beam two supports (V1/V2)", () => {
  it("asymmetric supports give the two chapeaux different curtailment lengths + each is validated", () => {
    const base = defaultBeamDoc();
    const doc: BeamDoc = {
      ...base,
      supports: {
        left: { ...base.supports.left, chapeau: { ...base.supports.left.chapeau, length: 1500 } },
        right: { ...base.supports.right, chapeau: { ...base.supports.right.chapeau, length: 1000 } },
      },
    };
    const r = solveDoc(doc);
    // two distinct chapeau zones, each with its own §7.7 extension (asymmetric = data)
    const cutL = groupCut(r, "C_left");
    const cutR = groupCut(r, "C_right");
    expect(cutL).toBeGreaterThan(0);
    expect(cutR).toBeGreaterThan(0);
    expect(cutL).toBeGreaterThan(cutR); // the longer support zone → the longer chapeau bar
    // both supports are validated independently
    const rules = r.validation.map((v) => v.rule);
    expect(rules).toContain("provided_area:As_top_support_left");
    expect(rules).toContain("provided_area:As_top_support_right");
  });

  it("both chapeaux are scheduled even when relevés push the beam onto the addressable-bar path", () => {
    const base = defaultBeamDoc();
    const doc: BeamDoc = { ...base, releves: [{ id: "R1", support: "left", count: 2, diameter: 12 }] };
    const r = solveDoc(doc);
    expect(r.longBars).toBeDefined(); // relevés ride the G2 channel
    // the two chapeaux still appear as their own scheduled bars (not collapsed / dropped)
    const chapeauBars = (r.longBars ?? []).filter((b) => b.groupId === "C_left" || b.groupId === "C_right");
    expect(chapeauBars.filter((b) => b.groupId === "C_left").length).toBe(2);
    expect(chapeauBars.filter((b) => b.groupId === "C_right").length).toBe(2);
  });

  it("a default beam (no relevés / overrides) stays on the grouped fast path (byte-identical)", () => {
    const r = solveDoc(defaultBeamDoc());
    expect(r.longBars).toBeUndefined();
  });
});

describe("G3 — relevés (bent-up bottom bars)", () => {
  const withReleve = (): BeamDoc => ({
    ...defaultBeamDoc(),
    releves: [{ id: "R1", support: "right", count: 3, diameter: 10 }],
  });

  it("a relevé renders as a bent RELEVE bar and is scheduled with its own cut length", () => {
    const r = solveDoc(withReleve());
    // an addressable RELEVE bar exists (3 of them)
    const releveBars = (r.longBars ?? []).filter((b) => b.shape.archetypeId === "RELEVE");
    expect(releveBars.length).toBe(3);

    // it is genuinely bent (the centreline leaves the bar axis — a lateral offset appears)
    const cl = releveBars[0]!.shape.centerline3D;
    let maxLateral = 0;
    for (let i = 1; i + 1 < cl.length; i += 3) maxLateral = Math.max(maxLateral, Math.abs(cl[i]!));
    expect(maxLateral).toBeGreaterThan(0);

    // it flows to the placed 3D geometry (a non-straight polyline)
    const placed = placeBars(r).filter((b) => b.groupId.startsWith("R1_"));
    expect(placed.length).toBe(3);
    expect(placed[0]!.points.length).toBeGreaterThan(6); // more than a 2-point straight line

    // and it is on the schedule as a RELEVE line
    const bbs = computeBBS(r);
    expect(bbs.lines.some((l) => l.shapeArchetypeId === "RELEVE")).toBe(true);
  });
});

describe("G3 — auto-seeded editable stirrup regions", () => {
  it("supportSeededRegions densifies each support end (asymmetric zones → asymmetric ends)", () => {
    const regions = supportSeededRegions(6000, 1000, 500, 200);
    expect(regions.length).toBe(3);
    expect(regions[0]).toEqual({ from: 0, to: 1000, spacing: 100 }); // dense left end
    expect(regions[1]).toEqual({ from: 1000, to: 5500, spacing: 200 }); // looser middle
    expect(regions[2]).toEqual({ from: 5500, to: 6000, spacing: 100 }); // dense right end
  });

  it("seeding regions from the supports adds cadres (denser than the uniform spacing)", () => {
    const base = defaultBeamDoc();
    const uniform = computeBBS(solveDoc(base)).lines
      .filter((l) => l.role === "TRANSVERSE")
      .reduce((n, l) => n + l.count, 0);
    const seeded: BeamDoc = {
      ...base,
      stirrup: {
        ...base.stirrup,
        regions: supportSeededRegions(base.geometry.L, base.supports.left.chapeau.length, base.supports.right.chapeau.length, base.stirrup.spacing),
      },
    };
    const dense = computeBBS(solveDoc(seeded)).lines
      .filter((l) => l.role === "TRANSVERSE")
      .reduce((n, l) => n + l.count, 0);
    expect(dense).toBeGreaterThan(uniform);
  });
});

describe("G3 — legacy migration (single chapeau → symmetric V1/V2)", () => {
  it("a v1.0.2 beam with `chapeau` migrates to symmetric supports + no relevé, losslessly", () => {
    const legacy = {
      element: "E-BEM-01",
      scheme: "BEAM_SPAN_CHAPEAUX_RELEVES",
      geometry: { b: 300, h: 600, L: 6000 },
      material: { f_c28: 25, f_e: 500 },
      cover: 30,
      exposure: "EXTERIOR",
      dg: 20,
      topBars: { enabled: false, groupId: "M1", diameter: 12, nTop: 2 },
      span: { groupId: "B1", shapeId: "DROITE", diameter: 20, nBottom: 3, asReq: 900, continuedToSupport: 1 },
      chapeau: { enabled: true, groupId: "C1", shapeId: "CHAPEAU", diameter: 16, nTop: 2, asReq: 380, supportZone: 1250 },
      stirrup: { groupId: "S1", shapeId: "ETRIER", diameter: 8, spacing: 200, aswReqPerM: 300, crossTies: [], crossTieHookAngle: 135 },
      supplements: [],
    } as unknown as ElementDoc;

    const migrated = migrateDoc(legacy) as BeamDoc;
    expect(migrated.supports.left.chapeau.length).toBe(1250);
    expect(migrated.supports.right.chapeau.length).toBe(1250); // symmetric
    expect(migrated.supports.left.chapeau.asReq).toBe(380);
    expect(migrated.chapeauShapeId).toBe("CHAPEAU");
    expect(migrated.releves).toEqual([]);
    expect((migrated as unknown as { chapeau?: unknown }).chapeau).toBeUndefined();
    // idempotent — a second pass is a no-op
    expect(migrateDoc(migrated)).toEqual(migrated);

    // and it solves cleanly through the new two-support path
    const r = solveDoc(migrated);
    expect(r.validation.map((v) => v.rule)).toContain("provided_area:As_top_support_left");
  });
});
