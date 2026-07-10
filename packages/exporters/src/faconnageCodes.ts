/**
 * BAEL / French façonnage shape-code map (spec v1.0.5 Track O / Part V, plan M6).
 *
 * The bar-bending schedule and the shop drawing speak the **French façonnage convention**: each
 * internal shape *archetype id* (the stable data key the engine owns — `DROITE`, `CHAPEAU`, …) is
 * rendered on the schedule under its French *façonnage designation* (`Droite`, `Chapeau`, …) plus a
 * short repère code. Only the *rendered label* changes — `shapeArchetypeId` stays the data key
 * everywhere (BBS merge key, canonical `.rcfg`, tests), so this is a pure labelling layer.
 *
 * ⚠ **PROVISIONAL — `[OWNER-DEP → v1.0.5_owner_tasks.md §O-1]`.** The nomenclature (the NF A 35-027 /
 * BAEL façonnage shape-code table and the cadre/étrier/chapeau naming) is a **labelling convention,
 * not structural** — it is *owner-supplied* (spec §0.5). Until the owner delivers the ratified table,
 * these designations ship flagged `provisional: true`: they are sensible French names, not the
 * definitive site nomenclature. Swapping in the owner table = editing `TABLE` (one place); nothing
 * downstream changes. No engineering sign-off gate is attached (it is a name, not a number).
 *
 * Forward-compat: an archetype id with no table entry falls back to the raw id (a future shape still
 * schedules — it shows its id until a code is added), never throws.
 */

/** The rendered French façonnage designation for one shape archetype. */
export interface FaconnageDesignation {
  /** the internal shape archetype id — the stable data key (NOT the rendered primary label). */
  archetypeId: string;
  /** short French repère code for the shape (PROVISIONAL, §O-1). */
  code: string;
  /** the French designation shown on the rendered schedule (PROVISIONAL, §O-1). */
  label: string;
  /** true until the owner-supplied NF/BAEL façonnage table ratifies these labels (§O-1). */
  provisional: boolean;
}

/** True while the shipped map is the provisional placeholder (flips when the owner table lands). */
export const FACONNAGE_PROVISIONAL = true;

/**
 * PROVISIONAL archetype-id → French façonnage designation. One entry per shipped shape manifest
 * (`apps/web/manifests/shapes/*.json`). Owner ruling supplies the definitive codes (§O-1).
 */
const TABLE: Readonly<Record<string, { code: string; label: string }>> = {
  DROITE: { code: "D", label: "Droite" },
  CHAPEAU: { code: "CH", label: "Chapeau" },
  CROCHET_L: { code: "L", label: "Crochet L" },
  U_BAR: { code: "U", label: "Cadre U" },
  CADRE_RECT: { code: "CA", label: "Cadre" },
  ETRIER: { code: "ET", label: "Étrier" },
  EPINGLE: { code: "EP", label: "Épingle" },
  RELEVE: { code: "RE", label: "Relevé" },
  BAIONNETTE: { code: "BA", label: "Baïonnette" },
  Z_BAR: { code: "Z", label: "Barre Z" },
  DOUBLE_CRANK: { code: "DB", label: "Double baïonnette" },
  STEPPED: { code: "CR", label: "Crémaillère" },
  MARCHE_PALIER: { code: "PP", label: "Paillasse-palier" },
  SPIRALE_HELICE: { code: "SP", label: "Spirale" },
  TREILLIS_MESH: { code: "TS", label: "Treillis soudé" },
  ATTENTE: { code: "AT", label: "Attente" },
};

/**
 * The French façonnage designation for a shape archetype id (pure, deterministic). An unknown id
 * (a future shape without a code) falls back to the raw id → it still schedules, just uncoded.
 */
export function faconnageFor(archetypeId: string): FaconnageDesignation {
  const e = TABLE[archetypeId];
  return {
    archetypeId,
    code: e ? e.code : archetypeId,
    label: e ? e.label : archetypeId,
    provisional: FACONNAGE_PROVISIONAL,
  };
}

/** The archetype ids the provisional table covers (deterministic, sorted) — for tests/tooling. */
export function faconnageCoverage(): string[] {
  return Object.keys(TABLE).sort();
}
