/**
 * The active-element *document* — the editable state the UI mutates and the engine solves.
 *
 * P3 generalises P2's single column into a discriminated `ElementDoc` (column | beam), each
 * driven by a chosen **scheme** from the catalog (§5.3) and carrying a list of user-added
 * **supplements** (§5.5). It stays pure data (no engine objects), so it round-trips to `.rcfg`
 * later (P5). Units are SI internally (mm, mm², mm²/m); the UI converts at the edge.
 */
import type { LayoutPrinciple } from "@rebarconfig/core";

/** One user-added supplemental add-on instance (§5.5), bound to base bars by STABLE indices. */
export interface SupplementEdit {
  instanceId: string;
  supplementId: string;
  /** base group whose resolved bars `barIndices` index into. */
  group: string;
  /** picked longitudinal bar indices (click-to-bind OR keyboard/index list — identical). */
  barIndices: number[];
  diameter: number;
  params?: Record<string, number>;
}

export interface MaterialEdit {
  f_c28: number;
  f_e: number;
}

// --- rectangular tied column (E-COL-01) -----------------------------------
export interface ColumnDoc {
  element: "E-COL-01";
  scheme: string;
  geometry: { b: number; h: number; H: number };
  material: MaterialEdit;
  cover: number;
  exposure: string;
  fire?: string;
  dg: number;
  longitudinal: {
    groupId: string;
    shapeId: string;
    diameter: number;
    principle: LayoutPrinciple;
    nTop: number;
    nBottom: number;
    nLeft: number;
    nRight: number;
    asReq: number;
  };
  tie: {
    groupId: string;
    shapeId: string;
    diameter: number;
    spacing: number;
    nLegs: number;
    aswReqPerM: number;
  };
  supplements: SupplementEdit[];
}

// --- rectangular beam (E-BEM-01) ------------------------------------------
export interface BeamDoc {
  element: "E-BEM-01";
  scheme: string;
  geometry: { b: number; h: number; L: number };
  material: MaterialEdit;
  cover: number;
  exposure: string;
  fire?: string;
  dg: number;
  /** span bottom (sagging) main steel. */
  span: {
    groupId: string;
    shapeId: string;
    diameter: number;
    nBottom: number;
    asReq: number;
    /** fraction of bottom bars carried past the support (§7.7). */
    continuedToSupport: number;
  };
  /** top support steel (chapeaux); present only when the scheme includes it. */
  chapeau: {
    enabled: boolean;
    groupId: string;
    shapeId: string;
    diameter: number;
    nTop: number;
    asReq: number;
    /** support-zone length feeding the curtailment extension (§7.7). */
    supportZone: number;
  };
  /** shear stirrups along the length. */
  stirrup: {
    groupId: string;
    shapeId: string;
    diameter: number;
    spacing: number;
    nLegs: number;
    aswReqPerM: number;
  };
  supplements: SupplementEdit[];
}

export type ElementId = "E-COL-01" | "E-BEM-01";
export type ElementDoc = ColumnDoc | BeamDoc;

export const isColumnDoc = (d: ElementDoc): d is ColumnDoc => d.element === "E-COL-01";
export const isBeamDoc = (d: ElementDoc): d is BeamDoc => d.element === "E-BEM-01";

/**
 * Default column = the P1 worked reference (current_state.md §9): b300×h600×H3000, FeE500/C25,
 * 6Ø20 (3/3/2/2) + Ø8 ties @200 — a known-good GREEN start.
 */
export function defaultColumnDoc(scheme = "COL_TIES_CROSSTIE"): ColumnDoc {
  return {
    element: "E-COL-01",
    scheme,
    geometry: { b: 300, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    dg: 20,
    longitudinal: {
      groupId: "L1",
      shapeId: "DROITE",
      diameter: 20,
      principle: "SYMMETRIC",
      nTop: 3,
      nBottom: 3,
      nLeft: 2,
      nRight: 2,
      asReq: 1800,
    },
    tie: { groupId: "T1", shapeId: "CADRE_RECT", diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    supplements: [],
  };
}

/** Default beam = b300×h600 over a 6 m span, 3Ø20 bottom + Ø8 stirrups @200, chapeaux 2Ø16. */
export function defaultBeamDoc(scheme = "BEAM_SPAN_CHAPEAUX_RELEVES"): BeamDoc {
  const withChapeau = scheme !== "BEAM_SPAN_SIMPLE";
  return {
    element: "E-BEM-01",
    scheme,
    geometry: { b: 300, h: 600, L: 6000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    dg: 20,
    span: { groupId: "B1", shapeId: "DROITE", diameter: 20, nBottom: 3, asReq: 900, continuedToSupport: 1 },
    chapeau: {
      enabled: withChapeau,
      groupId: "C1",
      shapeId: "CHAPEAU",
      diameter: 16,
      nTop: 2,
      asReq: 380,
      supportZone: 1000,
    },
    stirrup: { groupId: "S1", shapeId: "ETRIER", diameter: 8, spacing: 200, nLegs: 2, aswReqPerM: 300 },
    supplements: [],
  };
}

export function defaultDocFor(element: ElementId, scheme?: string): ElementDoc {
  return element === "E-BEM-01"
    ? defaultBeamDoc(scheme ?? "BEAM_SPAN_CHAPEAUX_RELEVES")
    : defaultColumnDoc(scheme ?? "COL_TIES_CROSSTIE");
}
