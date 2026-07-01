/** Geometry sub-package (spec §5.2.1, §6 step 2): expression scope + segment generator. */
export * from "./expr";
export * from "./segment-grammar";
// P4a — shape registry seam (§6) + the two bespoke generators (§5.2.1g)
export * from "./registry";
export * from "./bespoke/helix";
export * from "./bespoke/mesh";
// v1.0.3 G4 — lap splices / couplers (§4)
export * from "./splice";
