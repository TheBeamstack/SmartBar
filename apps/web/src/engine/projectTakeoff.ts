/**
 * Phase 7 — project steel takeoff (spec §9.1 [REF-SYS-915]; D-P7-1).
 *
 * Per element TYPE: unit steel mass (kg) + steel density (kg/m³ = unit mass / concrete volume) +
 * total mass = quantity × unit. Plus project grand totals (steel kg, concrete m³, overall ratio).
 * `quantity` scales TOTALS only — there is ONE pure solve per type (the engine stays per-element).
 */
import { computeBBS } from "@rebarconfig/exporters";
import { solveDoc } from "./solveDoc";
import type { ElementInstance } from "./project";

export interface TypeTakeoff {
  id: string;
  mark: string;
  element: string;
  quantity: number;
  /** steel mass of ONE member (kg). */
  unitMass_kg: number;
  /** steel mass of all `quantity` members (kg). */
  totalMass_kg: number;
  /** concrete volume of ONE member (m³). */
  unitConcrete_m3: number;
  /** steel density of this type (kg/m³ = unit mass / unit concrete). */
  steelDensity_kg_m3: number;
  status: "PASS" | "WARN" | "FAIL";
}

export interface ProjectTakeoff {
  types: TypeTakeoff[];
  totalSteel_kg: number;
  totalConcrete_m3: number;
  /** overall project steel ratio (kg/m³). */
  overallRatio_kg_m3: number;
  /** any type in a hard-FAIL state — blocks the combined export (per-project lock, §9.3). */
  anyFail: boolean;
}

export function projectTakeoff(instances: readonly ElementInstance[]): ProjectTakeoff {
  const types: TypeTakeoff[] = instances.map((inst) => {
    const result = solveDoc(inst.doc);
    const bbs = computeBBS(result);
    const unitMass = bbs.summary.totalWeight_kg;
    const unitConcrete = bbs.summary.concreteVolume_m3;
    return {
      id: inst.id,
      mark: inst.mark,
      element: inst.doc.element,
      quantity: inst.quantity,
      unitMass_kg: unitMass,
      totalMass_kg: unitMass * inst.quantity,
      unitConcrete_m3: unitConcrete,
      steelDensity_kg_m3: unitConcrete > 0 ? unitMass / unitConcrete : 0,
      status: result.status,
    };
  });

  const totalSteel = types.reduce((s, t) => s + t.totalMass_kg, 0);
  const totalConcrete = types.reduce((s, t) => s + t.unitConcrete_m3 * t.quantity, 0);
  return {
    types,
    totalSteel_kg: totalSteel,
    totalConcrete_m3: totalConcrete,
    overallRatio_kg_m3: totalConcrete > 0 ? totalSteel / totalConcrete : 0,
    anyFail: types.some((t) => t.status === "FAIL"),
  };
}
