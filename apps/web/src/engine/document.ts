/**
 * The active-element *document* — the editable state the UI mutates and the engine solves.
 *
 * P3 generalises P2's single column into a discriminated `ElementDoc` (column | beam), each
 * driven by a chosen **scheme** from the catalog (§5.3) and carrying a list of user-added
 * **supplements** (§5.5). It stays pure data (no engine objects), so it round-trips to `.rcfg`
 * later (P5). Units are SI internally (mm, mm², mm²/m); the UI converts at the edge.
 */
import type { LayoutPrinciple, BarRole, TransverseRegion, Splice } from "@rebarconfig/core";
import {
  GENERIC_SPECS,
  isGenericElement,
  type GenericElementId,
  type GenericSection,
} from "./elementSpecs";

/**
 * A3/H13 ([v1.0.4]) — the active code pack for this element. Additive + optional so every prior
 * `.rcfg` / doc loads as BAEL (default). BAEL↔EC2 swaps only the numbers behind the same `code.*`
 * names (D-P1-3); the structure is identical. The RPS seismic overlay composes on either base.
 */
export type CodePackId = "BAEL" | "EC2";

/** Seismic regime picked in the UI (§7.10); `null` = gravity-only. */
export interface SeismicEdit {
  /** overlay code, e.g. "RPS-2011". */
  code: string;
  /** seismic zone key into the overlay's a_g map. */
  zone: number;
  /** ductility class. */
  ductility: "ND1" | "ND2" | "ND3";
}

/**
 * One column/beam cross-tie (épingle), v1.0.2 F2 ([REF-DATA-756]). It engages two longitudinal
 * bars on opposite faces (bound by STABLE indices — D-P3-4) and is placed ON the line between
 * them. The engaged-face pair infers its direction (vertical TOP↔BOTTOM / horizontal LEFT↔RIGHT).
 * The hook angle is an element-level setting (`crossTieHookAngle`), applied to every cross-tie of
 * the element (owner decision, D-V102). `diameter` defaults to the tie/stirrup diameter.
 */
export interface CrossTie {
  barA: number;
  barB: number;
  diameter?: number;
}

export type { TransverseRegion, Splice };

/** F6 ([REF-DATA-520]) — a user end-hook choice on a longitudinal bar group (per end). */
export type HookChoice = "none" | 90 | 135 | 180;
export interface BarHooks {
  start: HookChoice;
  end: HookChoice;
}
/**
 * F6 façonnage on a longitudinal bar group: a chosen shape's user params + end hooks. Absent fields
 * fall back to the v1.0.1 default (computed params, manifest hooks) → legacy files byte-identical.
 */
export interface BarFaconnage {
  /** user-edited shape params keyed by the manifest param `key`; empty/absent → computed defaults. */
  shapeParams?: Record<string, number>;
  /** per-end hook override; absent → the shape manifest's own end hooks. */
  hooks?: BarHooks;
}

/**
 * v1.0.3 G2 ([REF-DATA-530]) — a per-bar override on ONE bar of a longitudinal group. `index` is the
 * STABLE solved-bar index (the same the F7 picker / cross-ties bind to, D-P3-4). Any subset of fields
 * may change: a different shape + façonnage, a unique absolute `length` + `axialPos`, a different Ø,
 * or `removed`. Absent list → the group is N identical bars (legacy byte-identical).
 */
export interface BarOverrideEdit {
  index: number;
  shapeId?: string;
  faconnage?: BarFaconnage;
  diameter?: number;
  /** unique absolute length (mm) — overrides the group run. */
  length?: number;
  /** axial start station (mm) along the member. */
  axialPos?: number;
  removed?: boolean;
}

/**
 * v1.0.3 G2 ([REF-DATA-530]) — an independent addressable bar, not part of any count-group. It owns
 * its section position `(u,v)` (the `v` is its **section level**, incl. an intermediate U-bar level),
 * shape + façonnage, Ø, and an optional unique length + axial position. A detailing add-on (rendered +
 * scheduled, but it does NOT change the layout/As — like a supplement).
 */
export interface AddressableBar {
  id: string;
  /** section position (mm) in the u–v frame; `v` is the level/depth. */
  u: number;
  v: number;
  shapeId: string;
  faconnage?: BarFaconnage;
  diameter: number;
  length?: number;
  axialPos?: number;
}

/**
 * v1.0.3 G3 ([REF-DATA-260]) — one beam support (V1 left / V2 right) with its OWN steel: an
 * over-support `chapeau` (top bars, with a support-zone `length` feeding the §7.7 curtailment), the
 * bottom-bar `anchorage` length into the support, and the support `width` (bearing). The two supports
 * may be asymmetric. A legacy single-`chapeau` beam migrates to symmetric `left = right` (migrateDoc).
 */
export interface SupportZone {
  chapeau: { enabled: boolean; diameter: number; nTop: number; asReq: number; length: number };
  /** bottom-bar anchorage length into this support (mm). */
  anchorage: number;
  /** support width / bearing (mm). */
  width: number;
}

/**
 * v1.0.3 G3 ([REF-DATA-260]) — a first-class bent-up bottom bar (relevé) near a support: a `RELEVE`
 * shaped bar with its own count + Ø, bending up at the chosen support. Rendered + scheduled as an
 * addressable bar (rides G2). Absent → no relevé (legacy byte-identical).
 */
export interface ReleveZone {
  id: string;
  /** which support the bar bends up at. */
  support: "left" | "right";
  count: number;
  diameter: number;
  asReq?: number;
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
  /** active code pack (BAEL default); absent → BAEL (A3/H13). */
  codePack?: CodePackId;
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
    /** F6 façonnage: user shape params + end hooks (absent → DROITE/computed default). */
    faconnage?: BarFaconnage;
    /** G2 per-bar overrides on individual bars of this group (absent → N identical bars). */
    barOverrides?: BarOverrideEdit[];
    /** G4 lap/coupler splice points along the bars (absent → unspliced). */
    splices?: Splice[];
    /** G4 auto-split when the fabricated run exceeds the stock length (default 12 m). */
    autoSplice?: boolean;
  };
  /** G2 independent addressable bars / extra section levels on this column (absent → none). */
  extraBars?: AddressableBar[];
  tie: {
    groupId: string;
    shapeId: string;
    diameter: number;
    spacing: number;
    aswReqPerM: number;
    /** F2 cross-ties (épingles) engaging real bar pairs; replaces the v1.0.1 `nLegs` number. */
    crossTies: CrossTie[];
    /** hook angle applied to every cross-tie of this element (90/135/180 or free); default 135. */
    crossTieHookAngle: number;
    /** F5 spacing regions along the height; absent → uniform `spacing` (byte-identical). */
    regions?: TransverseRegion[];
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
  /** active code pack (BAEL default); absent → BAEL (A3/H13). */
  codePack?: CodePackId;
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
    /** F6 façonnage: user shape params + end hooks (absent → DROITE/computed default). */
    faconnage?: BarFaconnage;
    /** G2 per-bar overrides on individual span bars (absent → N identical bars). */
    barOverrides?: BarOverrideEdit[];
    /** G4 lap/coupler splice points along the span bars (absent → unspliced). */
    splices?: Splice[];
    /** G4 auto-split when the fabricated run exceeds the stock length (default 12 m). */
    autoSplice?: boolean;
  };
  /** G2 independent addressable bars / extra section levels on this beam (absent → none). */
  extraBars?: AddressableBar[];
  /**
   * v1.0.3 G3 ([REF-DATA-260]) — the two beam supports (V1 left / V2 right), each with its own
   * chapeau + anchorage + width. Replaces the v1.0.2 single collapsed `chapeau`; a legacy doc migrates
   * to symmetric `left = right` (migrateDoc). The chapeau shape id is shared for both supports.
   */
  supports: { left: SupportZone; right: SupportZone };
  /** chapeau bar shape (shared by both supports). */
  chapeauShapeId: string;
  /** v1.0.3 G3 — bent-up bottom bars (relevés) near supports; absent → none. */
  releves?: ReleveZone[];
  /** shear stirrups along the length. */
  stirrup: {
    groupId: string;
    shapeId: string;
    diameter: number;
    spacing: number;
    aswReqPerM: number;
    /** F2 cross-ties (multi-leg stirrup legs) engaging real bar pairs; replaces `nLegs`. */
    crossTies: CrossTie[];
    /** hook angle applied to every cross-tie of this element (90/135/180 or free); default 135. */
    crossTieHookAngle: number;
    /** F5 spacing regions along the span; absent → uniform `spacing` (byte-identical). */
    regions?: TransverseRegion[];
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
  /** F5 spacing regions (transverse zones only); absent → uniform `spacing`. */
  regions?: TransverseRegion[];
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
  /** active code pack (BAEL default); absent → BAEL (A3/H13). */
  codePack?: CodePackId;
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
    tie: { groupId: "T1", shapeId: "CADRE_RECT", diameter: 8, spacing: 200, aswReqPerM: 300, crossTies: [], crossTieHookAngle: 135 },
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
    supports: {
      left: { chapeau: { enabled: withChapeau, diameter: 16, nTop: 2, asReq: 380, length: 1000 }, anchorage: 400, width: 300 },
      right: { chapeau: { enabled: withChapeau, diameter: 16, nTop: 2, asReq: 380, length: 1000 }, anchorage: 400, width: 300 },
    },
    chapeauShapeId: "CHAPEAU",
    releves: [],
    stirrup: { groupId: "S1", shapeId: "ETRIER", diameter: 8, spacing: 200, aswReqPerM: 300, crossTies: [], crossTieHookAngle: 135 },
    supplements: [],
  };
}

export function defaultDocFor(element: ElementId, scheme?: string): ElementDoc {
  if (element === "E-COL-01") return defaultColumnDoc(scheme ?? "COL_TIES_CROSSTIE");
  if (element === "E-BEM-01") return defaultBeamDoc(scheme ?? "BEAM_SPAN_CHAPEAUX_RELEVES");
  if (isGenericElement(element)) return defaultGenericDoc(element);
  return defaultColumnDoc(scheme ?? "COL_TIES_CROSSTIE");
}
