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
    montageTitle: string;
    montageEnable: string;
    montageBars: string;
  };
  generic: {
    reinforcement: string;
    count: string;
    asReqPerM: string;
    restrainedCorner: string;
    cornerTorsion: string;
    wrapCorner: string;
  };
  seismic: {
    title: string;
    none: string;
    regime: string;
    zone: string;
    ductility: string;
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
  layout: {
    principle: string;
    symmetric: string;
    free: string;
    verticalFaces: string;
    horizontalFaces: string;
  };
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
  exports: {
    menu: string;
    pdf: string;
    dxf: string;
    bbs: string;
    rcfg: string;
    projectGroup: string;
    projectPdf: string;
    projectDxf: string;
    projectBbs: string;
    projectLocked: string;
  };
  bbs: {
    title: string;
    mark: string;
    diameter: string;
    shape: string;
    count: string;
    cutLength: string;
    totalLength: string;
    weight: string;
    totalWeight: string;
    ratio: string;
    concreteVolume: string;
    reviewRequired: string;
    empty: string;
  };
  coupes: {
    title: string;
    add: string;
    remove: string;
    label: string;
    station: string;
    lookBehind: string;
    defaultTag: string;
    preview: string;
    noBars: string;
    panelHint: string;
  };
  project: {
    title: string;
    add: string;
    duplicate: string;
    remove: string;
    mark: string;
    quantity: string;
    elementType: string;
    unitMass: string;
    totalMass: string;
    density: string;
    totals: string;
    totalSteel: string;
    totalConcrete: string;
    overallRatio: string;
    failHint: string;
    moveUp: string;
    moveDown: string;
  };
  view: {
    title: string;
    namedView: string;
    home: string;
    projection: string;
    perspective: string;
    orthographic: string;
  };
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
    montageTitle: "Barres supérieures filantes",
    montageEnable: "Ajouter des barres filantes en partie haute",
    montageBars: "Barres filantes (haut)",
  },
  generic: {
    reinforcement: "Armatures",
    count: "Nombre de barres",
    asReqPerM: "As,req (mm²/m)",
    restrainedCorner: "Angle bloqué (continuité)",
    cornerTorsion: "Aciers de torsion d'angle (mm²)",
    wrapCorner: "Barre principale continue à l'angle rentrant",
  },
  seismic: {
    title: "Sismique (RPS-2011)",
    none: "Gravité seule (non sismique)",
    regime: "Régime",
    zone: "Zone sismique",
    ductility: "Classe de ductilité",
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
  layout: {
    principle: "Disposition des barres",
    symmetric: "Symétrique",
    free: "Libre (4 faces)",
    verticalFaces: "Barres faces verticales (haut+bas)",
    horizontalFaces: "Barres faces horizontales (gauche+droite)",
  },
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
  exports: {
    menu: "Exporter",
    pdf: "Plan PDF",
    dxf: "Dessin DXF",
    bbs: "Nomenclature (JSON)",
    rcfg: "Projet (.rcfg)",
    projectGroup: "Projet complet",
    projectPdf: "Plan PDF combiné (tous les éléments)",
    projectDxf: "Dessins DXF (un par élément)",
    projectBbs: "Nomenclature projet (JSON)",
    projectLocked: "Export combiné bloqué — un élément est non conforme (🔴)",
  },
  bbs: {
    title: "Nomenclature des aciers (BBS)",
    mark: "Rep.",
    diameter: "Ø",
    shape: "Forme",
    count: "Nb",
    cutLength: "Long. (mm)",
    totalLength: "Total (m)",
    weight: "Poids (kg)",
    totalWeight: "Total acier",
    ratio: "Ratio",
    concreteVolume: "Béton",
    reviewRequired: "À vérifier — Review required",
    empty: "Aucune barre",
  },
  coupes: {
    title: "Coupes",
    add: "Ajouter une coupe",
    remove: "Supprimer",
    label: "Libellé",
    station: "Position le long de l'axe (mm)",
    lookBehind: "Profondeur vue (mm)",
    defaultTag: "par défaut",
    preview: "Aperçu de la coupe",
    noBars: "Aucune barre coupée",
    panelHint: "Coupe perpendiculaire à l'axe à la position choisie (orientation oblique : .rcfg/P6).",
  },
  project: {
    title: "Projet (éléments)",
    add: "Ajouter un élément",
    duplicate: "Dupliquer",
    remove: "Supprimer",
    mark: "Repère",
    quantity: "Quantité",
    elementType: "Type",
    unitMass: "Acier / unité (kg)",
    totalMass: "Acier total (kg)",
    density: "Densité (kg/m³)",
    totals: "Totaux du projet",
    totalSteel: "Acier total",
    totalConcrete: "Béton total",
    overallRatio: "Ratio global",
    failHint: "Un type non conforme (🔴) bloque l'export combiné.",
    moveUp: "Monter",
    moveDown: "Descendre",
  },
  view: {
    title: "Vue 3D",
    namedView: "Orientation",
    home: "Vue par défaut",
    projection: "Projection",
    perspective: "Perspective",
    orthographic: "Orthographique",
  },
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
    montageTitle: "Full-length top bars",
    montageEnable: "Add full-length top (montage) bars",
    montageBars: "Top bars (full length)",
  },
  generic: {
    reinforcement: "Reinforcement",
    count: "Bar count",
    asReqPerM: "As,req (mm²/m)",
    restrainedCorner: "Restrained corner (continuity)",
    cornerTorsion: "Corner torsion steel (mm²)",
    wrapCorner: "Main bar continuous around re-entrant corner",
  },
  seismic: {
    title: "Seismic (RPS-2011)",
    none: "Gravity only (non-seismic)",
    regime: "Regime",
    zone: "Seismic zone",
    ductility: "Ductility class",
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
  layout: {
    principle: "Bar layout",
    symmetric: "Symmetric",
    free: "Free (4 faces)",
    verticalFaces: "Bars on vertical faces (top+bottom)",
    horizontalFaces: "Bars on horizontal faces (left+right)",
  },
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
  exports: {
    menu: "Export",
    pdf: "PDF sheet",
    dxf: "DXF drawing",
    bbs: "Schedule (JSON)",
    rcfg: "Project (.rcfg)",
    projectGroup: "Whole project",
    projectPdf: "Combined PDF (all elements)",
    projectDxf: "DXF drawings (one per element)",
    projectBbs: "Project schedule (JSON)",
    projectLocked: "Combined export locked — an element fails (🔴)",
  },
  bbs: {
    title: "Bar-bending schedule (BBS)",
    mark: "Mark",
    diameter: "Ø",
    shape: "Shape",
    count: "Qty",
    cutLength: "Cut (mm)",
    totalLength: "Total (m)",
    weight: "Weight (kg)",
    totalWeight: "Total steel",
    ratio: "Ratio",
    concreteVolume: "Concrete",
    reviewRequired: "Review required",
    empty: "No bars",
  },
  coupes: {
    title: "Sections",
    add: "Add a section",
    remove: "Remove",
    label: "Label",
    station: "Position along axis (mm)",
    lookBehind: "Look-behind depth (mm)",
    defaultTag: "default",
    preview: "Section preview",
    noBars: "No bars cut",
    panelHint: "Perpendicular cut at the chosen station (oblique orientation: .rcfg/P6).",
  },
  project: {
    title: "Project (elements)",
    add: "Add element",
    duplicate: "Duplicate",
    remove: "Remove",
    mark: "Mark",
    quantity: "Quantity",
    elementType: "Type",
    unitMass: "Steel / unit (kg)",
    totalMass: "Total steel (kg)",
    density: "Density (kg/m³)",
    totals: "Project totals",
    totalSteel: "Total steel",
    totalConcrete: "Total concrete",
    overallRatio: "Overall ratio",
    failHint: "A failing type (🔴) blocks the combined export.",
    moveUp: "Move up",
    moveDown: "Move down",
  },
  view: {
    title: "3D view",
    namedView: "Orientation",
    home: "Default view",
    projection: "Projection",
    perspective: "Perspective",
    orthographic: "Orthographic",
  },
};

export const BUNDLES: Record<Lang, Strings> = { fr: FR, en: EN };

export function t(lang: Lang): Strings {
  return BUNDLES[lang];
}
