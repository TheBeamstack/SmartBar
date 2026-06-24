/**
 * @rebarconfig/core — pure engine package (spec §2.1).
 * NO DOM / React / three imports anywhere under this package (enforced by check:purity).
 *
 * M0 surface: the six frozen contract types + the manifest-integrity gate.
 * Solver / validation / exporter bodies arrive in P1–P6.
 */
export * from "./types/index";

// P1 — engine bodies (spec §5.2.1, §6, §6.1, §7)
export * from "./geometry/index";
export * from "./layout/index";
export * from "./validation/index";
// P3 — validation-profile registry (D-P1-4) + scheme/placement/supplement resolvers (§5.3–5.6)
export * from "./validation/profiles";
// P4a — topological / detailing-logic predicates (§7.13)
export * from "./validation/predicates";
// P4b — seismic overlay validation (RPS composes on either pack, §7.10)
export * from "./validation/seismic";
export * from "./scheme/index";
export * from "./pipeline/index";

// NOTE: the manifest-integrity gate (validateManifest / checkManifestDir / crossReferenceCheck)
// is a Node-only build/CI tool — it imports node:fs/path/url + ajv. It is intentionally NOT in
// this barrel so the browser bundle (the SPA, P2) stays free of Node built-ins. Import it from
// the dedicated subpath instead:  import { checkManifestDir } from "@rebarconfig/core/integrity".
// (P2 split — see current_state.md §9 / D-P2-1.)
