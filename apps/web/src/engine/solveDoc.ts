/**
 * Adapter: ColumnDoc -> engine ColumnSolveInput -> SolveResult. Pure (no React/DOM/three) so
 * it is exercised headlessly by store_resolve / perf_budget tests and reused by the store.
 *
 * The engine is consumed UNCHANGED (current_state.md §9 "→ Next agent"): this adapter only
 * marshals the document + injects the BAEL pack and the referenced shape archetypes. No
 * geometry or validation math lives here — that all stays in @rebarconfig/core.
 */
import { solveColumn, type SolveResult } from "@rebarconfig/core";
import { makeBaelPack, type BaelPack } from "@rebarconfig/codepacks";
import type { ColumnDoc } from "./document";
import { loadShape } from "./manifests";

/** The active code pack. v1.0/P2 = BAEL-FR only (EC2 is P4); built once, it is pure data+fns. */
export const baelPack: BaelPack = makeBaelPack();

export function solveDoc(doc: ColumnDoc, code: BaelPack = baelPack): SolveResult {
  return solveColumn({
    element: doc.element,
    geometry: doc.geometry,
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    longitudinal: {
      groupId: doc.longitudinal.groupId,
      shape: loadShape(doc.longitudinal.shapeId),
      diameter: doc.longitudinal.diameter,
      layout: {
        principle: doc.longitudinal.principle,
        nTop: doc.longitudinal.nTop,
        nBottom: doc.longitudinal.nBottom,
        nLeft: doc.longitudinal.nLeft,
        nRight: doc.longitudinal.nRight,
      },
      asReq: doc.longitudinal.asReq,
    },
    tie: {
      groupId: doc.tie.groupId,
      shape: loadShape(doc.tie.shapeId),
      diameter: doc.tie.diameter,
      spacing: doc.tie.spacing,
      nLegs: doc.tie.nLegs,
      aswReqPerM: doc.tie.aswReqPerM,
    },
    code,
  });
}

export type { SolveResult };
