/**
 * Circular cross-section layout solver — EQUAL_PERIMETER (spec §6.1 [REF-SYS-610]).
 *
 * `N` longitudinal bars on the pitch circle of radius `R_p = D/2 − c − φ_t − φ_ℓ/2`, at the
 * angular step `360°/N` from a datum (+u). Clear spacing is checked along the pitch-circle arc:
 * `s_arc = 2·R_p·sin(180°/N) − φ_ℓ`. The minimum bar count is **6** (§6.1, §7.4).
 *
 * Used by the circular spiral column (E-COL-02) and the drilled-shaft pile (E-FND-01). Section
 * frame: origin at the section centre, u/v in the plane. Pure + deterministic.
 */
import type { LayoutDescriptor, BarPosition } from "../types/layout";

/** Minimum bars on a circular pitch circle (§6.1 / §7.4). */
export const CIRCULAR_MIN_BARS = 6;

export interface CircularLayoutResult {
  bars: BarPosition[];
  /** provided longitudinal bar count on the pitch circle. */
  count: number;
  /** pitch-circle radius R_p (mm). */
  Rp: number;
  /** arc clear spacing between adjacent bars (mm). */
  sArc: number;
  /** diameter D of the section (mm). */
  D: number;
  /** true when an occupied circle has < 6 bars → tier-1 hard-invalid (§6.1). */
  underfilled: boolean;
}

export function solveCircularLayout(d: LayoutDescriptor): CircularLayoutResult {
  const D = d.geometry["D"];
  if (D === undefined) throw new Error("solveCircularLayout: geometry needs D (mm)");
  const N = d.circularCount ?? 0;
  const Rp = D / 2 - d.cover - d.phiT - d.phiL / 2;

  const bars: BarPosition[] = [];
  for (let i = 0; i < N; i++) {
    const theta = (i * 2 * Math.PI) / N;
    bars.push({
      position: { u: Rp * Math.cos(theta), v: Rp * Math.sin(theta) },
      faceTag: "CIRC",
      layerIndex: 0,
      isCorner: false,
    });
  }

  const sArc = N > 1 ? 2 * Rp * Math.sin(Math.PI / N) - d.phiL : Rp;
  return { bars, count: N, Rp, sArc, D, underfilled: N > 0 && N < CIRCULAR_MIN_BARS };
}
