/**
 * Adapter: ElementDoc ⇄ `.rcfg` project envelope (spec §10), for the SPA's save/load + autosave.
 *
 * The web app's editable state is the `ElementDoc` (a UI-convenience shape, document.ts). The
 * on-disk format is the canonical §10 `RcfgDocument` (types/rcfg.ts). This adapter bridges the two:
 *
 *  - **Lossless SPA round-trip** rides on `meta.app_document`: the full `ElementDoc` is carried in a
 *    namespaced meta field, so a save→load restores the exact editable state (geometry, scheme,
 *    supplements, …) without reverse-engineering the §10 reinforcement arrays back into a doc.
 *  - **Canonical §10 fields are populated faithfully** for interchange — region/codePack/seismic/
 *    units/element (type, geometry, material, cover, `As_req` per zone)/reinforcement (schemeId,
 *    mode). The full `reinforcement.baseGroups[]` ReinforcingElement mapping is DEFERRED (P6); the
 *    SPA does not need it (it reloads from `app_document`), and forward-compat (§10) is preserved by
 *    the envelope's index signature + the meta carry. See current_state.md D-P5-7.
 *  - **Forward-compat (NORMATIVE, §10):** unknown top-level fields / kinds / cut fields survive,
 *    because `parseRcfg`/`serializeRcfg` are JSON in/out and `rcfgToDoc` only *reads* `app_document`.
 */
import type { RcfgProject } from "@rebarconfig/exporters";
import type { SectionCut } from "@rebarconfig/core";
import {
  type ElementDoc,
  type ElementId,
  isColumnDoc,
  isGenericDoc,
} from "./document";

/** The namespaced meta key carrying the verbatim ElementDoc for a lossless SPA reload. */
export const APP_DOCUMENT_KEY = "app_document";

const REGION = "FR";
const CODE_PACK = "BAEL-FR"; // v1.0 = BAEL only (EC2 is wired engine-side; UI picker is P6)

/** Per-zone required steel (mm² for longitudinal, mm²/m for transverse) — the canonical `As_req`. */
function asReqOf(doc: ElementDoc): Record<string, number> {
  if (isColumnDoc(doc)) {
    return { As_total: doc.longitudinal.asReq, Asw_confinement: doc.tie.aswReqPerM };
  }
  if (isGenericDoc(doc)) {
    const req: Record<string, number> = {};
    for (const z of doc.zones) req[z.zone] = z.asReq ?? z.asReqPerM ?? 0;
    return req;
  }
  const req: Record<string, number> = {
    As_span_bottom: doc.span.asReq,
    Asw_shear: doc.stirrup.aswReqPerM,
  };
  if (doc.chapeau.enabled) req["As_top_support"] = doc.chapeau.asReq;
  return req;
}

/**
 * Build a `.rcfg` project from the current editable doc + user coupes. The canonical §10 fields are
 * populated; the verbatim doc rides in `meta.app_document` for a lossless SPA reload.
 */
export function docToRcfg(
  doc: ElementDoc,
  sectionCuts: SectionCut[],
  meta: { projectName?: string; drawnBy?: string } = {},
): RcfgProject {
  return {
    rcfg_version: "1.0",
    region: REGION,
    codePack: CODE_PACK,
    seismic: null, // gravity (no seismic regime picker in the UI yet — D-P4b-5)
    units: { length: "mm", area: "mm2" },
    element: {
      type: doc.element,
      geometry: { ...doc.geometry },
      material: {
        f_c28: doc.material.f_c28,
        f_e: doc.material.f_e,
        exposure: doc.exposure,
        d_g: doc.dg,
        ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
      },
      cover_mm: doc.cover,
      As_req: asReqOf(doc),
    },
    reinforcement: {
      schemeId: doc.scheme,
      mode: "guided",
      // Canonical ReinforcingElement[] population is deferred (P6) — the SPA reloads from
      // meta.app_document, and §10 forward-compat is preserved by the envelope index signature.
      baseGroups: [],
      supplementalGroups: [],
    },
    section_cuts: sectionCuts,
    meta: {
      ...(meta.projectName !== undefined ? { projectName: meta.projectName } : {}),
      ...(meta.drawnBy !== undefined ? { drawnBy: meta.drawnBy } : {}),
      [APP_DOCUMENT_KEY]: doc,
    },
  };
}

const ELEMENT_IDS: ReadonlySet<string> = new Set<ElementId>([
  "E-COL-01", "E-BEM-01", "E-COL-02", "E-FND-01", "E-SLB-01", "E-SLB-02", "E-SLB-03", "E-STR-01",
]);

/**
 * Recover the editable `ElementDoc` from a parsed project. Reads the lossless `meta.app_document`
 * carry; returns `undefined` if the file has none (e.g. a future file authored by another tool that
 * only wrote the canonical §10 arrays — the SPA can't yet reconstruct a doc from those, P6).
 */
export function rcfgToDoc(project: RcfgProject): ElementDoc | undefined {
  const meta = project.meta as Record<string, unknown> | undefined;
  const carried = meta?.[APP_DOCUMENT_KEY];
  if (
    carried &&
    typeof carried === "object" &&
    ELEMENT_IDS.has((carried as { element?: unknown }).element as string)
  ) {
    return carried as ElementDoc;
  }
  return undefined;
}
