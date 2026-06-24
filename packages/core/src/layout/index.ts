/**
 * Layout sub-package (spec §6.1): cross-section solvers + computed d/d'.
 *   - rect.ts     : rectangular section (E-COL-01, E-BEM-01)
 *   - circular.ts : circular pitch-circle / EQUAL_PERIMETER (E-COL-02, E-FND-01) — P4a
 *   - slab.ts     : slab/mat 1-D bar lines + per-metre provided steel (E-SLB-*) — P4a
 */
export * from "./rect";
export * from "./circular";
export * from "./slab";
