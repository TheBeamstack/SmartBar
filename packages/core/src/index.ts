/**
 * @rebarconfig/core — pure engine package (spec §2.1).
 * NO DOM / React / three imports anywhere under this package (enforced by check:purity).
 *
 * M0 surface: the six frozen contract types + the manifest-integrity gate.
 * Solver / validation / exporter bodies arrive in P1–P6.
 */
export * from "./types/index";
export * from "./integrity/index";

// P1 — engine bodies (spec §5.2.1, §6, §6.1, §7)
export * from "./geometry/index";
export * from "./layout/index";
export * from "./validation/index";
export * from "./pipeline/index";
