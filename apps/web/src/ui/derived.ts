/**
 * UI-edge derivations (spec §2.3 "SI internally, convert at the edge"). The engine stores
 * mm / mm²; these helpers convert to the French display units (geometry mm, steel area cm²)
 * and pull the live badge values out of the SolveResult. Pure — no React.
 */
import { barArea, type SolveResult } from "@rebarconfig/core";
import type { ColumnDoc } from "../engine/document";

export const MM2_TO_CM2 = 0.01;

/** As,provided (mm²) — straight from the provided_area rule, fallback to n·area(φ). */
export function asProvidedMm2(result: SolveResult, doc: ColumnDoc): number {
  const rule = result.validation.find((v) => v.rule === "provided_area");
  if (rule && typeof rule.value === "number") return rule.value;
  const long = result.groups.find((g) => g.role === "PRIMARY_LONGITUDINAL");
  return long ? long.count * barArea(doc.longitudinal.diameter) : 0;
}

export function asReqMm2(doc: ColumnDoc): number {
  return doc.longitudinal.asReq;
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
export function meetsAsReq(result: SolveResult, doc: ColumnDoc): boolean {
  return asProvidedMm2(result, doc) >= asReqMm2(doc) - 1e-6;
}
