/**
 * Elevation *fiche* + namespaced BBS marks (spec §9.2 [REF-SYS-925], §9.1 [REF-SYS-915];
 * v1.0.1 Feature C / D-P7-2). The exported elevation is now an annotated shop drawing:
 * element-aware ORIENTATION (column upright / beam horizontal / slab flat), bar MARKS + counts,
 * a tie-SPACING callout, and DIMENSIONS — all a pure annotation layer over the existing
 * `placeBars` projection (no engine change). Marks namespace per type for a project.
 */
import { describe, it, expect } from "vitest";
import { buildElevationFiche, memberAttitude, computeBBS } from "@rebarconfig/exporters";
import { solveColumn, type SolveResult } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";
import { referenceBeam } from "./bbs-helpers";

const code = makeBaelPack();

function referenceColumn(): SolveResult {
  return solveColumn({
    element: "E-COL-01",
    geometry: { b: 300, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    dg: 20,
    longitudinal: {
      groupId: "L1",
      shape: loadShape("droite"),
      diameter: 20,
      layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
      asReq: 1800,
    },
    tie: { groupId: "T1", shape: loadShape("cadre_rect"), diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    code,
  });
}

describe("memberAttitude map (§9.2 / §1.4 — shared with the ViewCube up-axis)", () => {
  it("columns + piles stand upright, beams/stairs are horizontal, slabs are flat", () => {
    expect(memberAttitude("E-COL-01")).toBe("VERTICAL");
    expect(memberAttitude("E-COL-02")).toBe("VERTICAL");
    expect(memberAttitude("E-FND-01")).toBe("VERTICAL");
    expect(memberAttitude("E-BEM-01")).toBe("HORIZONTAL");
    expect(memberAttitude("E-STR-01")).toBe("HORIZONTAL");
    expect(memberAttitude("E-SLB-01")).toBe("FLAT");
    expect(memberAttitude("E-SLB-03")).toBe("FLAT");
    expect(memberAttitude("E-XXX-99")).toBe("HORIZONTAL"); // unknown family → default
  });
});

describe("elevation fiche annotations (§9.2 [REF-SYS-925])", () => {
  const beam = buildElevationFiche(referenceBeam());

  it("is horizontal for a beam and carries the overall-length + section-depth dims", () => {
    expect(beam.attitude).toBe("HORIZONTAL");
    const labels = beam.dims.map((d) => d.label);
    expect(labels).toContain("6000"); // overall length L
    expect(labels).toContain("600"); // section depth h
  });

  it("annotates each longitudinal group with `n Ø d` and each tie set with `Ø d e=s`", () => {
    expect(beam.marks.length).toBeGreaterThan(0);
    expect(beam.marks.some((m) => /^\d+ Ø\d+$/.test(m.text))).toBe(true);
    expect(beam.tieCallouts.some((c) => c.text === "Ø8 e=200")).toBe(true);
  });

  it("a column stands UPRIGHT (drawing taller than wide); a beam lies horizontal (wider than tall)", () => {
    const col = buildElevationFiche(referenceColumn());
    expect(col.attitude).toBe("VERTICAL");
    const ext = (f: typeof beam) => ({ w: f.bbox.maxX - f.bbox.minX, h: f.bbox.maxY - f.bbox.minY });
    const c = ext(col);
    const b = ext(beam);
    expect(c.h).toBeGreaterThan(c.w); // column member axis is vertical
    expect(b.w).toBeGreaterThan(b.h); // beam member axis is horizontal
  });
});

describe("namespaced BBS marks (§9.1 [REF-SYS-915] / Feature C.2)", () => {
  it("prefixes + zero-pads per type, leaving the unprefixed schedule byte-identical", () => {
    const plain = computeBBS(referenceBeam());
    const ns = computeBBS(referenceBeam(), { markPrefix: "P1" });
    expect(plain.lines[0]!.mark).toBe("1"); // legacy: bare ordinal
    expect(ns.lines[0]!.mark).toBe("P1-01"); // project: namespaced
    expect(ns.lines.map((l) => l.mark)).toEqual(
      plain.lines.map((_, i) => `P1-${String(i + 1).padStart(2, "0")}`),
    );
  });
});
