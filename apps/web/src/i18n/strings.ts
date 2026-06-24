/**
 * i18n scaffolding (spec §8): FR default, EN toggle. Every UI label carries a _fr/_en pair.
 * Manifests already ship label_fr/label_en; this bundle covers the chrome (UI strings). P6
 * completes the bundles + asserts no missing keys (i18n_complete.spec). Keep keys flat + typed
 * so a missing translation is a compile error, not a runtime blank.
 */
export type Lang = "fr" | "en";

export interface Strings {
  appTitle: string;
  element: string;
  code: string;
  language: string;
  importBtn: string;
  exportBtn: string;
  tabScheme: string;
  tabGeometry: string;
  tabProject: string;
  primaryBars: string;
  ties: string;
  scheme: string;
  expert: string;
  supplements: {
    title: string;
    add: string;
    remove: string;
    none: string;
    bar1: string;
    bar2: string;
    rebind: string;
    boundTo: string;
  };
  beam: {
    span: string;
    bottomBars: string;
    topBars: string;
    chapeaux: string;
    stirrups: string;
    supportZone: string;
    continued: string;
    spanSteel: string;
  };
  groups: string;
  section: { b: string; h: string; height: string };
  material: { title: string; concrete: string; steel: string };
  cover: string;
  exposure: string;
  diameter: string;
  spacing: string;
  legs: string;
  countsTop: string;
  countsBottom: string;
  countsLeft: string;
  countsRight: string;
  asProvided: string;
  asRequired: string;
  effectiveDepth: string;
  alerts: string;
  noAlerts: string;
  provisionalWarning: string;
  sectionCut: string;
  resetView: string;
  status: { pass: string; warn: string; fail: string };
  exportLocked: string;
}

const FR: Strings = {
  appTitle: "RebarConfig — Détaillage d'armatures",
  element: "Élément",
  code: "Code",
  language: "Langue",
  importBtn: "Importer",
  exportBtn: "Exporter",
  tabScheme: "Schéma",
  tabGeometry: "Géométrie",
  tabProject: "Projet / Code",
  primaryBars: "Armatures principales",
  ties: "Armatures transversales (cadres)",
  scheme: "Schéma",
  expert: "Mode expert",
  supplements: {
    title: "Armatures complémentaires",
    add: "Ajouter",
    remove: "Retirer",
    none: "Aucune armature complémentaire",
    bar1: "Barre 1 (indice)",
    bar2: "Barre 2 (indice)",
    rebind: "Re-lier",
    boundTo: "Liée aux barres",
  },
  beam: {
    span: "Portée L (mm)",
    bottomBars: "Barres inférieures",
    topBars: "Chapeaux (barres)",
    chapeaux: "Chapeaux sur appui",
    stirrups: "Cadres (effort tranchant)",
    supportZone: "Zone d'appui (mm)",
    continued: "Fraction ancrée sur appui",
    spanSteel: "Aciers de travée",
  },
  groups: "Liste des armatures",
  section: { b: "Largeur b (mm)", h: "Hauteur h (mm)", height: "Hauteur H (mm)" },
  material: { title: "Matériaux", concrete: "Béton f_c28 (MPa)", steel: "Acier f_e (MPa)" },
  cover: "Enrobage (mm)",
  exposure: "Exposition",
  diameter: "Ø (mm)",
  spacing: "Espacement (mm)",
  legs: "Brins",
  countsTop: "Barres haut",
  countsBottom: "Barres bas",
  countsLeft: "Barres gauche",
  countsRight: "Barres droite",
  asProvided: "As,prév",
  asRequired: "As,req",
  effectiveDepth: "Hauteur utile d",
  alerts: "Vérifications",
  noAlerts: "Aucune vérification",
  provisionalWarning: "Constantes BAEL PROVISOIRES — non validées (G-BAEL).",
  sectionCut: "Coupe",
  resetView: "Recentrer",
  status: { pass: "Conforme", warn: "À vérifier", fail: "Non conforme" },
  exportLocked: "Export bloqué (non conforme)",
};

const EN: Strings = {
  appTitle: "RebarConfig — Rebar detailing",
  element: "Element",
  code: "Code",
  language: "Language",
  importBtn: "Import",
  exportBtn: "Export",
  tabScheme: "Scheme",
  tabGeometry: "Geometry",
  tabProject: "Project / Code",
  primaryBars: "Primary bars",
  ties: "Transverse reinforcement (ties)",
  scheme: "Scheme",
  expert: "Expert mode",
  supplements: {
    title: "Supplemental reinforcement",
    add: "Add",
    remove: "Remove",
    none: "No supplemental reinforcement",
    bar1: "Bar 1 (index)",
    bar2: "Bar 2 (index)",
    rebind: "Rebind",
    boundTo: "Bound to bars",
  },
  beam: {
    span: "Span L (mm)",
    bottomBars: "Bottom bars",
    topBars: "Chapeau bars",
    chapeaux: "Top support bars (chapeaux)",
    stirrups: "Stirrups (shear)",
    supportZone: "Support zone (mm)",
    continued: "Fraction anchored at support",
    spanSteel: "Span steel",
  },
  groups: "Reinforcement list",
  section: { b: "Width b (mm)", h: "Depth h (mm)", height: "Height H (mm)" },
  material: { title: "Materials", concrete: "Concrete f_c28 (MPa)", steel: "Steel f_e (MPa)" },
  cover: "Cover (mm)",
  exposure: "Exposure",
  diameter: "Ø (mm)",
  spacing: "Spacing (mm)",
  legs: "Legs",
  countsTop: "Top bars",
  countsBottom: "Bottom bars",
  countsLeft: "Left bars",
  countsRight: "Right bars",
  asProvided: "As,prov",
  asRequired: "As,req",
  effectiveDepth: "Effective depth d",
  alerts: "Checks",
  noAlerts: "No checks",
  provisionalWarning: "PROVISIONAL BAEL constants — not ratified (G-BAEL).",
  sectionCut: "Section cut",
  resetView: "Reset view",
  status: { pass: "Pass", warn: "Review required", fail: "Fail" },
  exportLocked: "Export locked (fail state)",
};

export const BUNDLES: Record<Lang, Strings> = { fr: FR, en: EN };

export function t(lang: Lang): Strings {
  return BUNDLES[lang];
}
