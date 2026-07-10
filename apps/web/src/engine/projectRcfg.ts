/**
 * Phase 7 — the `.rcfg` PROJECT envelope (spec §10; D-P7-1). `rcfg_version "1.1"` adds a top-level
 * `elements[]` (one per type, each a full §10 per-element document + its `mark`/`quantity`). The
 * top-level fields mirror the FIRST element so a legacy v1.0 single-element reader still loads
 * something sensible; a v1.1 reader reads `elements[]`. A legacy v1.0 file (no `elements[]`) migrates
 * to a one-instance project. Forward-compat: unknown fields/kinds/instances are preserved (D-P0-2).
 */
import type { RcfgProject } from "@rebarconfig/exporters";
import type { SectionCut, SolveResult } from "@rebarconfig/core";
import { docToRcfg, rcfgToDoc } from "./rcfgDoc";
import { makeInstance, defaultMark, type ElementInstance } from "./project";

export const PROJECT_RCFG_VERSION = "1.1";

/** One element entry inside a v1.1 project envelope (a per-element doc + its mark/quantity). */
export type RcfgElementEntry = RcfgProject & { mark?: string; quantity?: number };

/** A v1.1 project: the legacy single-element envelope + an additive `elements[]`. */
export interface RcfgProjectEnvelope extends RcfgProject {
  elements?: RcfgElementEntry[];
}

export function projectToRcfg(
  instances: readonly ElementInstance[],
  meta: { projectName?: string; drawnBy?: string } = {},
  /** v1.0.5 M7: live solved results by instance id (e.g. the active instance's store `result`) — passed
   *  to `docToRcfg` to STOP the double-solve for those instances; others re-solve as before. */
  resultsById?: Record<string, SolveResult>,
): RcfgProjectEnvelope {
  const elements: RcfgElementEntry[] = instances.map((inst) => ({
    ...docToRcfg(inst.doc, inst.cuts, meta, resultsById?.[inst.id]),
    mark: inst.mark,
    quantity: inst.quantity,
  }));
  const first = instances[0]
    ? docToRcfg(instances[0].doc, instances[0].cuts, meta, resultsById?.[instances[0].id])
    : ({} as RcfgProject);
  return { ...first, rcfg_version: PROJECT_RCFG_VERSION, elements };
}

/**
 * Recover the editable instances from a parsed project. v1.1 → read `elements[]`; legacy v1.0 (no
 * `elements[]`) → migrate the single element to a one-instance project. Returns `undefined` if no
 * instance is recoverable (a future/other-tool file with no `meta.app_document`, like rcfgToDoc).
 */
export function rcfgToInstances(project: RcfgProjectEnvelope): ElementInstance[] | undefined {
  const raw = (project as { elements?: unknown }).elements;
  if (Array.isArray(raw) && raw.length > 0) {
    const out: ElementInstance[] = [];
    for (const entry of raw as RcfgElementEntry[]) {
      const doc = rcfgToDoc(entry);
      if (!doc) continue;
      const cuts = (entry.section_cuts ?? []) as SectionCut[];
      const mark = entry.mark ?? defaultMark(doc.element, out.map((i) => i.mark));
      out.push(makeInstance(doc, cuts, mark, entry.quantity ?? 1));
    }
    return out.length > 0 ? out : undefined;
  }
  // legacy v1.0 single element → one-instance project
  const doc = rcfgToDoc(project);
  if (!doc) return undefined;
  const cuts = (project.section_cuts ?? []) as SectionCut[];
  return [makeInstance(doc, cuts, defaultMark(doc.element, []))];
}
