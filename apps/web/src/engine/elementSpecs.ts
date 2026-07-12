/**
 * Data-driven specs for the six non-rect elements (circular column, pile, one/two-way slab, joist
 * slab, stair). The rectangular column (E-COL-01) and beam (E-BEM-01) keep their bespoke docs +
 * controls (document.ts); these six share ONE generic doc shape (`GenericDoc`) whose editable
 * surface — every geometry parameter and every reinforcement zone (Ø + count/spacing + As,req) — is
 * declared here ONCE and consumed by both the default-document factory and the Sidebar controls.
 *
 * This embodies the §0.1 "everything is data" thesis on the UI edge: a new element becomes a new
 * spec entry (+ its manifests + a pipeline that already exists in core), not new bespoke React.
 * Default values are chosen to land GREEN (the reference cases in tests/*.spec.ts).
 */
import type { BarRole } from "@rebarconfig/core";

export type GenericSection = "CIRCULAR" | "SLAB" | "JOIST" | "STAIR";
export type GenericElementId = "E-COL-02" | "E-FND-01" | "E-SLB-01" | "E-SLB-02" | "E-SLB-03" | "E-STR-01";

/** A single numeric geometry field (rendered as a NumberField in the Géométrie tab). */
export interface GeomField {
  key: string;
  label_fr: string;
  label_en: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/** A reinforcement zone's editable spec — drives both the default doc and its Sidebar controls. */
export interface ZoneSpec {
  /** As_zone key (the engine zone id); transverse spirals may reuse a synthetic key. */
  zone: string;
  groupId: string;
  label_fr: string;
  label_en: string;
  role: BarRole;
  shapeId: string;
  kind: "longitudinal" | "transverse";
  /** slab-family validation role (MAIN drives distribution-min; SECONDARY relaxes spacing). */
  slabRole?: "MAIN" | "SECONDARY" | "TOP";
  /** circular: the pitch-circle zone that gets min-bars / arc-spacing checks. */
  primary?: boolean;
  /** control kind: circular longitudinal = bar COUNT; everything else = bar SPACING (mm). */
  control: "count" | "spacing";
  diameter: number;
  count?: number;
  spacing?: number;
  /** required steel: mm² for circular longitudinal, mm²/m for slab-family + transverse. */
  asReq?: number;
  asReqPerM?: number;
  nLegs?: number;
  /** v1.0.6-fix R9 (F-H): the span a two-way-slab zone reinforces ("x"/"y") — lets a placed band's
   *  `spanAxis` credit the right direction where an x-zone and a y-zone share a level. Absent → one-way. */
  axis?: "x" | "y";
}

export interface GenericSpec {
  element: GenericElementId;
  section: GenericSection;
  profile: string;
  scheme: string;
  geometry: GeomField[];
  zones: ZoneSpec[];
  /** element-specific construction flags surfaced as checkboxes / a numeric field. */
  flags: {
    restrainedCorner?: boolean;
    cornerTorsionProvided?: number;
    mainBarWrapsCorner?: boolean;
  };
}

const g = (key: string, fr: string, en: string, def: number, min: number, max: number, step: number): GeomField => ({
  key, label_fr: fr, label_en: en, default: def, min, max, step,
});

export const GENERIC_SPECS: Record<GenericElementId, GenericSpec> = {
  // ---- circular spiral column (E-COL-02) ----------------------------------
  "E-COL-02": {
    element: "E-COL-02",
    section: "CIRCULAR",
    profile: "CIRCULAR_COLUMN",
    scheme: "COL_SPIRAL",
    geometry: [
      g("D", "Diamètre", "Diameter", 600, 300, 1500, 10),
      g("H", "Hauteur", "Height", 3000, 500, 8000, 50),
    ],
    zones: [
      { zone: "As_total", groupId: "L1", label_fr: "Aciers longitudinaux", label_en: "Longitudinal bars", role: "PRIMARY_LONGITUDINAL", shapeId: "DROITE", kind: "longitudinal", primary: true, control: "count", diameter: 20, count: 8, asReq: 1500 },
      { zone: "Asw_spiral", groupId: "SP1", label_fr: "Spirale de confinement", label_en: "Confinement spiral", role: "TRANSVERSE", shapeId: "SPIRALE_HELICE", kind: "transverse", control: "spacing", diameter: 10, spacing: 100, asReqPerM: 0, nLegs: 2 },
    ],
    flags: {},
  },
  // ---- drilled-shaft pile (E-FND-01) --------------------------------------
  "E-FND-01": {
    element: "E-FND-01",
    section: "CIRCULAR",
    profile: "CIRCULAR_COLUMN",
    scheme: "PILE_CAGE",
    geometry: [
      g("D", "Diamètre", "Diameter", 800, 300, 2000, 50),
      g("L", "Longueur", "Length", 12000, 2000, 30000, 100),
    ],
    zones: [
      { zone: "As_longitudinal", groupId: "L1", label_fr: "Aciers longitudinaux", label_en: "Longitudinal bars", role: "PRIMARY_LONGITUDINAL", shapeId: "DROITE", kind: "longitudinal", primary: true, control: "count", diameter: 20, count: 10, asReq: 2000 },
      { zone: "As_dowels", groupId: "DW1", label_fr: "Aciers en attente", label_en: "Dowel / starter bars", role: "STARTER", shapeId: "ATTENTE", kind: "longitudinal", control: "count", diameter: 20, count: 10, asReq: 0 },
      { zone: "Asw_spiral", groupId: "SP1", label_fr: "Spirale de confinement", label_en: "Confinement spiral", role: "TRANSVERSE", shapeId: "SPIRALE_HELICE", kind: "transverse", control: "spacing", diameter: 10, spacing: 150, asReqPerM: 0, nLegs: 2 },
    ],
    flags: {},
  },
  // ---- one-way solid slab (E-SLB-01) --------------------------------------
  "E-SLB-01": {
    element: "E-SLB-01",
    section: "SLAB",
    profile: "SLAB_ONEWAY",
    scheme: "SLAB_ONEWAY_STD",
    geometry: [
      g("Lx", "Portée (sens porteur)", "Span (load direction)", 5000, 1000, 12000, 100),
      g("Ly", "Largeur", "Width", 3000, 1000, 12000, 100),
      g("t", "Épaisseur", "Thickness", 200, 100, 500, 10),
    ],
    zones: [
      { zone: "As_main_bottom", groupId: "M1", label_fr: "Aciers principaux (travée, bas)", label_en: "Main bottom steel", role: "PRIMARY_LONGITUDINAL", shapeId: "DROITE", kind: "longitudinal", slabRole: "MAIN", control: "spacing", diameter: 12, spacing: 150, asReqPerM: 700 },
      { zone: "As_dist", groupId: "D1", label_fr: "Aciers de répartition", label_en: "Distribution steel", role: "DISTRIBUTION", shapeId: "DROITE", kind: "longitudinal", slabRole: "SECONDARY", control: "spacing", diameter: 8, spacing: 250, asReqPerM: 50 },
      { zone: "As_top_support", groupId: "T1", label_fr: "Chapeaux sur appui", label_en: "Top support steel", role: "PRIMARY_LONGITUDINAL", shapeId: "CHAPEAU", kind: "longitudinal", slabRole: "TOP", control: "spacing", diameter: 10, spacing: 200, asReqPerM: 200 },
    ],
    flags: {},
  },
  // ---- two-way solid slab (E-SLB-02) --------------------------------------
  "E-SLB-02": {
    element: "E-SLB-02",
    section: "SLAB",
    profile: "SLAB_TWOWAY",
    scheme: "SLAB_TWOWAY_STD",
    geometry: [
      g("Lx", "Portée X", "Span X", 5000, 1000, 12000, 100),
      g("Ly", "Portée Y", "Span Y", 5000, 1000, 12000, 100),
      g("t", "Épaisseur", "Thickness", 200, 100, 500, 10),
    ],
    zones: [
      { zone: "As_main_x_bot", groupId: "MX", label_fr: "Aciers principaux X (bas)", label_en: "Main X bottom", role: "PRIMARY_LONGITUDINAL", shapeId: "TREILLIS_MESH", kind: "longitudinal", slabRole: "MAIN", control: "spacing", diameter: 10, spacing: 150, asReqPerM: 400, axis: "x" },
      { zone: "As_main_y_bot", groupId: "MY", label_fr: "Aciers principaux Y (bas)", label_en: "Main Y bottom", role: "PRIMARY_LONGITUDINAL", shapeId: "TREILLIS_MESH", kind: "longitudinal", slabRole: "MAIN", control: "spacing", diameter: 10, spacing: 150, asReqPerM: 400, axis: "y" },
      { zone: "As_top_x", groupId: "TX", label_fr: "Chapeaux X", label_en: "Top X", role: "PRIMARY_LONGITUDINAL", shapeId: "TREILLIS_MESH", kind: "longitudinal", slabRole: "TOP", control: "spacing", diameter: 10, spacing: 200, asReqPerM: 200, axis: "x" },
      { zone: "As_top_y", groupId: "TY", label_fr: "Chapeaux Y", label_en: "Top Y", role: "PRIMARY_LONGITUDINAL", shapeId: "TREILLIS_MESH", kind: "longitudinal", slabRole: "TOP", control: "spacing", diameter: 10, spacing: 200, asReqPerM: 200, axis: "y" },
    ],
    flags: { restrainedCorner: true, cornerTorsionProvided: 300 },
  },
  // ---- hollow-block joist slab (E-SLB-03) ---------------------------------
  "E-SLB-03": {
    element: "E-SLB-03",
    section: "JOIST",
    profile: "JOIST_SLAB",
    scheme: "JOIST_STD",
    geometry: [
      g("L", "Portée", "Span", 4500, 2000, 9000, 100),
      g("t_total", "Épaisseur totale", "Total thickness", 250, 150, 400, 10),
      g("t_topping", "Dalle de compression", "Topping thickness", 50, 40, 100, 5),
      g("b_joist", "Largeur de nervure", "Joist (rib) width", 100, 80, 200, 5),
      g("block_w", "Largeur de hourdis", "Block width", 500, 300, 700, 10),
      g("block_h", "Hauteur de hourdis", "Block height", 200, 120, 300, 10),
      g("joist_spacing", "Entraxe des nervures", "Joist spacing", 600, 400, 800, 10),
    ],
    zones: [
      { zone: "As_joist_bottom", groupId: "JB", label_fr: "Aciers inférieurs de nervure", label_en: "Joist bottom steel", role: "PRIMARY_LONGITUDINAL", shapeId: "DROITE", kind: "longitudinal", slabRole: "MAIN", control: "spacing", diameter: 12, spacing: 300, asReqPerM: 150 },
      { zone: "As_joist_top_support", groupId: "JT", label_fr: "Chapeaux de nervure", label_en: "Joist top support", role: "PRIMARY_LONGITUDINAL", shapeId: "CHAPEAU", kind: "longitudinal", slabRole: "TOP", control: "spacing", diameter: 10, spacing: 300, asReqPerM: 100 },
      { zone: "As_topping_mesh", groupId: "TM", label_fr: "Treillis de compression", label_en: "Topping mesh", role: "DISTRIBUTION", shapeId: "TREILLIS_MESH", kind: "longitudinal", slabRole: "SECONDARY", control: "spacing", diameter: 8, spacing: 150, asReqPerM: 30 },
    ],
    flags: {},
  },
  // ---- straight-flight stair (E-STR-01) -----------------------------------
  "E-STR-01": {
    element: "E-STR-01",
    section: "STAIR",
    profile: "STAIR",
    scheme: "STAIR_STD",
    geometry: [
      g("g", "Giron", "Going", 280, 200, 350, 5),
      g("r", "Contremarche", "Riser", 170, 140, 200, 5),
      g("n_steps", "Nombre de marches", "Number of steps", 14, 3, 30, 1),
      g("waist_t", "Épaisseur paillasse", "Waist thickness", 180, 120, 300, 10),
      g("flight_width", "Largeur de volée", "Flight width", 1200, 800, 2000, 50),
      g("landing_L", "Longueur de palier", "Landing length", 1000, 0, 2500, 50),
    ],
    zones: [
      { zone: "As_main_bottom", groupId: "M1", label_fr: "Aciers principaux (volée, bas)", label_en: "Main bottom steel", role: "PRIMARY_LONGITUDINAL", shapeId: "MARCHE_PALIER", kind: "longitudinal", slabRole: "MAIN", control: "spacing", diameter: 12, spacing: 150, asReqPerM: 600 },
      { zone: "As_dist", groupId: "D1", label_fr: "Aciers de répartition", label_en: "Distribution steel", role: "DISTRIBUTION", shapeId: "DROITE", kind: "longitudinal", slabRole: "SECONDARY", control: "spacing", diameter: 8, spacing: 250, asReqPerM: 120 },
      { zone: "As_top_support", groupId: "T1", label_fr: "Chapeaux sur appui", label_en: "Top support steel", role: "PRIMARY_LONGITUDINAL", shapeId: "CHAPEAU", kind: "longitudinal", slabRole: "TOP", control: "spacing", diameter: 10, spacing: 200, asReqPerM: 300 },
      { zone: "As_starter", groupId: "ST1", label_fr: "Aciers en attente", label_en: "Starter bars", role: "STARTER", shapeId: "ATTENTE", kind: "longitudinal", slabRole: "SECONDARY", control: "spacing", diameter: 10, spacing: 200, asReqPerM: 0 },
    ],
    flags: { mainBarWrapsCorner: false },
  },
};

export const GENERIC_ELEMENT_IDS = Object.keys(GENERIC_SPECS) as GenericElementId[];

export function isGenericElement(id: string): id is GenericElementId {
  return id in GENERIC_SPECS;
}
