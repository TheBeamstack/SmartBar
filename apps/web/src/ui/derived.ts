/**
 * UI-edge derivations (spec §2.3 "SI internally, convert at the edge"). The engine stores
 * mm / mm²; these helpers convert to the French display units (geometry mm, steel area cm²)
 * and pull the live badge values out of the SolveResult. Pure — no React.
 *
 * Generic over the element: the "primary" flexural zone is the column's As_total or the beam's
 * As_span_bottom; its provided-area rule and computed `d` drive the badges.
 */
import { barArea, type SolveResult } from "@rebarconfig/core";
import { type ElementDoc, isColumnDoc } from "../engine/document";

export const MM2_TO_CM2 = 0.01;

/** The primary flexural zone's provided_area rule id + the doc's required steel + its φ. */
function primaryZone(doc: ElementDoc): { rule: string; asReq: number; diameter: number; groupId: string } {
  if (isColumnDoc(doc)) {
    return {
      rule: "provided_area",
      asReq: doc.longitudinal.asReq,
      diameter: doc.longitudinal.diameter,
      groupId: doc.longitudinal.groupId,
    };
  }
  return {
    rule: "provided_area:As_span_bottom",
    asReq: doc.span.asReq,
    diameter: doc.span.diameter,
    groupId: doc.span.groupId,
  };
}

/** As,provided (mm²) of the primary flexural zone — from its provided_area rule, with fallback. */
export function asProvidedMm2(result: SolveResult, doc: ElementDoc): number {
  const pz = primaryZone(doc);
  const rule = result.validation.find((v) => v.rule === pz.rule);
  if (rule && typeof rule.value === "number") return rule.value;
  const grp = result.groups.find((g) => g.groupId === pz.groupId);
  return grp ? grp.count * barArea(pz.diameter) : 0;
}

export function asReqMm2(doc: ElementDoc): number {
  return primaryZone(doc).asReq;
}

/** Effective depth d (mm) of the primary flexural zone ([REF-SYS-611]). */
export function effectiveDepthMm(result: SolveResult): number | null {
  const z = result.zones[0];
  return z ? z.d : null;
}

export function cm2(mm2: number): string {
  return (mm2 * MM2_TO_CM2).toFixed(2);
}

/** Does As,prov meet As,req? (badge tone). */
export function meetsAsReq(result: SolveResult, doc: ElementDoc): boolean {
  return asProvidedMm2(result, doc) >= asReqMm2(doc) - 1e-6;
}
