/**
 * Face-relative bar labels for the v1.0.2 F7 section picker ([REF-UI-555], owner decision D-V102).
 *
 * Each longitudinal bar gets a label `T1`/`B2`/`L1`/`R3`/`C5` — the face letter (Top/Bottom/Left/
 * Right/Circular) + its 1-based rank along that face (TOP/BOTTOM ordered left→right by `u`; LEFT/
 * RIGHT bottom→top by `v`; circular by angle). Deterministic + stable: the SAME bar keeps its label
 * across re-solves, so a binding (stored as a raw index, D-P3-4) always shows the same name. Pure —
 * no React/DOM; headless-testable. The labels are display-only; bindings remain raw indices.
 */
import type { BarPosition, FaceTag } from "@rebarconfig/core";

const FACE_PREFIX: Record<string, string> = { TOP: "T", BOTTOM: "B", LEFT: "L", RIGHT: "R", CIRC: "C" };

export interface LabeledBar {
  index: number;
  label: string;
  u: number;
  v: number;
  faceTag: FaceTag;
  /**
   * v1.0.6-fix R5: a slab/stair DISTRIBUTION bar runs ACROSS the width (C1) — its `u` is unused and every
   * one of them sits at `u = 0`. Carried through so the section canvas can draw it as the LINE it is,
   * instead of stacking N coincident dots on the centreline.
   */
  across?: boolean;
}

/** Rank a bar within its own face: TOP/BOTTOM by ascending u; LEFT/RIGHT by ascending v; else by angle. */
function faceOrderKey(faceTag: FaceTag, p: { u: number; v: number }): number {
  if (faceTag === "TOP" || faceTag === "BOTTOM") return p.u;
  if (faceTag === "LEFT" || faceTag === "RIGHT") return p.v;
  return Math.atan2(p.v, p.u); // CIRC / slab-family → stable angular order
}

/** The display label for one bar relative to all bars (face letter + 1-based in-face rank). */
export function barLabel(index: number, bars: readonly BarPosition[]): string {
  const bar = bars[index];
  if (!bar) return `#${index}`;
  const prefix = FACE_PREFIX[bar.faceTag as string] ?? "#";
  const sameFace = bars
    .map((b, i) => ({ i, k: faceOrderKey(b.faceTag, b.position) }))
    .filter((_x, i) => bars[i]!.faceTag === bar.faceTag)
    .sort((a, b) => a.k - b.k || a.i - b.i);
  const rank = sameFace.findIndex((x) => x.i === index);
  return `${prefix}${rank + 1}`;
}

/** Every longitudinal bar with its label + section-frame position, for the picker + keyboard list. */
export function labeledBars(bars: readonly BarPosition[]): LabeledBar[] {
  return bars.map((b, index) => ({
    index,
    label: barLabel(index, bars),
    u: b.position.u,
    v: b.position.v,
    faceTag: b.faceTag,
    ...(b.across ? { across: true } : {}),
  }));
}
