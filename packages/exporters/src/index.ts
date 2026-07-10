/**
 * @rebarconfig/exporters — the P5/M5 export engines + project I/O.
 *
 * Pure transforms of a core `SolveResult` / `CoupeView`:
 *   - BBS  (§9.1) — bar-bending schedule + steel summary + cut-nesting (dependency-free).
 *   - DXF  (§9.2) — DXF-1 elevation + default coupe, four strict layers (dependency-free).
 *   - PDF  (§9.3) — vector sheet (cartouche + views + BBS + status stamp) via pdf-lib.
 *   - .rcfg (§10) — save/load + IndexedDB autosave; forward-compat preserving unknowns.
 *
 * Depends on @rebarconfig/core; NO React/three/DOM in the pure transforms (BBS/DXF/.rcfg model).
 */
export * from "./bbs";
export * from "./faconnageCodes";
export * from "./dxf";
export * from "./export-lock";
export * from "./fiche";
export * from "./shopDrawing";
export * from "./pdf";
export * from "./rcfg";
export * from "./canonical";
