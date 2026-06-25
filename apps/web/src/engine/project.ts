/**
 * Phase 7 — the multi-element PROJECT model (spec §3.2 [REF-DATA-250]; D-P7-1).
 *
 * A real project holds many element *types*. The store keeps an ordered list of `ElementInstance`s
 * (each its own editable document + coupes + a fabrication `quantity`), with exactly one **active**
 * for editing. The engine stays a per-element pure function (no `if(elementType)`, no engine change):
 * the project is just a *container* of independent solves. `quantity` scales the steel TOTALS only
 * (one solve per type).
 *
 * The store uses a lightweight **checkout** model: the active instance's `doc`/`cuts` are "checked
 * out" into the top-level live editing state (`useStore.doc`/`cuts`) so every existing single-element
 * control keeps working unchanged; project-level reads reconcile the live state back first.
 */
import type { SectionCut } from "@rebarconfig/core";
import type { ElementDoc, ElementId } from "./document";

export interface ElementInstance {
  /** stable id (UI only — never an engine input). */
  id: string;
  /** the drawing mark / repère, e.g. "P1" (namespaces this type's BBS marks). */
  mark: string;
  /** number of identical members of this type — scales the steel TOTALS only. */
  quantity: number;
  doc: ElementDoc;
  cuts: SectionCut[];
}

/** Mark prefix per element family (poteau/poutre/dalle/…), so default marks read naturally. */
const MARK_PREFIX: Record<ElementId, string> = {
  "E-COL-01": "P",
  "E-COL-02": "P",
  "E-FND-01": "F",
  "E-BEM-01": "B",
  "E-SLB-01": "D",
  "E-SLB-02": "D",
  "E-SLB-03": "D",
  "E-STR-01": "ESC",
};

let _seq = 0;

/** A fresh instance id (module counter — deterministic within a session, never an engine input). */
export function nextInstanceId(): string {
  _seq += 1;
  return `inst-${_seq}`;
}

/** Default mark for a new instance of `element`, avoiding collisions with `existing` marks. */
export function defaultMark(element: ElementId, existing: readonly string[]): string {
  const prefix = MARK_PREFIX[element] ?? "E";
  let n = 1;
  const taken = new Set(existing);
  while (taken.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export function makeInstance(
  doc: ElementDoc,
  cuts: SectionCut[],
  mark: string,
  quantity = 1,
): ElementInstance {
  return { id: nextInstanceId(), mark, quantity, doc, cuts };
}
