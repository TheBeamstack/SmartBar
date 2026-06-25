/**
 * The active-element *document* — the editable state the UI mutates and the engine solves.
 *
 * P3 generalises P2's single column into a discriminated `ElementDoc` (column | beam), each
 * driven by a chosen **scheme** from the catalog (§5.3) and carrying a list of user-added
 * **supplements** (§5.5). It stays pure data (no engine objects), so it round-trips to `.rcfg`
 * later (P5). Units are SI internally (mm, mm², mm²/m); the UI converts at the edge.
 */
import type { LayoutPrinciple, BarRole } from "@rebarconfig/core";
import {
  GENERIC_SPECS,
  isGenericElement,
  type GenericElementId,
  type GenericSection,
} from "./elementSpecs";

/** Seismic regime picked in the UI (§7.10); `null` = gravity-only. */
export interface SeismicEdit {
  /** overlay code, e.g. "RPS-2011". */
  code: string;
  /** seismic zone key into the overlay's a_g map. */
  zone: number;
  /** ductility class. */
  ductility: "ND1" | "ND2" | "ND3";
}

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
  /** seismic regime (§7.10); absent/undefined = gravity-only. */
  seismic?: SeismicEdit;
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
  /** seismic regime (§7.10); absent/undefined = gravity-only. */
  seismic?: SeismicEdit;
  /** dedicated full-length top (montage/compression) bars, separate from the chapeaux (8b). */
  topBars: {
    enabled: boolean;
    groupId: string;
    diameter: number;
    nTop: number;
  };
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

// --- generic non-rect element (circular / slab / joist / stair) -----------
/** One editable reinforcement zone of a generic element (mirrors elementSpecs.ZoneSpec at runtime). */
export interface ZoneEdit {
  zone: string;
  groupId: string;
  label_fr: string;
  label_en: string;
  role: BarRole;
  shapeId: string;
  kind: "longitudinal" | "transverse";
  slabRole?: "MAIN" | "SECONDARY" | "TOP";
  primary?: boolean;
  control: "count" | "spacing";
  diameter: number;
  count?: number;
  spacing?: number;
  asReq?: number;
  asReqPerM?: number;
  nLegs?: number;
}

/**
 * The six non-rect elements share ONE doc shape (the spec lives in elementSpecs.ts). `geometry` is a
 * flat key→mm map (keys from the element's `geometryParams`); `zones` are the editable bar groups.
 */
export interface GenericDoc {
  element: GenericElementId;
  section: GenericSection;
  profile: string;
  scheme: string;
  geometry: Record<string, number>;
  material: MaterialEdit;
  cover: number;
  exposure: string;
  fire?: string;
  dg: number;
  zones: ZoneEdit[];
  /** two-way slab: a restrained discontinuous corner is present. */
  restrainedCorner?: boolean;
  /** two-way slab: provided corner-torsion steel (mm²). */
  cornerTorsionProvided?: number;
  /** stair: main bottom bar continuous AROUND the re-entrant corner (the unsafe wrap). */
  mainBarWrapsCorner?: boolean;
  supplements: SupplementEdit[];
}

export type ElementId =
  | "E-COL-01"
  | "E-BEM-01"
  | "E-COL-02"
  | "E-FND-01"
  | "E-SLB-01"
  | "E-SLB-02"
  | "E-SLB-03"
  | "E-STR-01";
export type ElementDoc = ColumnDoc | BeamDoc | GenericDoc;

export const isColumnDoc = (d: ElementDoc): d is ColumnDoc => d.element === "E-COL-01";
export const isBeamDoc = (d: ElementDoc): d is BeamDoc => d.element === "E-BEM-01";
export const isGenericDoc = (d: ElementDoc): d is GenericDoc =>
  d.element !== "E-COL-01" && d.element !== "E-BEM-01";

/** Build the default generic doc from its spec (geometry defaults + a copy of its zones). */
export function defaultGenericDoc(element: GenericElementId): GenericDoc {
  const spec = GENERIC_SPECS[element];
  const geometry: Record<string, number> = {};
  for (const f of spec.geometry) geometry[f.key] = f.default;
  return {
    element: spec.element,
    section: spec.section,
    profile: spec.profile,
    scheme: spec.scheme,
    geometry,
    material: { f_c28: 25, f_e: 500 },
    cover: spec.section === "CIRCULAR" ? 40 : 25,
    exposure: spec.section === "CIRCULAR" ? "EXTERIOR" : "INTERIOR",
    dg: 20,
    zones: spec.zones.map((z) => ({ ...z })),
    ...(spec.flags.restrainedCorner !== undefined ? { restrainedCorner: spec.flags.restrainedCorner } : {}),
    ...(spec.flags.cornerTorsionProvided !== undefined ? { cornerTorsionProvided: spec.flags.cornerTorsionProvided } : {}),
    ...(spec.flags.mainBarWrapsCorner !== undefined ? { mainBarWrapsCorner: spec.flags.mainBarWrapsCorner } : {}),
    supplements: [],
  };
}

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
    topBars: { enabled: false, groupId: "M1", diameter: 12, nTop: 2 },
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
  if (element === "E-COL-01") return defaultColumnDoc(scheme ?? "COL_TIES_CROSSTIE");
  if (element === "E-BEM-01") return defaultBeamDoc(scheme ?? "BEAM_SPAN_CHAPEAUX_RELEVES");
  if (isGenericElement(element)) return defaultGenericDoc(element);
  return defaultColumnDoc(scheme ?? "COL_TIES_CROSSTIE");
}
