/**
 * i18n scaffolding (spec §8): FR default, EN toggle. Every UI label carries a _fr/_en pair.
 * Manifests already ship label_fr/label_en; this bundle covers the chrome (UI strings). P6
 * completes the bundles + asserts no missing keys (i18n_complete.spec). Keep keys flat + typed
 * so a missing translation is a compile error, not a runtime blank.
 */
export type Lang = "fr" | "en";

export interface Strings {
  appTitle: string;
  /** H1 ([v1.0.4]): non-blocking solve-failure banner; `{msg}` is replaced with the error detail. */
  solveErrorBanner: string;
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
    pickHint: string;
    linkOnSection: string;
  };
  crossTies: {
    title: string;
    hint: string;
    none: string;
    auto: string;
    presetV: string;
    presetH: string;
    clear: string;
    hookAngle: string;
    hookAngleFree: string;
    linkOnSection: string;
  };
  // v1.0.6 N2 (U2): the one unified section canvas + its tool status.
  sectionCanvas: {
    title: string;
    selectHint: string;
    linkHint: string;
    /** R5: shown on the 6 elements whose native mat is per-metre (not individually addressable). */
    placedOnlyHint: string;
    cancel: string;
  };
  // v1.0.6 N3 (U3): the contextual inspector (selection-driven) + the compact element-setup strip.
  inspector: {
    title: string;
    empty: string;
    bar: string;
    extra: string;
    crossTie: string;
    alert: string;
    highlighted: string;
    remove: string;
    /** v1.0.6-fix R2 (F-C) — the PLACED objects (N5's palette) the inspector can now edit. */
    placedSingle: string;
    placedRow: string;
    placedBundle: string;
    placedLayer: string;
    count: string;
    spacing: string;
    extent: string;
    direction: string;
    dirU: string;
    dirV: string;
    skin: string;
    bundleN: string;
    face: string;
    layerIndex: string;
    inset: string;
    span: string;
    layerGap: string;
  };
  setup: {
    title: string;
    advanced: string;
    advancedHint: string;
  };
  regions: {
    title: string;
    hint: string;
    from: string;
    to: string;
    spacing: string;
    add: string;
    remove: string;
    uniform: string;
    symmetric: string;
    endZone: string;
    endSpacing: string;
    midSpacing: string;
    apply: string;
  };
  faconnage: {
    title: string;
    shape: string;
    hookStart: string;
    hookEnd: string;
    hookNone: string;
    cutLength: string;
    invalid: string;
    lastValid: string;
  };
  addressable: {
    title: string;
    hint: string;
    bar: string;
    remove: string;
    diameter: string;
    length: string;
    axialPos: string;
    reset: string;
    overridden: string;
    removed: string;
    removeOverride: string;
    independent: string;
    addBar: string;
    independentList: string;
    u: string;
    level: string;
    lengthCoupled: string;
    customLength: string;
    removeBar: string;
    autoSplit: string;
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
    supportV1: string;
    supportV2: string;
    anchorage: string;
    supportWidth: string;
    releves: string;
    releveSupport: string;
    releveCount: string;
    releveAdd: string;
    seedRegions: string;
  };
  splice: {
    title: string;
    auto: string;
    kind: string;
    lap: string;
    coupler: string;
    station: string;
    addLap: string;
    addCoupler: string;
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
  codePack: string;
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
  readout: {
    title: string;
    overall: string;
    zones: {
      As_total: string;
      As_span_bottom: string;
      As_top_support: string;
      As_top_support_left: string;
      As_top_support_right: string;
      As_top_montage: string;
    };
  };
  workspace: {
    expand: string;
    collapse: string;
    expandHint: string;
    sectionDock: string;
    elevationDock: string;
    openDock: string;
    collapseDock: string;
    resizeDock: string;
    elevationReadonly: string;
  };
  tools: {
    title: string;
    select: string;
    addBar: string;
    addRow: string;
    addLayer: string;
    addBundle: string;
    link: string;
    measure: string;
    shape: string;
    place: string;
    placed: string;
    remove: string;
    count: string;
    hint: string;
    placeHint: string;
    measureHint: string;
    measurePoint: string;
    measureFrom: string;
    measureDistance: string;
    spanDirection: string;
    spanX: string;
    spanY: string;
  };
  /** v1.0.6 N6 (U5) — the editable elevation: curtailment / anchorage / splices / zone boundaries. */
  elevation: {
    editHint: string;
    curtailStart: string;
    curtailEnd: string;
    anchorage: string;
    anchNone: string;
    anchStraight: string;
    anchHook: string;
    splices: string;
    addLap: string;
    addCoupler: string;
    removeSplice: string;
    bendStation: string;
    runsThrough: string;
    live: string;
  };
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
    /** v1.0.5 Track O (M6): French façonnage designation column header. */
    faconnage: string;
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
    roll: string;
    rollLeft: string;
    rollRight: string;
    pan: string;
    orbit: string;
  };
}

const FR: Strings = {
  appTitle: "RebarConfig — Détaillage d'armatures",
  solveErrorBanner: "Cette modification n'a pas pu être calculée — le dernier état valide est conservé. Corrigez la saisie. ({msg})",
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
    pickHint: "Cliquez deux barres sur la coupe pour les relier.",
    linkOnSection: "Lier sur la coupe",
  },
  crossTies: {
    title: "Épingles (cross-ties)",
    hint: "Cliquez deux barres opposées pour poser une épingle ; ou utilisez un préréglage / Auto.",
    none: "Aucune épingle",
    auto: "Auto (code)",
    presetV: "Verticales (haut↔bas)",
    presetH: "Horizontales (gauche↔droite)",
    clear: "Tout effacer",
    hookAngle: "Angle de crochet",
    hookAngleFree: "Angle (°)",
    linkOnSection: "Lier deux barres",
  },
  sectionCanvas: {
    title: "Coupe",
    selectHint: "Sélection — cliquez une barre",
    linkHint: "Liaison — cliquez deux barres",
    placedOnlyHint: "Nappe au mètre — choisissez un outil pour ajouter de l'acier, ou cliquez une barre ajoutée",
    cancel: "Annuler",
  },
  inspector: {
    title: "Inspecteur",
    empty: "Sélectionnez une barre sur la coupe ou en 3D pour l'éditer ici.",
    bar: "Barre",
    extra: "Barre indépendante",
    crossTie: "Épingle",
    alert: "Vérification",
    highlighted: "Barres concernées",
    remove: "Supprimer",
    placedSingle: "Barre placée",
    placedRow: "Nappe (lit de barres)",
    placedBundle: "Paquet",
    placedLayer: "Lit supplémentaire",
    count: "Nombre",
    spacing: "Espacement",
    extent: "Étendue",
    direction: "Direction",
    dirU: "Horizontale (u)",
    dirV: "Verticale (v)",
    skin: "Acier de peau",
    bundleN: "Barres du paquet (2–4)",
    face: "Face",
    layerIndex: "Rang du lit",
    inset: "Retrait",
    span: "Portée",
    layerGap: "Jeu entre lits",
  },
  setup: {
    title: "Réglages de l'élément",
    advanced: "Formulaire avancé",
    advancedHint: "Contrôles complets (schéma, géométrie, projet) — repli complet.",
  },
  regions: {
    title: "Espacement par zones",
    hint: "Définissez des zones le long de l'élément, chacune avec son espacement (ex. extrémités plus serrées).",
    from: "De (mm)",
    to: "À (mm)",
    spacing: "Espacement e (mm)",
    add: "Ajouter une zone",
    remove: "Supprimer",
    uniform: "Uniforme",
    symmetric: "Extrémités symétriques",
    endZone: "Longueur d'extrémité (mm)",
    endSpacing: "e extrémité (mm)",
    midSpacing: "e milieu (mm)",
    apply: "Appliquer",
  },
  faconnage: {
    title: "Façonnage",
    shape: "Forme",
    hookStart: "Crochet début",
    hookEnd: "Crochet fin",
    hookNone: "Aucun",
    cutLength: "Longueur de coupe",
    invalid: "Paramètres invalides : géométrie impossible (vérifiez les longueurs).",
    lastValid: "Aperçu : dernière forme valide",
  },
  addressable: {
    title: "Détail barre par barre",
    hint: "Sélectionnez une barre à façonner",
    bar: "Barre",
    remove: "Supprimer",
    diameter: "Ø barre (mm)",
    length: "Longueur (mm)",
    axialPos: "Position axiale (mm)",
    reset: "Réinitialiser la barre",
    overridden: "Barres modifiées",
    removed: "supprimée",
    removeOverride: "Retirer la modification",
    independent: "Barres indépendantes / niveaux",
    addBar: "+ Ajouter une barre",
    independentList: "Barres indépendantes",
    u: "u (mm)",
    level: "v / niveau (mm)",
    lengthCoupled: "Longueur = membre (auto)",
    customLength: "Longueur personnalisée",
    removeBar: "Retirer",
    autoSplit: "Découpe auto (barre stock)",
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
    supportV1: "Appui V1 (gauche)",
    supportV2: "Appui V2 (droite)",
    anchorage: "Ancrage sur appui (mm)",
    supportWidth: "Largeur d'appui (mm)",
    releves: "Barres relevées",
    releveSupport: "Appui",
    releveCount: "Nombre",
    releveAdd: "+ Relevé",
    seedRegions: "Densifier cadres aux appuis",
  },
  splice: {
    title: "Recouvrements / manchons",
    auto: "Découpe auto (> longueur de stock)",
    kind: "Type de jonction",
    lap: "Recouvrement",
    coupler: "Manchon",
    station: "Position (mm)",
    addLap: "+ Recouvrement",
    addCoupler: "+ Manchon",
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
  codePack: "Code de calcul",
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
  readout: {
    title: "Vérification par zone",
    overall: "État global",
    zones: {
      As_total: "Longitudinal",
      As_span_bottom: "Travée (bas)",
      As_top_support: "Chapeaux (appui)",
      As_top_support_left: "Chapeaux V1 (gauche)",
      As_top_support_right: "Chapeaux V2 (droite)",
      As_top_montage: "Montage (haut)",
    },
  },
  tools: {
    title: "Outils",
    select: "Sélection",
    addBar: "Barre",
    addRow: "Lit",
    addLayer: "Couche",
    addBundle: "Paquet",
    link: "Lier",
    measure: "Mesure",
    shape: "Forme",
    place: "Placer",
    placed: "Barres placées",
    remove: "Retirer",
    count: "Nombre",
    hint: "Choisis une forme, puis clique sur la coupe (ou saisis u/v + Placer).",
    placeHint: "Clique sur la coupe pour déposer la barre.",
    measureHint: "Clique deux points de la coupe pour lire la distance.",
    measurePoint: "Point",
    measureFrom: "Depuis",
    measureDistance: "Distance",
    spanDirection: "Direction de portée",
    spanX: "Sens X",
    spanY: "Sens Y",
  },
  elevation: {
    editHint: "Sélectionne une barre, puis glisse ses bouts (arrêt) ou les limites de zone ; valeurs saisissables à droite.",
    curtailStart: "Arrêt départ (mm)",
    curtailEnd: "Arrêt fin (mm)",
    anchorage: "Ancrage au bout",
    anchNone: "Coupé net",
    anchStraight: "Droit",
    anchHook: "Crochet",
    splices: "Recouvrements / manchons",
    addLap: "+ Recouvrement",
    addCoupler: "+ Manchon",
    removeSplice: "Retirer",
    bendStation: "Point de relevé (mm)",
    runsThrough: "Traverse l'appui",
    live: "Station",
  },
  workspace: {
    expand: "Élargir",
    collapse: "Réduire",
    expandHint: "Élargir la colonne sur la 3D",
    sectionDock: "Section",
    elevationDock: "Élévation",
    openDock: "Ouvrir le panneau",
    collapseDock: "Réduire le panneau",
    resizeDock: "Redimensionner",
    elevationReadonly: "lecture seule — édition en N6",
  },
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
    faconnage: "Façonnage",
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
    roll: "Rotation dans le plan",
    rollLeft: "Pivoter à gauche (Maj = 5°)",
    rollRight: "Pivoter à droite (Maj = 5°)",
    pan: "Déplacer (main) — clic-gauche translate",
    orbit: "Orbite (clic-gauche pivote)",
  },
};

const EN: Strings = {
  appTitle: "RebarConfig — Rebar detailing",
  solveErrorBanner: "This change couldn't be computed — the last valid state is kept. Fix the input. ({msg})",
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
    pickHint: "Click two bars on the section to link them.",
    linkOnSection: "Link on the section",
  },
  crossTies: {
    title: "Cross-ties (épingles)",
    hint: "Click two opposite bars to drop a cross-tie; or use a preset / Auto.",
    none: "No cross-ties",
    auto: "Auto (code)",
    presetV: "Vertical (top↔bottom)",
    presetH: "Horizontal (left↔right)",
    clear: "Clear all",
    hookAngle: "Hook angle",
    hookAngleFree: "Angle (°)",
    linkOnSection: "Link two bars",
  },
  sectionCanvas: {
    title: "Section",
    selectHint: "Select — click a bar",
    linkHint: "Link — click two bars",
    placedOnlyHint: "Per-metre mat — pick a tool to add steel, or click a bar you added",
    cancel: "Cancel",
  },
  inspector: {
    title: "Inspector",
    empty: "Select a bar on the section or in 3D to edit it here.",
    bar: "Bar",
    extra: "Independent bar",
    crossTie: "Cross-tie",
    alert: "Check",
    highlighted: "Affected bars",
    remove: "Remove",
    placedSingle: "Placed bar",
    placedRow: "Row",
    placedBundle: "Bundle",
    placedLayer: "Extra layer",
    count: "Count",
    spacing: "Spacing",
    extent: "Extent",
    direction: "Direction",
    dirU: "Horizontal (u)",
    dirV: "Vertical (v)",
    skin: "Skin steel",
    bundleN: "Bars in bundle (2–4)",
    face: "Face",
    layerIndex: "Layer index",
    inset: "Inset",
    span: "Span",
    layerGap: "Gap between layers",
  },
  setup: {
    title: "Element setup",
    advanced: "Advanced form",
    advancedHint: "Full controls (scheme, geometry, project) — complete fallback.",
  },
  regions: {
    title: "Spacing by region",
    hint: "Define regions along the member, each with its own spacing (e.g. denser ends).",
    from: "From (mm)",
    to: "To (mm)",
    spacing: "Spacing e (mm)",
    add: "Add region",
    remove: "Remove",
    uniform: "Uniform",
    symmetric: "Symmetric ends",
    endZone: "End-zone length (mm)",
    endSpacing: "End e (mm)",
    midSpacing: "Mid e (mm)",
    apply: "Apply",
  },
  faconnage: {
    title: "Bar shaping",
    shape: "Shape",
    hookStart: "Start hook",
    hookEnd: "End hook",
    hookNone: "None",
    cutLength: "Cut length",
    invalid: "Invalid parameters: impossible geometry (check the lengths).",
    lastValid: "Preview: last valid shape",
  },
  addressable: {
    title: "Bar-by-bar detailing",
    hint: "Pick a bar to shape",
    bar: "Bar",
    remove: "Remove",
    diameter: "Bar Ø (mm)",
    length: "Length (mm)",
    axialPos: "Axial position (mm)",
    reset: "Reset bar",
    overridden: "Overridden bars",
    removed: "removed",
    removeOverride: "Remove override",
    independent: "Independent bars / levels",
    addBar: "+ Add a bar",
    independentList: "Independent bars",
    u: "u (mm)",
    level: "v / level (mm)",
    lengthCoupled: "Length = member (auto)",
    customLength: "Custom length",
    removeBar: "Remove",
    autoSplit: "Auto-split (stock length)",
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
    supportV1: "Support V1 (left)",
    supportV2: "Support V2 (right)",
    anchorage: "Support anchorage (mm)",
    supportWidth: "Support width (mm)",
    releves: "Bent-up bars (relevés)",
    releveSupport: "Support",
    releveCount: "Count",
    releveAdd: "+ Relevé",
    seedRegions: "Densify stirrups at supports",
  },
  splice: {
    title: "Lap splices / couplers",
    auto: "Auto-split (> stock length)",
    kind: "Joint type",
    lap: "Lap",
    coupler: "Coupler",
    station: "Position (mm)",
    addLap: "+ Lap",
    addCoupler: "+ Coupler",
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
  codePack: "Design code",
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
  readout: {
    title: "Per-zone check",
    overall: "Overall",
    zones: {
      As_total: "Longitudinal",
      As_span_bottom: "Span (bottom)",
      As_top_support: "Top (support)",
      As_top_support_left: "Top V1 (left)",
      As_top_support_right: "Top V2 (right)",
      As_top_montage: "Top (montage)",
    },
  },
  tools: {
    title: "Tools",
    select: "Select",
    addBar: "Bar",
    addRow: "Row",
    addLayer: "Layer",
    addBundle: "Bundle",
    link: "Link",
    measure: "Measure",
    shape: "Shape",
    place: "Place",
    placed: "Placed bars",
    remove: "Remove",
    count: "Count",
    hint: "Pick a shape, then click the section (or type u/v + Place).",
    placeHint: "Click the section to drop the bar.",
    measureHint: "Click two section points to read the distance.",
    measurePoint: "Point",
    measureFrom: "From",
    measureDistance: "Distance",
    spanDirection: "Span direction",
    spanX: "X span",
    spanY: "Y span",
  },
  elevation: {
    editHint: "Select a bar, then drag its ends (curtailment) or the zone boundaries; typed values on the right.",
    curtailStart: "Start cut-off (mm)",
    curtailEnd: "End cut-off (mm)",
    anchorage: "End anchorage",
    anchNone: "Bare cut",
    anchStraight: "Straight",
    anchHook: "Hook",
    splices: "Laps / couplers",
    addLap: "+ Lap",
    addCoupler: "+ Coupler",
    removeSplice: "Remove",
    bendStation: "Bend-up point (mm)",
    runsThrough: "Runs through support",
    live: "Station",
  },
  workspace: {
    expand: "Expand",
    collapse: "Shrink",
    expandHint: "Widen the column over the 3D",
    sectionDock: "Section",
    elevationDock: "Elevation",
    openDock: "Open panel",
    collapseDock: "Collapse panel",
    resizeDock: "Resize",
    elevationReadonly: "read-only — editing in N6",
  },
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
    faconnage: "Shaping",
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
    roll: "In-plane roll",
    rollLeft: "Roll left (Shift = 5°)",
    rollRight: "Roll right (Shift = 5°)",
    pan: "Pan (hand) — left-drag pans",
    orbit: "Orbit (left-drag rotates)",
  },
};

export const BUNDLES: Record<Lang, Strings> = { fr: FR, en: EN };

export function t(lang: Lang): Strings {
  return BUNDLES[lang];
}
