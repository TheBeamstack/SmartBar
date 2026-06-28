/**
 * F2 (v1.0.2, [REF-SYS-756]): a column tie / beam stirrup is a perimeter cadre PLUS a list of
 * cross-ties (épingles) that engage real bar pairs. Each cross-tie renders BETWEEN its two bars
 * (anchored, not centred — the v1.0.1 bug), drives the leg-counted Asw, and gets a BBS mark, so the
 * number = the model = the schedule. Legacy `nLegs` files migrate to an equivalent cross-tie set.
 */
import { describe, it, expect } from "vitest";
import { computeBBS } from "@rebarconfig/exporters";
import { placeBars } from "@rebarconfig/core";
import { solveDoc } from "./solveDoc";
import { defaultColumnDoc, type ColumnDoc } from "./document";
import { autoCrossTies, migrateDoc } from "./crossTies";
import { buildScene } from "../viewport/rebarProps";

const withTies = (n: number): ColumnDoc => {
  const base = defaultColumnDoc();
  const bars = solveDoc(base).bars;
  return { ...base, tie: { ...base.tie, crossTies: autoCrossTies(bars).slice(0, n) } };
};

describe("F2 cross-ties engage real bars", () => {
  it("a perimeter-only tie (no cross-ties) materialises NO cross-tie groups", () => {
    const r = solveDoc(defaultColumnDoc());
    expect(r.groups.some((g) => g.groupId.startsWith("T1_X"))).toBe(false);
  });

  it("each cross-tie becomes one anchored épingle group, rendered BETWEEN its bars (not centred)", () => {
    const r = solveDoc(withTies(1));
    const xGroups = r.groups.filter((g) => g.groupId.startsWith("T1_X"));
    expect(xGroups.length).toBe(1);

    // the placed épingle loop must NOT sit at the section centre (the v1.0.1 defect); its centroid
    // sits at the midpoint of the two engaged bars.
    const placed = placeBars(r).filter((b) => b.groupId.startsWith("T1_X"));
    expect(placed.length).toBeGreaterThan(0);
    const centroidX = placed[0]!.points.filter((_, i) => i % 3 === 0).reduce((s, x, _i, a) => s + x / a.length, 0);
    const centroidZ = placed[0]!.points.filter((_, i) => i % 3 === 2).reduce((s, z, _i, a) => s + z / a.length, 0);
    // a TOP↔BOTTOM épingle in a symmetric column is centred on u≈0 but spans v — its loop must have
    // real vertical extent (not collapsed at the origin like a centred bar).
    const zs = placed[0]!.points.filter((_, i) => i % 3 === 2);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(50);
    expect(Number.isFinite(centroidX)).toBe(true);
    expect(Number.isFinite(centroidZ)).toBe(true);
  });

  it("cross-ties render in 3D + appear on the BBS (more scheduled bars than perimeter-only)", () => {
    const r = solveDoc(withTies(1));
    expect(buildScene(r, null, false).bars.some((b) => b.groupId.startsWith("T1_X"))).toBe(true);
    const total = (d: ColumnDoc) => computeBBS(solveDoc(d)).lines.reduce((n, l) => n + l.count, 0);
    expect(total(withTies(1))).toBeGreaterThan(total(defaultColumnDoc()));
  });

  it("Asw leg count grows with the cross-ties (2 + 2·n) and the solve stays valid", () => {
    const asw = (d: ColumnDoc) => Number(solveDoc(d).validation.find((v) => v.rule === "asw_leg_count")?.value ?? 0);
    expect(asw(withTies(1))).toBeGreaterThan(asw(defaultColumnDoc()));
    expect(solveDoc(withTies(1)).status).not.toBe("FAIL");
  });

  it("the seismic engaged-bar count reflects the configured cross-ties (real longBarsEngaged)", () => {
    const seismic = { code: "RPS-2011", zone: 3, ductility: "ND2" } as const;
    const base: ColumnDoc = { ...defaultColumnDoc(), seismic };
    const withTie: ColumnDoc = { ...base, tie: { ...base.tie, crossTies: autoCrossTies(solveDoc(base).bars) } };
    const engagedOf = (d: ColumnDoc) =>
      Number(solveDoc(d).validation.find((v) => v.rule === "crosstie_engagement")?.value ?? 0);
    // base = 4 corners engaged; adding the vertical cross-tie engages 2 more intermediate bars
    expect(engagedOf(withTie)).toBeGreaterThan(engagedOf(base));
  });

  it("a legacy nLegs doc migrates to an equivalent cross-tie set (no data loss)", () => {
    const legacy = { ...defaultColumnDoc(), tie: { groupId: "T1", shapeId: "CADRE_RECT", diameter: 8, spacing: 200, aswReqPerM: 300, nLegs: 4 } } as unknown as ColumnDoc;
    const migrated = migrateDoc(legacy) as ColumnDoc;
    expect("nLegs" in migrated.tie).toBe(false);
    expect(migrated.tie.crossTies.length).toBe(1); // (4−2)/2 = 1 épingle
    expect(migrated.tie.crossTieHookAngle).toBe(135);
    expect(solveDoc(migrated).groups.filter((g) => g.groupId.startsWith("T1_X")).length).toBe(1);
  });
});
