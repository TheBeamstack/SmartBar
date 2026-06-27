/**
 * Bar-Bending Schedule (BBS) engine — spec §9.1, plan P5 step 2.
 *
 * Pure, deterministic transform of a core `SolveResult` into the canonical §9.1 record:
 *   - one line per *distinct* bar (identical shape + Ø + dims are MERGED across groups/segments),
 *     each carrying a stable auto-mark, total count, fabrication `cutLength`, length, and weight;
 *   - a steel-quantity summary (weight per Ø + steel ratio kg/m³);
 *   - optional stock-length cut-nesting (default 12 m, waste %).
 *
 * `weight = totalLength × unitMass(φ)`, `unitMass(φ) = 0.006165·φ²` kg/m (spec §9.1). All bar
 * counts come from the SAME source of truth as the 3D placement (`transverseStations`) so the
 * schedule matches what is drawn. No DOM/three; feeds the on-screen table, the PDF, and the DXF.
 */
import type { SolveResult, SolvedGroup, ValidationStatus } from "@rebarconfig/core";
import { transverseStations } from "@rebarconfig/core";

/** Steel unit mass (kg/m) for a round bar of Ø `phi` mm: 0.006165·φ² (spec §9.1). */
export function unitMass(phi: number): number {
  return 0.006165 * phi * phi;
}

/** One scheduled bar (merged across identical groups/segments). */
export interface BbsLine {
  /** stable auto-mark (deterministic: ordered by Ø, then cut length, then shape). */
  mark: string;
  /** the source group ids merged into this line. */
  groupIds: string[];
  shapeArchetypeId: string;
  role: string;
  /** Ø (mm). */
  diameter: number;
  /** total number of identical bars. */
  count: number;
  /** per-bar fabrication length (mm) — the engine's `cutLength`, NOT the polyline sum. */
  cutLength_mm: number;
  /** total run = count × cutLength (m). */
  totalLength_m: number;
  /** kg/m for this Ø. */
  unitMass_kg_m: number;
  /** total steel weight for this line (kg). */
  weight_kg: number;
  /** the façonnage sketch data (legs a/b/c, bends, hooks) for the PDF fiche. */
  fiche: SolvedGroup["shape"]["fiche"];
}

/** Steel quantity per Ø (the §9.1 steel-quantity summary). */
export interface BbsByDiameter {
  diameter: number;
  count: number;
  totalLength_m: number;
  weight_kg: number;
}

export interface BbsSummary {
  byDiameter: BbsByDiameter[];
  totalWeight_kg: number;
  /** concrete volume of the member envelope (m³) — slab-family is the representative strip. */
  concreteVolume_m3: number;
  /** steel ratio (kg/m³) = totalWeight / concreteVolume; 0 when the volume is unknown. */
  steelRatio_kg_m3: number;
}

export interface BarBendingSchedule {
  element: string;
  lines: BbsLine[];
  summary: BbsSummary;
  /** the element's validity status — drives the "À vérifier" review stamp on the fiche (§7.9/§7.12). */
  status: ValidationStatus;
  /** true when the element is WARN (🟠): the schedule must be stamped "À vérifier" (§7.12). */
  reviewRequired: boolean;
}

/** Round to a fixed grid so float noise never splits an otherwise-identical bar. */
const q = (x: number): number => Math.round(x * 1e3) / 1e3;

/** A continuous coil (spiral/helix) is ONE bar of `cutLength`, not a stack of discrete sets. */
function isContinuousCoil(shape: SolvedGroup["shape"]): boolean {
  return "coilLength" in shape;
}

/** Total fabricated count for a solved group (transverse sets expand up the member axis). */
function groupCount(
  g: SolvedGroup,
  transverseSpacing: Map<string, number>,
  memberLength: number,
): number {
  const spacing = transverseSpacing.get(g.groupId);
  if (spacing === undefined) return g.count; // longitudinal / supplement: section count
  if (isContinuousCoil(g.shape)) return 1; // one continuous spiral
  return transverseStations(memberLength, spacing).length; // discrete ties/stirrups
}

/** Concrete volume of the member envelope (m³); 0 when unknown. */
function concreteVolume(member: SolveResult["member"]): number {
  const L = member.length;
  if (member.envelope === "RECT" && member.b && member.h) {
    return (member.b * member.h * L) / 1e9;
  }
  if (member.envelope === "CIRCULAR" && member.D) {
    return ((Math.PI / 4) * member.D * member.D * L) / 1e9;
  }
  return 0;
}

export interface BbsOptions {
  /**
   * Prefix applied to every mark so a multi-element project's marks are globally unique on site
   * (spec §9.1 [REF-SYS-915], v1.0.1 Feature C). `""` (default) keeps the bare ordinal marks
   * (`"1"`, `"2"`, …) — single-element schedules stay byte-identical. A prefix `"P1"` yields the
   * namespaced `"P1-01"`, `"P1-02"`, … form (owner convention §14 item 19).
   */
  markPrefix?: string;
}

/** Format a mark: bare ordinal when unprefixed (legacy), `PREFIX-01` when namespaced. */
function formatMark(prefix: string, ordinal: number): string {
  return prefix ? `${prefix}-${String(ordinal).padStart(2, "0")}` : String(ordinal);
}

/** Build the §9.1 bar-bending schedule from a solved element (pure, deterministic). */
export function computeBBS(result: SolveResult, opts: BbsOptions = {}): BarBendingSchedule {
  const markPrefix = opts.markPrefix ?? "";
  const transverseSpacing = new Map(result.member.transverse.map((t) => [t.groupId, t.spacing]));

  // 1. raw entries: every group → (count, cutLength, shape) ----------------------------------
  interface Raw {
    key: string;
    groupId: string;
    shapeArchetypeId: string;
    role: string;
    diameter: number;
    count: number;
    cutLength: number;
    fiche: SolvedGroup["shape"]["fiche"];
  }
  const raws: Raw[] = [];
  for (const g of result.groups) {
    const count = groupCount(g, transverseSpacing, result.member.length);
    if (count <= 0) continue;
    const cutLength = g.shape.cutLength;
    const legSig = g.shape.fiche.legs.map((l) => q(l.length)).join(",");
    raws.push({
      key: `${g.shape.archetypeId}|${g.diameter}|${q(cutLength)}|${legSig}`,
      groupId: g.groupId,
      shapeArchetypeId: g.shape.archetypeId,
      role: g.role,
      diameter: g.diameter,
      count,
      cutLength,
      fiche: g.shape.fiche,
    });
  }

  // 2. merge identical bars (shape + Ø + dims) across groups/segments -------------------------
  interface MergedRaw extends Raw {
    groupIds: string[];
  }
  const merged = new Map<string, MergedRaw>();
  for (const r of raws) {
    const ex = merged.get(r.key);
    if (ex) {
      ex.count += r.count;
      ex.groupIds.push(r.groupId);
    } else {
      merged.set(r.key, { ...r, groupIds: [r.groupId] });
    }
  }

  // 3. deterministic ordering → stable marks (Ø asc, cut asc, shape asc) ----------------------
  const ordered = [...merged.values()].sort(
    (a, b) =>
      a.diameter - b.diameter ||
      a.cutLength - b.cutLength ||
      a.shapeArchetypeId.localeCompare(b.shapeArchetypeId),
  );

  const lines: BbsLine[] = ordered.map((r, i) => {
    const um = unitMass(r.diameter);
    const totalLength_m = (r.count * r.cutLength) / 1000;
    return {
      mark: formatMark(markPrefix, i + 1),
      groupIds: r.groupIds,
      shapeArchetypeId: r.shapeArchetypeId,
      role: r.role,
      diameter: r.diameter,
      count: r.count,
      cutLength_mm: r.cutLength,
      totalLength_m,
      unitMass_kg_m: um,
      weight_kg: totalLength_m * um,
      fiche: r.fiche,
    };
  });

  // 4. steel-quantity summary (per Ø + ratio) ------------------------------------------------
  const byDiaMap = new Map<number, BbsByDiameter>();
  for (const l of lines) {
    const e = byDiaMap.get(l.diameter) ?? {
      diameter: l.diameter,
      count: 0,
      totalLength_m: 0,
      weight_kg: 0,
    };
    e.count += l.count;
    e.totalLength_m += l.totalLength_m;
    e.weight_kg += l.weight_kg;
    byDiaMap.set(l.diameter, e);
  }
  const byDiameter = [...byDiaMap.values()].sort((a, b) => a.diameter - b.diameter);
  const totalWeight_kg = byDiameter.reduce((s, e) => s + e.weight_kg, 0);
  const concreteVolume_m3 = concreteVolume(result.member);
  const steelRatio_kg_m3 = concreteVolume_m3 > 0 ? totalWeight_kg / concreteVolume_m3 : 0;

  return {
    element: result.element,
    lines,
    summary: { byDiameter, totalWeight_kg, concreteVolume_m3, steelRatio_kg_m3 },
    status: result.status,
    reviewRequired: result.status === "WARN",
  };
}

/** Per-Ø nesting result against a fixed stock length. */
export interface NestingByDiameter {
  diameter: number;
  /** number of stock bars consumed. */
  bars: number;
  /** total stock length consumed (mm). */
  stockUsed_mm: number;
  /** total fabricated length placed (mm). */
  usedLength_mm: number;
  wastePct: number;
}

export interface NestingResult {
  stockLength_mm: number;
  byDiameter: NestingByDiameter[];
  totalStock_mm: number;
  totalUsed_mm: number;
  wastePct: number;
}

/**
 * First-Fit-Decreasing stock-length cut-nesting (spec §9.1, optional). Default 12 m stock.
 * Pieces are nested per Ø; a piece longer than the stock takes its own bar (lapping is a
 * separate concern, out of v1.0 scope) — disclosed in current_state.md.
 */
export function nestCuts(bbs: BarBendingSchedule, stockLength_mm = 12000): NestingResult {
  const byDia: NestingByDiameter[] = [];

  const piecesByDia = new Map<number, number[]>();
  for (const l of bbs.lines) {
    const arr = piecesByDia.get(l.diameter) ?? [];
    for (let i = 0; i < l.count; i++) arr.push(l.cutLength_mm);
    piecesByDia.set(l.diameter, arr);
  }

  for (const diameter of [...piecesByDia.keys()].sort((a, b) => a - b)) {
    const pieces = piecesByDia.get(diameter)!.slice().sort((a, b) => b - a); // descending
    const binsRemaining: number[] = [];
    for (const p of pieces) {
      let placed = false;
      for (let i = 0; i < binsRemaining.length; i++) {
        if (binsRemaining[i]! >= p - 1e-6) {
          binsRemaining[i]! -= p;
          placed = true;
          break;
        }
      }
      if (!placed) binsRemaining.push(Math.max(stockLength_mm, p) - p);
    }
    const bars = binsRemaining.length;
    const stockUsed_mm = bars * stockLength_mm;
    const usedLength_mm = pieces.reduce((s, p) => s + p, 0);
    byDia.push({
      diameter,
      bars,
      stockUsed_mm,
      usedLength_mm,
      wastePct: stockUsed_mm > 0 ? (1 - usedLength_mm / stockUsed_mm) * 100 : 0,
    });
  }

  const totalStock_mm = byDia.reduce((s, e) => s + e.stockUsed_mm, 0);
  const totalUsed_mm = byDia.reduce((s, e) => s + e.usedLength_mm, 0);
  return {
    stockLength_mm,
    byDiameter: byDia,
    totalStock_mm,
    totalUsed_mm,
    wastePct: totalStock_mm > 0 ? (1 - totalUsed_mm / totalStock_mm) * 100 : 0,
  };
}
