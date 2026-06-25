/**
 * DXF export (spec §9.2), plan P5 step 3 — staged DXF-1 (release bar) + DXF-2.
 *
 * Source geometry is written ONCE in core: the longitudinal elevation comes from the placed bars
 * (`placeBars`, the §5.2 `fiche` 2D projection) and each cross-section comes from `sectionAt`'s
 * `CoupeView` (§9.5). This module is a pure, deterministic DXF R12 (AC1009) ASCII serialiser — no
 * library, so the golden output is byte-stable and reads in any CAD tool.
 *
 *   - DXF-1 (`buildDxf1`): the longitudinal elevation + the default representative coupe.
 *   - DXF-2 (`buildDxfCoupes`): multiple user-defined coupes incl. oblique orientation, each with
 *     its cutting-line/tag drawn on the elevation.
 *
 * Exactly four strict layers (spec §9.2): COFFRAGE (concrete), ARMATURES (steel), COTATION
 * (dimensions), TEXTE (text/labels). No DOM/three.
 */
import {
  placeBars,
  sectionAt,
  defaultCoupeFor,
  type SolveResult,
  type SectionCut,
  type CoupeView,
  type Pt2,
} from "@rebarconfig/core";

/** The four strict DXF layers (§9.2) with their ACI colour numbers. */
export const DXF_LAYERS = {
  COFFRAGE: 8, // grey — concrete outline
  ARMATURES: 1, // red — steel
  COTATION: 3, // green — dimensions
  TEXTE: 4, // cyan — text/labels
} as const;
export type DxfLayer = keyof typeof DXF_LAYERS;
export const DXF_LAYER_NAMES = Object.keys(DXF_LAYERS) as DxfLayer[];

/** Deterministic number formatting: 4 dp, no scientific notation, no negative zero. */
function fmt(n: number): string {
  const r = Math.round(n * 1e4) / 1e4;
  return (Object.is(r, -0) ? 0 : r).toString();
}

/** Accumulates DXF entities and serialises a valid R12 document. */
export class DxfBuilder {
  private entities: string[] = [];

  line(layer: DxfLayer, x1: number, y1: number, x2: number, y2: number): this {
    this.entities.push(
      `0\nLINE\n8\n${layer}\n10\n${fmt(x1)}\n20\n${fmt(y1)}\n30\n0\n11\n${fmt(x2)}\n21\n${fmt(y2)}\n31\n0`,
    );
    return this;
  }

  circle(layer: DxfLayer, cx: number, cy: number, r: number): this {
    this.entities.push(`0\nCIRCLE\n8\n${layer}\n10\n${fmt(cx)}\n20\n${fmt(cy)}\n30\n0\n40\n${fmt(r)}`);
    return this;
  }

  text(layer: DxfLayer, x: number, y: number, height: number, s: string): this {
    this.entities.push(
      `0\nTEXT\n8\n${layer}\n10\n${fmt(x)}\n20\n${fmt(y)}\n30\n0\n40\n${fmt(height)}\n1\n${s}`,
    );
    return this;
  }

  /** Open or closed polyline as a run of LINE segments (R12-universal). */
  polyline(layer: DxfLayer, pts: { x: number; y: number }[], closed: boolean): this {
    for (let i = 0; i + 1 < pts.length; i++) {
      this.line(layer, pts[i]!.x, pts[i]!.y, pts[i + 1]!.x, pts[i + 1]!.y);
    }
    if (closed && pts.length > 2) {
      const a = pts[pts.length - 1]!, b = pts[0]!;
      this.line(layer, a.x, a.y, b.x, b.y);
    }
    return this;
  }

  /** Number of entities emitted so far (used by tests/diagnostics). */
  get entityCount(): number {
    return this.entities.length;
  }

  toString(): string {
    const layerTable = DXF_LAYER_NAMES.map(
      (name) => `0\nLAYER\n2\n${name}\n70\n0\n62\n${DXF_LAYERS[name]}\n6\nCONTINUOUS`,
    ).join("\n");
    return [
      "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC",
      `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${DXF_LAYER_NAMES.length}\n${layerTable}\n0\nENDTAB\n0\nENDSEC`,
      `0\nSECTION\n2\nENTITIES\n${this.entities.join("\n")}\n0\nENDSEC`,
      "0\nEOF",
    ].join("\n");
  }
}

const TEXT_H = 50; // mm — templated text height

/** Map a coupe-plane point (s,t) into DXF model space at an offset (dx,dy). */
const place2 = (p: Pt2, dx: number, dy: number) => ({ x: p.s + dx, y: p.t + dy });

/** Emit a `CoupeView` (concrete + bars + annotations + dimensions) into the builder. */
export function coupeToDxf(view: CoupeView, b: DxfBuilder, dx = 0, dy = 0): DxfBuilder {
  // concrete outline (COFFRAGE)
  b.polyline("COFFRAGE", view.concrete.outline.map((p) => place2(p, dx, dy)), true);
  // bars: section circles + near-parallel runs (ARMATURES)
  for (const c of view.circles) b.circle("ARMATURES", c.center.s + dx, c.center.t + dy, c.diameter / 2);
  for (const l of view.lines) {
    const a = place2(l.a, dx, dy), q = place2(l.b, dx, dy);
    b.line("ARMATURES", a.x, a.y, q.x, q.y);
  }
  // group annotations n Ø d (TEXTE)
  for (const a of view.annotations) {
    b.text("TEXTE", a.at.s + dx, a.at.t + dy, TEXT_H, `${a.count} Ø ${a.diameter}`);
  }
  // dimensions (COTATION)
  for (const d of view.dimensions) {
    const f = place2(d.from, dx, dy), t = place2(d.to, dx, dy);
    b.line("COTATION", f.x, f.y, t.x, t.y);
    b.text("COTATION", (f.x + t.x) / 2, (f.y + t.y) / 2 + TEXT_H * 0.2, TEXT_H, d.label);
  }
  // coupe title (TEXTE)
  const minS = Math.min(...view.concrete.outline.map((p) => p.s));
  const maxT = Math.max(...view.concrete.outline.map((p) => p.t));
  b.text("TEXTE", minS + dx, maxT + dy + TEXT_H * 1.5, TEXT_H, view.label);
  return b;
}

/**
 * Emit the longitudinal elevation (the §5.2 `fiche` projection): concrete outline + bars projected
 * onto the (axis = +Y → X, height = +Z → Y) plane, plus the cutting-line/tag for each coupe.
 */
export function elevationToDxf(result: SolveResult, b: DxfBuilder, coupes: CoupeView[]): DxfBuilder {
  const { member } = result;
  const L = member.length;
  const halfH = member.envelope === "CIRCULAR" ? (member.D ?? 0) / 2 : (member.h ?? 0) / 2;

  // concrete elevation rectangle (COFFRAGE): 0..L along X, ±halfH along Y
  b.polyline(
    "COFFRAGE",
    [
      { x: 0, y: -halfH },
      { x: L, y: -halfH },
      { x: L, y: halfH },
      { x: 0, y: halfH },
    ],
    true,
  );

  // bars projected to the elevation: world (x,y,z) → (y, z)
  for (const bar of placeBars(result)) {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i + 2 < bar.points.length; i += 3) {
      pts.push({ x: bar.points[i + 1]!, y: bar.points[i + 2]! });
    }
    b.polyline("ARMATURES", pts, bar.closed);
  }

  // overall length dimension (COTATION) below the member
  const dimY = -halfH - TEXT_H * 2;
  b.line("COTATION", 0, dimY, L, dimY);
  b.text("COTATION", L / 2, dimY + TEXT_H * 0.2, TEXT_H, `${Math.round(L)}`);

  // cutting line + tag per coupe (COTATION line + TEXTE tag), keyed to the elevation station
  for (const view of coupes) {
    const s = view.elevation.axisStation;
    b.line("COTATION", s, -halfH - TEXT_H, s, halfH + TEXT_H);
    b.text("TEXTE", s, halfH + TEXT_H * 1.5, TEXT_H, view.elevation.tag);
  }
  return b;
}

export interface Dxf1Options {
  /** override the seeded default coupe (else `defaultCoupeFor`). */
  coupe?: SectionCut;
  /** horizontal gap between the elevation and the coupe view box (mm). */
  gap?: number;
}

/**
 * DXF-1 (required release bar, §9.2): the longitudinal elevation + the single default
 * representative coupe, on the four strict layers.
 */
export function buildDxf1(result: SolveResult, opts: Dxf1Options = {}): string {
  const cut = opts.coupe ?? defaultCoupeFor(result);
  const view = sectionAt(result, cut);
  const b = new DxfBuilder();
  elevationToDxf(result, b, [view]);
  // place the coupe to the right of the elevation: its left edge at length + gap
  const gap = opts.gap ?? 500;
  const minS = Math.min(...view.concrete.outline.map((p) => p.s));
  coupeToDxf(view, b, result.member.length + gap - minS, 0);
  return b.toString();
}

/**
 * DXF-2 (completes within M5, §9.2/§9.5): the full coupe-engine output — every user-defined coupe
 * (incl. arbitrary/oblique orientation) laid out left→right, each with its cutting-line/tag on the
 * elevation. Label-collision solver is templated (deferred per the plan).
 */
export function buildDxfCoupes(result: SolveResult, cuts: SectionCut[]): string {
  const views = cuts.map((c) => sectionAt(result, c));
  const b = new DxfBuilder();
  elevationToDxf(result, b, views);
  let x0 = result.member.length + 500; // left edge of the next coupe
  for (const view of views) {
    const ss = view.concrete.outline.map((p) => p.s);
    const minS = Math.min(...ss), w = Math.max(...ss) - minS;
    coupeToDxf(view, b, x0 - minS, 0);
    x0 += w + 500;
  }
  return b.toString();
}
