/**
 * The six frozen core contracts (spec §12 M0). Everything downstream compiles against these.
 *  1. Shape segment grammar      — shape.ts            (§5.2.1)
 *  2. Distribution                — distribution.ts     (§5.1.1)
 *  3. ReinforcingElement/BarGroup — reinforcing-element.ts (§0.2.1, §10)
 *  4. Layout-solver I/O           — layout.ts            (§6.1)
 *  5. code.* function interface   — codepack.ts          (§7.11)
 *  6. .rcfg envelope              — rcfg.ts              (§10)
 * Manifest element/scheme/supplement shapes are pinned by JSON Schema (../../schemas/*).
 */
export * from "./shape";
export * from "./distribution";
export * from "./placement";
export * from "./reinforcing-element";
export * from "./layout";
// M2 P-A — the canonical placed-bar input family (SingleBar; rows/bundles/layers in M3)
export * from "./placed-bar";
export * from "./codepack";
export * from "./rcfg";
// P4b — seismic overlay contract (RPS 2000/2011, §7.10)
export * from "./seismic";
