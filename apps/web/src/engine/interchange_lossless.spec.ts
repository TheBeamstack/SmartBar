/**
 * v1.0.5 M7 (Track E, spec Part VI) — the `.rcfg` canonical arrays are LOSSLESS for interchange, not
 * just this app. Before M7 the per-bar detail (bundles/rows/layers/curtailed bars) lived only in the
 * private `meta.app_document` blob and `seismic` was hardcoded null (D-P5-7 / D-P4b-5). Now:
 *   • every freely placed bar is emitted as a canonical `PLACED_BAR` element with its as-built geometry;
 *   • the live seismic regime + code pack are written into the canonical fields;
 * so a future server / IFC / another tool reads the real bars from the canonical arrays ALONE — proven
 * here by STRIPPING `meta.app_document` and asserting nothing is lost. Also proves the double-solve is
 * gone (a passed-in live `result` is used verbatim, no re-solve).
 */
import { describe, it, expect } from "vitest";
import { serializeRcfg, parseRcfg } from "@rebarconfig/exporters";
import type { ElementId } from "./document";
import { defaultDocFor, defaultColumnDoc, type ColumnDoc, type GenericDoc } from "./document";
import { solveDoc } from "./solveDoc";
import { docToRcfg, APP_DOCUMENT_KEY } from "./rcfgDoc";

const ALL_ELEMENTS: ElementId[] = [
  "E-COL-01", "E-BEM-01", "E-COL-02", "E-FND-01", "E-SLB-01", "E-SLB-02", "E-SLB-03", "E-STR-01",
];

/** A doc for `element` with one freely placed Ø20 bar (the M7 canonical `PLACED_BAR` under test). */
function docWithPlaced(element: ElementId): GenericDoc {
  const base = defaultDocFor(element) as GenericDoc;
  return { ...base, placed: [{ id: "FREE1", u: 0, v: -100, shapeId: "DROITE", diameter: 20 }] };
}

/** Round-trip a project through JSON and DELETE the app_document carry (canonical-arrays-only reader). */
function throughCanonicalArraysOnly(doc: ReturnType<typeof defaultDocFor>) {
  const project = parseRcfg(serializeRcfg(docToRcfg(doc, [])));
  const meta = project.meta as Record<string, unknown>;
  delete meta[APP_DOCUMENT_KEY];
  return project;
}

describe("M7 — lossless canonical interchange (app_document stripped)", () => {
  for (const element of ALL_ELEMENTS) {
    it(`${element}: a freely placed bar survives in the canonical PLACED_BAR arrays`, () => {
      const project = throughCanonicalArraysOnly(docWithPlaced(element));
      const placed = project.reinforcement.placedBars ?? [];
      const free = placed.find((p) => (p as { id: string }).id.startsWith("FREE1")) as Record<string, unknown> | undefined;
      expect(free).toBeDefined();
      expect(free!["kind"]).toBe("PLACED_BAR");
      expect(free!["shapeArchetypeId"]).toBe("DROITE");
      expect(free!["diameter"]).toBe(20);
      expect(typeof free!["cutLength"]).toBe("number");
      expect((free!["cutLength"] as number) > 0).toBe(true);
      expect(free!["position"]).toBeDefined();
      // the guided steel is still described group-based (transverse + scheme summary)
      expect(project.reinforcement.baseGroups.length).toBeGreaterThan(0);
    });
  }

  it("per-bar curtailment (start/end stations) survives the canonical arrays", () => {
    const beam = defaultDocFor("E-BEM-01") as GenericDoc;
    const doc = {
      ...beam,
      placed: [{ id: "CUT1", u: 0, v: -260, shapeId: "DROITE", diameter: 20, startStation: 1000, endStation: 5000 }],
    } as GenericDoc;
    const project = throughCanonicalArraysOnly(doc);
    const cut = (project.reinforcement.placedBars ?? []).find(
      (p) => (p as { id: string }).id.startsWith("CUT1"),
    ) as Record<string, unknown>;
    expect(cut["startStation"]).toBe(1000);
    expect(cut["endStation"]).toBe(5000);
    // curtailed → the fabricated cut length is shorter than the full 6 m member
    expect((cut["cutLength"] as number) < 6000).toBe(true);
  });

  it("the live seismic regime is written into the canonical arrays (was hardcoded null)", () => {
    const col = defaultColumnDoc();
    const doc: ColumnDoc = { ...col, seismic: { code: "RPS-2011", zone: 3, ductility: "ND2" } };
    const project = throughCanonicalArraysOnly(doc);
    expect(project.seismic).toEqual({ code: "RPS-2011", zone: 3, ductility: "ND2" });
  });

  it("no seismic regime → canonical seismic is null (gravity)", () => {
    expect(throughCanonicalArraysOnly(defaultColumnDoc()).seismic).toBeNull();
  });

  it("the code pack follows the doc's picker (BAEL default / EC2)", () => {
    expect(docToRcfg(defaultColumnDoc(), []).codePack).toBe("BAEL-FR");
    const ec2: ColumnDoc = { ...defaultColumnDoc(), codePack: "EC2" };
    expect(docToRcfg(ec2, []).codePack).toBe("EC2");
  });

  it("stops the double-solve — a passed-in live result is used verbatim (no re-solve)", () => {
    const empty = defaultColumnDoc(); // no placed bars
    const withBar = docWithPlaced("E-COL-01"); // a placed bar
    // Pass the OTHER doc's solved result: the canonical arrays must reflect the PASSED result, proving
    // docToRcfg does not re-solve `empty`.
    const project = docToRcfg(empty, [], {}, solveDoc(withBar));
    const ids = (project.reinforcement.placedBars ?? []).map((p) => (p as { id: string }).id);
    expect(ids.some((id) => id.startsWith("FREE1"))).toBe(true);
    // and with no passed result, the empty doc yields no placed bars (it solves itself)
    expect(docToRcfg(empty, []).reinforcement.placedBars ?? []).toHaveLength(0);
  });
});
