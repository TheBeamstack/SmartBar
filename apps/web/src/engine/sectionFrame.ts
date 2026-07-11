/**
 * v1.0.6-fix R5 / finding F-D ([REF-UI-565]) — the ONE section-frame seam.
 *
 * **The defect it fixes.** The drawing-board existed on 2 of the 8 elements: `SectionDock` gated the
 * `SectionCanvas` on column/beam, so on slab ×2 / joist / stair / circular column / pile there was no
 * canvas at all — placement was two numeric boxes with no visual frame. Worse, `snapSection` was handed
 * no `b`/`h` for those docs, so it **silently skipped the cover clamp**: a bar on a pile could be typed
 * clean outside the concrete, and only reddened afterwards.
 *
 * **The fix.** Generalise by **SECTION DESCRIPTOR, not by element.** The engine already dispatches that
 * way (D-P3-1 / D-P4a-2) and the UI never followed — even though every one of the 8 pipelines already
 * publishes its section in `result.member` (column/beam `b×h`, slab `Ly×t`, joist `width×t`, stair
 * `flight×waist`, circular `D`). This module is the single place the drawing frame and the cover-envelope
 * clamp are derived from it, so the canvas, the pointer drop and the typed coordinate can never disagree.
 *
 * Pure + deterministic (no store, no DOM, no React) → headless-unit-tested.
 */
import type { SolveResult } from "@rebarconfig/core";

/** The concrete cross-section shape, straight off `result.member` (the engine's own axis). */
export type SectionEnvelope = "RECT" | "CIRCULAR";

export interface SectionFrame {
  envelope: SectionEnvelope;
  /** RECT width (u extent, mm). Present on RECT; on CIRCULAR both b and h read D (the bounding box). */
  b: number;
  /** RECT depth (v extent, mm). */
  h: number;
  /** CIRCULAR overall diameter (mm) — only on a round section. */
  D?: number;
  cover: number;
  /** the drawing box in SVG coords (the section plus a legible margin) — the hit area + the `viewBox`. */
  view: { x: number; y: number; w: number; h: number };
  /** the SVG `viewBox` string, straight from `view`. */
  viewBox: string;
  /** radius of a bar mark in SECTION units — aspect-aware, so a 20:1 slab's bars stay legible. */
  markRadius: number;
  /** snap step on the u axis (mm) — owner **O-3a**: a long axis snaps coarse, a short one stays fine. */
  gridU: number;
  /** snap step on the v axis (mm). */
  gridV: number;
}

/**
 * Owner decision **O-3a** (2026-07-11) — the snap grid is **per axis, derived from that axis's extent**,
 * not one constant and not one step per element. A flat 5 mm grid is right for a 400 mm column and absurd
 * across a 4 m slab (800 steps); a flat coarse grid would wreck the one axis where cover actually lives
 * (a slab's 200 mm thickness). So: a long axis snaps coarse, a short axis stays fine. Data-driven off the
 * section — no element branching.
 */
export function gridFor(extent: number): number {
  return extent > 1500 ? 25 : 5;
}

/** Derive the drawing frame + clamp geometry for ANY of the 8 elements, from the engine's own descriptor. */
export function sectionFrame(result: SolveResult, cover: number): SectionFrame {
  const m = result.member;
  const circular = m.envelope === "CIRCULAR";
  const D = circular ? (m.D ?? 400) : undefined;
  const b = circular ? D! : (m.b ?? m.D ?? 400);
  const h = circular ? D! : (m.h ?? m.D ?? 400);

  // A slab section is genuinely ~20:1. The concrete is drawn at TRUE proportion (distorting it would lie
  // about the geometry); only the marks and the margin adapt. A mark scaled off the LARGER dimension would
  // be wider than a slab is thick; one scaled off the smaller alone vanishes on screen — so take the
  // larger of the two rules: legible on a slab, unchanged in feel on a column.
  const minDim = Math.min(b, h);
  const maxDim = Math.max(b, h);
  const markRadius = Math.max(minDim * 0.05, maxDim * 0.012);
  const pad = markRadius * 1.6 + maxDim * 0.02;
  const view = { x: -b / 2 - pad, y: -h / 2 - pad, w: b + 2 * pad, h: h + 2 * pad };

  return {
    envelope: m.envelope,
    b,
    h,
    ...(D !== undefined ? { D } : {}),
    cover,
    view,
    viewBox: `${view.x} ${view.y} ${view.w} ${view.h}`,
    markRadius,
    gridU: gridFor(b),
    gridV: gridFor(h),
  };
}

/**
 * Clamp a section coordinate into the **cover envelope** — a bar's centre can sit no closer to the
 * concrete face than `cover + Ø/2`.
 *
 * **RECT** → the rectangular box. **CIRCULAR** → a **RADIAL** clamp (`r ≤ D/2 − cover − Ø/2`): a round
 * section's envelope is a disc, and clamping it against a bounding box would happily leave a bar in a
 * corner that is outside the concrete. Before R5 a circular section got **no clamp at all** (the old
 * `snapSection` skipped the envelope whenever `b`/`h` were absent, which was exactly the circular case).
 */
export function clampToFrame(frame: SectionFrame, u: number, v: number, diameter: number): { u: number; v: number } {
  if (frame.envelope === "CIRCULAR") {
    const rMax = Math.max(0, (frame.D ?? frame.b) / 2 - frame.cover - diameter / 2);
    const r = Math.hypot(u, v);
    if (r <= rMax || r === 0) return { u, v };
    const k = rMax / r; // pull the point back along its own ray — direction preserved, radius clamped
    return { u: u * k, v: v * k };
  }
  const lim = (dim: number) => Math.max(0, dim / 2 - frame.cover - diameter / 2);
  const limU = lim(frame.b);
  const limV = lim(frame.h);
  return {
    u: Math.max(-limU, Math.min(limU, u)),
    v: Math.max(-limV, Math.min(limV, v)),
  };
}

/**
 * The single pointer/typed-coordinate → placeable-coordinate seam: snap to the per-axis grid, then clamp
 * into the cover envelope. Both the on-canvas drop and the palette's typed `(u,v)` twin route through
 * here, so the two paths cannot drift (a11y invariant §0.3.3).
 *
 * Grid first, clamp second — so the clamp always wins and a snapped point can never be pushed back out of
 * the concrete by rounding.
 */
export function snapToFrame(frame: SectionFrame, u: number, v: number, diameter: number): { u: number; v: number } {
  const gu = Math.round(u / frame.gridU) * frame.gridU;
  const gv = Math.round(v / frame.gridV) * frame.gridV;
  return clampToFrame(frame, gu, gv, diameter);
}
