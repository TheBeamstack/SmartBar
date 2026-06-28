/**
 * Manifest registry for the SPA. The JSON manifests under apps/web/manifests are the real data
 * (current_state.md §5); Vite imports them as typed objects. The engine stays a generic machine
 * — the UI just hands it the archetype/scheme/supplement JSON the active catalog references.
 *
 * P3 turns the two-shape P2 stub into the full catalog: every shape, both elements, all schemes
 * (keyed by id + filterable by element), and all supplements. "Add JSON, no engine change"
 * (§0.1) means new manifests appear here by import alone.
 */
import type {
  ShapeArchetype,
  ElementManifestView,
  SchemeManifestView,
  SupplementManifestView,
} from "@rebarconfig/core";

import droite from "../../manifests/shapes/droite.json";
import cadreRect from "../../manifests/shapes/cadre_rect.json";
import epingle from "../../manifests/shapes/epingle.json";
import attente from "../../manifests/shapes/attente.json";
import baionnette from "../../manifests/shapes/baionnette.json";
import chapeau from "../../manifests/shapes/chapeau.json";
import etrier from "../../manifests/shapes/etrier.json";
import uBar from "../../manifests/shapes/u_bar.json";
import crochetL from "../../manifests/shapes/crochet_l.json";
import releve from "../../manifests/shapes/releve.json";
import spiraleHelice from "../../manifests/shapes/spirale_helice.json";
import treillisMesh from "../../manifests/shapes/treillis_mesh.json";
import marchePalier from "../../manifests/shapes/marche_palier.json";
import zbar from "../../manifests/shapes/zbar.json";
import doubleCrank from "../../manifests/shapes/double_crank.json";
import stepped from "../../manifests/shapes/stepped.json";

import eCol01 from "../../manifests/elements/E-COL-01.json";
import eBem01 from "../../manifests/elements/E-BEM-01.json";
import eCol02 from "../../manifests/elements/E-COL-02.json";
import eFnd01 from "../../manifests/elements/E-FND-01.json";
import eSlb01 from "../../manifests/elements/E-SLB-01.json";
import eSlb02 from "../../manifests/elements/E-SLB-02.json";
import eSlb03 from "../../manifests/elements/E-SLB-03.json";
import eStr01 from "../../manifests/elements/E-STR-01.json";

import colTies from "../../manifests/schemes/E-COL-01/col-ties.json";
import colTiesCross from "../../manifests/schemes/E-COL-01/col-ties-crosstie.json";
import beamSimple from "../../manifests/schemes/E-BEM-01/beam-span-simple.json";
import beamChapeaux from "../../manifests/schemes/E-BEM-01/beam-span-chapeaux-releves.json";
import colSpiral from "../../manifests/schemes/E-COL-02/col-spiral.json";
import pileCage from "../../manifests/schemes/E-FND-01/pile-cage.json";
import slabOneway from "../../manifests/schemes/E-SLB-01/slab-oneway.json";
import slabTwoway from "../../manifests/schemes/E-SLB-02/slab-twoway.json";
import joistStd from "../../manifests/schemes/E-SLB-03/joist-std.json";
import stairStd from "../../manifests/schemes/E-STR-01/stair-std.json";

import suppEpingle from "../../manifests/supplements/SUPP_EPINGLE_CROSSTIE.json";
import suppDiagonale from "../../manifests/supplements/SUPP_DIAGONALE_ANGLE.json";
import suppReleve from "../../manifests/supplements/SUPP_RELEVE_BARS.json";
import suppSkin from "../../manifests/supplements/SUPP_SKIN_SIDE.json";
import suppDiamant from "../../manifests/supplements/SUPP_DIAMANT_TIE.json";
import suppDouble from "../../manifests/supplements/SUPP_DOUBLE_STIRRUP_SUPPORT.json";
import suppHead from "../../manifests/supplements/SUPP_HEAD_HOOPS.json";

export const SHAPES: Record<string, ShapeArchetype> = {
  DROITE: droite as ShapeArchetype,
  CADRE_RECT: cadreRect as ShapeArchetype,
  EPINGLE: epingle as ShapeArchetype,
  ATTENTE: attente as ShapeArchetype,
  BAIONNETTE: baionnette as ShapeArchetype,
  CHAPEAU: chapeau as ShapeArchetype,
  ETRIER: etrier as ShapeArchetype,
  U_BAR: uBar as ShapeArchetype,
  CROCHET_L: crochetL as ShapeArchetype,
  RELEVE: releve as ShapeArchetype,
  SPIRALE_HELICE: spiraleHelice as ShapeArchetype,
  TREILLIS_MESH: treillisMesh as ShapeArchetype,
  MARCHE_PALIER: marchePalier as ShapeArchetype,
  Z_BAR: zbar as ShapeArchetype,
  DOUBLE_CRANK: doubleCrank as ShapeArchetype,
  STEPPED: stepped as ShapeArchetype,
};

export const ELEMENTS: Record<string, ElementManifestView> = {
  "E-COL-01": eCol01 as ElementManifestView,
  "E-BEM-01": eBem01 as ElementManifestView,
  "E-COL-02": eCol02 as ElementManifestView,
  "E-FND-01": eFnd01 as ElementManifestView,
  "E-SLB-01": eSlb01 as ElementManifestView,
  "E-SLB-02": eSlb02 as ElementManifestView,
  "E-SLB-03": eSlb03 as ElementManifestView,
  "E-STR-01": eStr01 as ElementManifestView,
};

export const SCHEMES: Record<string, SchemeManifestView> = {
  COL_TIES: colTies as SchemeManifestView,
  COL_TIES_CROSSTIE: colTiesCross as SchemeManifestView,
  BEAM_SPAN_SIMPLE: beamSimple as SchemeManifestView,
  BEAM_SPAN_CHAPEAUX_RELEVES: beamChapeaux as SchemeManifestView,
  COL_SPIRAL: colSpiral as SchemeManifestView,
  PILE_CAGE: pileCage as SchemeManifestView,
  SLAB_ONEWAY_STD: slabOneway as SchemeManifestView,
  SLAB_TWOWAY_STD: slabTwoway as SchemeManifestView,
  JOIST_STD: joistStd as SchemeManifestView,
  STAIR_STD: stairStd as SchemeManifestView,
};

export const SUPPLEMENTS: Record<string, SupplementManifestView> = {
  SUPP_EPINGLE_CROSSTIE: suppEpingle as SupplementManifestView,
  SUPP_DIAGONALE_ANGLE: suppDiagonale as SupplementManifestView,
  SUPP_RELEVE_BARS: suppReleve as SupplementManifestView,
  SUPP_SKIN_SIDE: suppSkin as SupplementManifestView,
  SUPP_DIAMANT_TIE: suppDiamant as SupplementManifestView,
  SUPP_DOUBLE_STIRRUP_SUPPORT: suppDouble as SupplementManifestView,
  SUPP_HEAD_HOOPS: suppHead as SupplementManifestView,
};

export function loadShape(id: string): ShapeArchetype {
  const s = SHAPES[id];
  if (!s) throw new Error(`unknown shape archetype: ${id}`);
  return s;
}

export function elementManifest(id: string): ElementManifestView {
  const e = ELEMENTS[id];
  if (!e) throw new Error(`unknown element: ${id}`);
  return e;
}

export function schemeManifest(id: string): SchemeManifestView {
  const s = SCHEMES[id];
  if (!s) throw new Error(`unknown scheme: ${id}`);
  return s;
}

export function supplementManifest(id: string): SupplementManifestView {
  const s = SUPPLEMENTS[id];
  if (!s) throw new Error(`unknown supplement: ${id}`);
  return s;
}

/** Schemes compatible with an element (catalog filter, §5.3). */
export function schemesForElement(elementId: string): SchemeManifestView[] {
  return Object.values(SCHEMES).filter((s) => s.elementType === elementId);
}
