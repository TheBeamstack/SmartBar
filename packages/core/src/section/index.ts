/**
 * Section / Coupe engine (spec §9.5, [REF-SYS-950]) — pure, deterministic.
 * `sectionAt(solveResult, cut) → CoupeView` feeds the 3D preview + DXF + PDF (written once).
 */
export * from "./types";
export * from "./convention";
export * from "./place";
export * from "./sectionAt";
// M2 P-B — the shared placed-bar resolution pass (free placement on all 8 elements)
export * from "./resolvePlacedBars";
