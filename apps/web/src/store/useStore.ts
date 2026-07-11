/**
 * Zustand store (spec §2.1): holds the active element document; EVERY mutation triggers a
 * synchronous engine re-solve + a fresh SolveResult in the same tick — no reload, no network.
 *
 * Correctness is never skipped on commit (plan §2.2): the solve always runs (well under the
 * 16 ms budget). `dragMode` does NOT gate the solve — it only tells the *viewport* to degrade
 * its render and the alerts panel to defer the live list. See rebarProps.ts for that mapping.
 *
 * P3 generalises the store to the element catalog (column ⇄ beam, §5.3), user-added supplements
 * (§5.5, bound by stable bar indices — click OR keyboard), and an expert toggle (§5.6).
 */
import { create } from "zustand";
import { defaultCoupeFor, type SectionCut, type EndAnchorageChoice } from "@rebarconfig/core";
import { type RcfgProject } from "@rebarconfig/exporters";
import type { Lang } from "../i18n/strings";
import {
  type ElementDoc,
  type ColumnDoc,
  type BeamDoc,
  type GenericDoc,
  type ZoneEdit,
  type SeismicEdit,
  type CodePackId,
  type ElementId,
  type SupplementEdit,
  type CrossTie,
  type BarOverrideEdit,
  type AddressableBar,
  type PlacedBarDoc,
  type SupportZone,
  type ReleveZone,
  type Splice,
  defaultColumnDoc,
  defaultDocFor,
  isColumnDoc,
  isBeamDoc,
  isGenericDoc,
} from "../engine/document";
import { solveDoc, type SolveResult } from "../engine/solveDoc";
import { supportSeededRegions, effectiveRegions, normalizeRegions, memberAxisLength } from "../engine/regions";
import { selectedBarStations } from "../engine/elevation";
import { freshPlacedId, buildPlacedBar } from "../engine/placement";
import { sectionFrame, snapToFrame } from "../engine/sectionFrame";
import { GENERIC_SPECS, isGenericElement } from "../engine/elementSpecs";
import {
  type ElementInstance,
  makeInstance,
  defaultMark,
} from "../engine/project";
import { rcfgToInstances } from "../engine/projectRcfg";
import { DEFAULT_VIEW_ID } from "../viewport/cameraState";

/**
 * v1.0.6 N2 (U2) + N5 (U4): the active section-canvas tool (a modal tool). `select`/`link` are N2;
 * the `add-*` placement tools + `measure` are N5 (a click on the canvas — or the typed-coord twin —
 * drops the palette shape as the matching `PlacedBar`). `Esc` returns to `select`.
 */
export type SectionTool =
  | "select"
  | "link"
  | "add-single"
  | "add-row"
  | "add-bundle"
  | "add-layer"
  | "measure";
/** N5: which of the `add-*` tools maps to which placement kind (else the tool isn't a placement tool). */
export const PLACE_KIND_BY_TOOL: Partial<Record<SectionTool, "single" | "row" | "bundle" | "layer">> = {
  "add-single": "single",
  "add-row": "row",
  "add-bundle": "bundle",
  "add-layer": "layer",
};

/**
 * v1.0.6-fix R5 — owner decision **O-3b** (2026-07-11): the tool an element **opens in**.
 *
 * The natural placed object on a slab or a joist is a **band** (a counted row across the width) — a
 * detailer adding steel over a support adds a band, not a lone bar (spec P-B: "honour the element-
 * appropriate semantics, don't flatten them"). So the slab family opens on `add-row`; every other section
 * opens on `select`, unchanged. Keyed off the SECTION family, not the element id (invariant 3), and `Esc`
 * always returns to `select`.
 */
export function defaultToolFor(doc: ElementDoc): SectionTool {
  const section = isGenericElement(doc.element) ? GENERIC_SPECS[doc.element].section : "RECT";
  return section === "SLAB" || section === "JOIST" ? "add-row" : "select";
}

/**
 * v1.0.6 N4 (U1, [REF-UI-830]) — the two editable 2D docks that flank the always-on 3D. `section`
 * (the coupe / pick canvas) sizes by WIDTH; `elevation` (the longitudinal view) sizes by HEIGHT. Each
 * is independently open/collapsed + resizable. Session-only layout, NOT in `.rcfg`, NOT reset on `reset()`.
 */
export type DockKey = "section" | "elevation";
export interface DockState {
  open: boolean;
  /** section dock = width (px); elevation dock = height (px). */
  size: number;
}
/** What a completed two-bar link on the section canvas creates (set by the driving panel). */
export type SectionLink =
  | { kind: "crosstie" }
  | { kind: "supplement"; supplementId: string; diameter: number };

/**
 * v1.0.6 N3 (U3, §0.3.4) — the ONE unified selection. Before N3 there were two disjoint channels:
 * `selectedBars` (bars, from the section picker / 3D) and `selectedGroupIds` (alert rows). N3 folds
 * them into one addressable `Selection` that drives the contextual inspector AND stays consistent with
 * the 3D/2D highlight (the low-level `selectedBars`/`selectedGroupIds`/`selectedExtraId` channels are
 * kept in sync by `select()` so the viewport is untouched). Session-only, NOT in `.rcfg`.
 */
export type Selection =
  | { kind: "bar"; index: number }
  | { kind: "extra"; id: string }
  /**
   * **v1.0.6-fix R2 (finding F-C)** — a bar in `doc.placed`: the v1.0.5 canonical placed model (single /
   * row / bundle / layer) that N5's tool palette creates. It was MISSING from the selection union, so a
   * click on a placed bar routed to `kind:"extra"`, the inspector looked it up in `doc.extraBars` (a
   * different array), found nothing, and showed "nothing selected" — while every N6 station action
   * (curtail / splice / anchorage) silently no-op'd on it. `id` is always the PARENT id: selecting any
   * member of a row/bundle/layer (`p1#2`) selects the object the user created and edits (`p1`).
   */
  | { kind: "placed"; id: string }
  | { kind: "crosstie"; index: number; barA: number; barB: number }
  | { kind: "alert"; groupIds: string[] }
  | null;

/** R2: a resolved placed bar's id is `p1` (a single) or `p1#2` (a row/bundle/layer member) → parent `p1`. */
export const placedParentIdOf = (id: string): string => id.split("#")[0]!;

/** Module-scoped counter for supplement instance ids (stable within a session, like the old panel). */
let suppInstanceCounter = 0;

export interface AppState {
  doc: ElementDoc;
  result: SolveResult;
  /** true while a slider/drag is active — viewport degrades, validation list is deferred. */
  dragMode: boolean;
  /** group ids highlighted in 3D (from clicking an alert row); [] = none. */
  selectedGroupIds: string[];
  /** advanced builder revealed (§5.6). */
  expert: boolean;
  lang: Lang;
  showSection: boolean;
  debugPerf: boolean;
  /** wall-clock of the last solve (ms) — shown by the perf HUD behind the debug flag. */
  lastSolveMs: number;
  /** H1 ([v1.0.4]): non-blocking solve-failure banner text; null when the last solve succeeded. */
  solveError: string | null;

  /** user-placed coupes (§9.5); index 0 is always the auto-managed default representative coupe. */
  cuts: SectionCut[];
  /** the coupe currently shown in the manager preview + 3D cutting-line. */
  activeCutId: string;
  /**
   * v1.0.6 N4 (U1, [REF-UI-830]) — the editable 2D docks flanking the always-on 3D. `section` hosts
   * the pick canvas + the coupe (it subsumes the old F4 Coupes bottom dock); `elevation` hosts the
   * longitudinal view. Session-only, NOT in `.rcfg`, NOT reset on element `reset()` (a layout pref).
   */
  docks: Record<DockKey, DockState>;
  /** F4 right-column sections (Verification / Project / BBS), each independently open/collapsed. */
  rightPanels: { verification: boolean; project: boolean; bbs: boolean };
  /** F4: widen the right column leftward over the 3D for focused reading ([REF-UI-830]). */
  expandPanels: boolean;

  // --- camera / ViewCube (Feature A, §1.7) — session state, NOT persisted in .rcfg ---
  /** camera projection mode (perspective ⇄ orthographic, §1.5). */
  projection: "perspective" | "orthographic";
  /** a one-shot request to snap the camera to a named view; the viewport consumes the nonce. */
  viewRequest: { id: string; nonce: number } | null;
  toggleProjection: () => void;
  /** snap to one of the 26 named views (§1.3); also the a11y/keyboard path (§1.6). */
  requestView: (id: string) => void;
  /** reset to the element-aware 3/4 iso default (§1.4). */
  homeView: () => void;
  /** F1 ([REF-SYS-811]): in-plane view roll (radians) — session state, NOT persisted in .rcfg. */
  rollRad: number;
  /** set the absolute roll angle (the free ring/slider). */
  setRoll: (rad: number) => void;
  /** nudge the roll by a delta (the ↺/↻ snap buttons). */
  rollBy: (deltaRad: number) => void;
  /** G9 ([REF-UI-850]): viewport navigation mode — left-drag orbits or pans. Session-only, NOT in .rcfg. */
  navMode: "orbit" | "pan";
  /** toggle the hand-pan tool on/off (orbit ⇄ pan). */
  toggleNavMode: () => void;
  /** set the navigation mode explicitly. */
  setNavMode: (mode: "orbit" | "pan") => void;

  // --- project model (Phase 7, §3.2) ---
  /** every element TYPE in the project; the active one is checked out into doc/cuts. */
  instances: ElementInstance[];
  activeInstanceId: string;
  /** snapshot the live doc/cuts back into the active instance (reconcile before any project read). */
  syncActiveInstance: () => ElementInstance[];
  addInstance: (element: ElementId) => void;
  duplicateActiveInstance: () => void;
  removeInstance: (id: string) => void;
  renameInstance: (id: string, mark: string) => void;
  setInstanceQuantity: (id: string, quantity: number) => void;
  selectInstance: (id: string) => void;
  /** reorder an instance one slot up (dir −1) or down (dir +1) — sheet/export order follows the list. */
  moveInstance: (id: string, dir: -1 | 1) => void;

  // catalog
  selectElement: (element: ElementId) => void;
  selectScheme: (schemeId: string) => void;

  // common edits
  setMaterial: (patch: Partial<ElementDoc["material"]>) => void;
  setCover: (mm: number) => void;
  setExposure: (exposure: string) => void;

  // column edits
  setGeometry: (patch: Partial<ColumnDoc["geometry"]>) => void;
  setLongitudinal: (patch: Partial<ColumnDoc["longitudinal"]>) => void;
  setTie: (patch: Partial<ColumnDoc["tie"]>) => void;

  // beam edits
  setBeamGeometry: (patch: Partial<BeamDoc["geometry"]>) => void;
  setSpan: (patch: Partial<BeamDoc["span"]>) => void;
  setStirrup: (patch: Partial<BeamDoc["stirrup"]>) => void;
  setTopBars: (patch: Partial<BeamDoc["topBars"]>) => void;
  // G3 two-support model: patch one support's chapeau / anchorage / width
  setSupport: (side: "left" | "right", patch: { chapeau?: Partial<SupportZone["chapeau"]>; anchorage?: number; width?: number }) => void;
  setReleves: (releves: ReleveZone[]) => void;
  /** G3: auto-seed editable stirrup regions (dense ends) from the two supports' zone lengths. */
  seedStirrupRegions: () => void;

  // generic-element edits (circular / slab / joist / stair)
  setGenericGeometry: (key: string, value: number) => void;
  setZone: (groupId: string, patch: Partial<ZoneEdit>) => void;
  setGenericFlag: (patch: Pick<Partial<GenericDoc>, "restrainedCorner" | "cornerTorsionProvided" | "mainBarWrapsCorner">) => void;

  // seismic regime (§7.10) — applies to the column + beam (plastic-hinge members)
  setSeismic: (seismic: SeismicEdit | null) => void;
  // A3/H13 ([v1.0.4]) — the active code pack (BAEL/EC2), stored on the doc + persisted in .rcfg
  setCodePack: (id: CodePackId) => void;

  // cross-ties (F2) — apply to the active column tie OR beam stirrup (same model)
  setCrossTies: (crossTies: CrossTie[]) => void;
  setCrossTieHookAngle: (angle: number) => void;

  // G2 addressable bars (column longitudinal / beam span)
  setBarOverrides: (overrides: BarOverrideEdit[]) => void;
  setExtraBars: (bars: AddressableBar[]) => void;

  // v1.0.6 N6 (U5, [REF-UI-811]) — the editable elevation's station-model edits. Each is committed
  // by BOTH the on-canvas drag (owner-GPU-verified) and its numeric twin in the inspector /
  // RegionEditor (headless-tested, §0.3.3). They target the ONE unified `selection` (a longitudinal
  // override or an independent extra); row/bundle/layer curtailment lands with the N5 selection (§7).
  /** curtail the selected bar: set (or, with `undefined`, clear) its start/end curtailment station. */
  curtailSelectedBar: (end: "start" | "end", station: number | undefined) => void;
  /** per-end anchorage where the selected bar stops (runs-through handle at a support). */
  setSelectedBarAnchorage: (choice: EndAnchorageChoice | undefined) => void;
  /** drop a lap/coupler on the selected bar at a station (deduped); remove one by station. */
  addSelectedBarSplice: (at: number, kind: Splice["kind"]) => void;
  removeSelectedBarSplice: (at: number) => void;
  /** grab a relevé's bend-up point → set its bend station (beam only). */
  setReleveBend: (id: string, station: number) => void;
  /** drag a stirrup/tie zone boundary → move region `index`'s upper edge (normalized, == the table). */
  moveStirrupRegionBoundary: (index: number, station: number) => void;

  // 2D section picker (F7): selected longitudinal bar indices (into result.bars), synced to 3D
  selectedBars: number[];
  setSelectedBars: (indices: number[]) => void;
  // H7 ([v1.0.4]): the selected INDEPENDENT extra bar (by its stable id), mutually exclusive with
  // `selectedBars`; picking an extra on the section picker opens its editor. null = none selected.
  selectedExtraId: string | null;
  setSelectedExtraId: (id: string | null) => void;

  // v1.0.6 N2 (U2, [REF-UI-555]) — ONE unified section canvas. `sectionTool` decides what a bar
  // click means; `sectionLink` (set while linking) says what a completed 2-bar link does; the three
  // former embedded pickers (bar-by-bar / cross-tie / supplement) now route through this one state.
  // Session-only (NOT in `.rcfg`), like projection/rollRad/navMode.
  sectionTool: SectionTool;
  sectionLink: SectionLink | null;
  pendingLinkBar: number | null;
  setSectionTool: (tool: SectionTool) => void;
  beginLink: (link: SectionLink) => void;
  cancelLink: () => void;
  pickSectionBar: (index: number) => void;
  pickSectionExtra: (id: string) => void;

  // v1.0.6 N5 (U4, [REF-UI-560]) — the placement palette. The active `add-*` tool + the palette
  // shape/Ø decide what a canvas click (or the typed-coordinate twin + Place) drops; `placeCoord` is
  // the live snapped section coordinate (the a11y/precision typable twin). All session-only, NOT in `.rcfg`.
  paletteShape: string;
  paletteDiameter: number;
  placeCoord: { u: number; v: number };
  setPaletteShape: (shapeId: string) => void;
  setPaletteDiameter: (d: number) => void;
  setPlaceCoord: (c: { u: number; v: number }) => void;
  /** the canonical placed steel on the active doc (single / row / bundle / layer). */
  setPlaced: (placed: PlacedBarDoc[]) => void;
  /** drop the palette shape as the matching `PlacedBar` at (snapped) (u,v); no-op if not an add-tool. */
  placeInSection: (u: number, v: number) => void;

  // v1.0.6 N3 (U3, §0.3.4) — the unified selection that drives the contextual inspector. `select`
  // is the single entry point: it sets `selection` and keeps the legacy highlight channels
  // (`selectedBars`/`selectedGroupIds`/`selectedExtraId`) mutually-exclusive + in sync.
  selection: Selection;
  select: (sel: Selection) => void;
  // U3 — the tabbed parameter form is kept behind an "Avancé / Advanced" toggle (session-only, a
  // layout pref like `rightPanels`; NOT reset on element `reset()`, NOT in `.rcfg`).
  advancedForm: boolean;
  setAdvancedForm: (on: boolean) => void;

  // supplements (§5.5)
  addSupplement: (edit: SupplementEdit) => void;
  removeSupplement: (instanceId: string) => void;
  rebindSupplement: (instanceId: string, barIndices: number[]) => void;

  // coupes (§9.5)
  addCut: (cut: SectionCut) => void;
  removeCut: (id: string) => void;
  updateCut: (id: string, patch: Partial<SectionCut>) => void;
  selectCut: (id: string) => void;
  /** N4 (U1): open/collapse a dock; resize it (width for section, height for elevation). */
  toggleDock: (key: DockKey) => void;
  resizeDock: (key: DockKey, size: number) => void;
  toggleRightPanel: (key: "verification" | "project" | "bbs") => void;
  toggleExpandPanels: () => void;

  // project I/O (§10) — accepts a legacy v1.0 single element OR a v1.1 project envelope
  loadProject: (project: RcfgProject) => void;

  setDragMode: (on: boolean) => void;
  selectGroups: (ids: string[]) => void;
  toggleExpert: () => void;
  toggleLang: () => void;
  toggleSection: () => void;
  toggleDebugPerf: () => void;
  reset: () => void;
}

interface DocSlice {
  doc: ElementDoc;
  result: SolveResult;
  lastSolveMs: number;
  cuts: SectionCut[];
  /** H1 ([v1.0.4]): a non-blocking solve-failure message (null = healthy). See `withDoc`. */
  solveError: string | null;
}

/**
 * Produce the next state slice from a new document: solve synchronously (timed for the HUD) and
 * re-seed the auto-managed default coupe at index 0, preserving any user-added cuts in `prevCuts`.
 * Pass `prevCuts = []` (the default) to drop user cuts — correct when the element/scheme changes,
 * since a cut's world position is meaningless against a different member.
 */
function withDoc(
  doc: ElementDoc,
  prevCuts: SectionCut[] = [],
  prevGood?: { result: SolveResult; cuts: SectionCut[] },
): DocSlice {
  const t0 = performance.now();
  let result: SolveResult;
  try {
    result = solveDoc(doc);
  } catch (err) {
    // H1 ([v1.0.4], owner A-6): a mid-edit solve failure must never blank the app. Keep the last
    // good result + coupes and surface a non-blocking banner; the next successful solve clears it.
    // The new (offending) `doc` is retained so the user's input stays on screen to be corrected.
    // No prior good result ⇒ the failure is genuinely unrecoverable (init) → rethrow.
    if (!prevGood) throw err;
    const solveError = err instanceof Error ? err.message : String(err);
    return { doc, result: prevGood.result, lastSolveMs: 0, cuts: prevGood.cuts, solveError };
  }
  const lastSolveMs = performance.now() - t0;
  const userCuts = prevCuts.filter((c) => !c.isDefault);
  return { doc, result, lastSolveMs, cuts: [defaultCoupeFor(result), ...userCuts], solveError: null };
}

const asColumn = (doc: ElementDoc, fn: (d: ColumnDoc) => ColumnDoc): ElementDoc =>
  isColumnDoc(doc) ? fn(doc) : doc;
const asBeam = (doc: ElementDoc, fn: (d: BeamDoc) => BeamDoc): ElementDoc =>
  isBeamDoc(doc) ? fn(doc) : doc;
const asGeneric = (doc: ElementDoc, fn: (d: GenericDoc) => GenericDoc): ElementDoc =>
  isGenericDoc(doc) ? fn(doc) : doc;

/** Drop keys whose value is `undefined` so clearing a station/anchorage removes the field entirely
 *  (keeping an otherwise-untouched bar byte-identical to legacy — N6). */
function stripUndef<T extends object>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
}

/**
 * v1.0.6 N6 — patch the currently selected bar's station model (curtailment / anchorage / splices),
 * routing a group override (by stable index) or an independent extra (by id) through the same setters
 * the inspector uses, then re-solving. `undefined`-valued patch keys are stripped (clears the field).
 */
function patchSelectedBar(get: () => AppState, patch: Record<string, unknown>): void {
  const { selection, doc } = get();
  if (!selection) return;
  if (selection.kind === "bar") {
    const group = isColumnDoc(doc) ? doc.longitudinal : isBeamDoc(doc) ? doc.span : null;
    if (!group) return;
    const overrides = group.barOverrides ?? [];
    const idx = selection.index;
    const next = overrides.some((o) => o.index === idx)
      ? overrides.map((o) => (o.index === idx ? (stripUndef({ ...o, ...patch }) as BarOverrideEdit) : o))
      : [...overrides, stripUndef({ index: idx, ...patch }) as BarOverrideEdit];
    get().setBarOverrides(next);
  } else if (selection.kind === "extra") {
    if (!isColumnDoc(doc) && !isBeamDoc(doc)) return;
    const extras = doc.extraBars ?? [];
    if (!extras.some((e) => e.id === selection.id)) return void noSilentInertEdit("extra", selection.id);
    const next = extras.map((e) => (e.id === selection.id ? (stripUndef({ ...e, ...patch }) as AddressableBar) : e));
    get().setExtraBars(next);
  } else if (selection.kind === "placed") {
    // R2 (F-C): the placed channel — the one N5 writes and N6 could not reach. Because EVERY member of
    // the `PlacedBarDoc` union shares the same body (shape/Ø/curtailment/anchorage/splices), the SAME
    // patch works on a single, a row, a bundle and a layer — so curtailing a row curtails all its bars.
    const placed = (doc as { placed?: PlacedBarDoc[] }).placed ?? [];
    if (!placed.some((p) => (p as { id: string }).id === selection.id)) {
      return void noSilentInertEdit("placed", selection.id);
    }
    const next = placed.map((p) =>
      (p as { id: string }).id === selection.id ? (stripUndef({ ...p, ...patch }) as PlacedBarDoc) : p,
    );
    get().setPlaced(next);
  }
}

/**
 * **Invariant 8 (v1.0.6-fix, R2): no silent inert edit.** A store action whose selection matches nothing
 * must SAY so — never `map` a list onto itself and commit an identical document, which is exactly how
 * finding F-C hid: N6's curtail/splice/anchorage actions "succeeded" on an N5-placed bar and changed
 * nothing, with no error anywhere. If this ever fires, a selection kind has been added without wiring its
 * write path.
 *
 * It REPORTS rather than throws — an exception inside a store action fires on a real user gesture (a drag,
 * a keystroke) and would take the app down for what is a wiring bug, not a data error. The console line is
 * the developer-facing signal; the regression test asserts it.
 */
function noSilentInertEdit(kind: string, id: string): void {
  console.error(
    `[store] selection {kind:"${kind}", id:"${id}"} matched no target — edit dropped (invariant 8: no silent inert edit).`,
  );
}

export const useStore = create<AppState>((set, get) => {
  const initial = withDoc(defaultColumnDoc());
  const firstInstance = makeInstance(initial.doc, initial.cuts, "P1");
  /** Solve `doc`, preserving the current user cuts + keeping the last good result on a solve throw. */
  const edit = (doc: ElementDoc) => withDoc(doc, get().cuts, { result: get().result, cuts: get().cuts });
  /** Check out an instance into the live editing slice (fresh solve + re-seeded default coupe). */
  const checkout = (inst: ElementInstance): DocSlice => withDoc(inst.doc, inst.cuts);
  return {
    doc: initial.doc,
    result: initial.result,
    lastSolveMs: initial.lastSolveMs,
    solveError: initial.solveError,
    cuts: initial.cuts,
    activeCutId: initial.cuts[0]!.id,
    instances: [firstInstance],
    activeInstanceId: firstInstance.id,
    dragMode: false,
    selectedGroupIds: [],
    selectedBars: [],
    selectedExtraId: null,
    sectionTool: "select",
    sectionLink: null,
    pendingLinkBar: null,
    paletteShape: "DROITE",
    paletteDiameter: 12,
    placeCoord: { u: 0, v: 0 },
    selection: null,
    advancedForm: true,
    expert: false,
    lang: "fr",
    showSection: false,
    debugPerf: false,
    docks: { section: { open: true, size: 300 }, elevation: { open: true, size: 200 } },
    rightPanels: { verification: true, project: false, bbs: false },
    expandPanels: false,
    projection: "perspective",
    viewRequest: null,
    rollRad: 0,
    navMode: "orbit",

    // --- project model (Phase 7) ---
    syncActiveInstance: () => {
      const { instances, activeInstanceId, doc, cuts } = get();
      const next = instances.map((i) =>
        i.id === activeInstanceId ? { ...i, doc, cuts } : i,
      );
      set({ instances: next });
      return next;
    },

    addInstance: (element) => {
      const synced = get().syncActiveInstance();
      const slice = withDoc(defaultDocFor(element));
      const inst = makeInstance(slice.doc, slice.cuts, defaultMark(element, synced.map((i) => i.mark)));
      set({
        instances: [...synced, inst],
        activeInstanceId: inst.id,
        ...slice,
        activeCutId: slice.cuts[0]!.id,
        selectedGroupIds: [],
        sectionTool: defaultToolFor(slice.doc),
      });
    },

    duplicateActiveInstance: () => {
      const synced = get().syncActiveInstance();
      const active = synced.find((i) => i.id === get().activeInstanceId);
      if (!active) return;
      const slice = withDoc(active.doc, active.cuts);
      const inst = makeInstance(slice.doc, slice.cuts, defaultMark(active.doc.element, synced.map((i) => i.mark)), active.quantity);
      set({
        instances: [...synced, inst],
        activeInstanceId: inst.id,
        ...slice,
        activeCutId: slice.cuts[0]!.id,
        selectedGroupIds: [],
      });
    },

    removeInstance: (id) => {
      const synced = get().syncActiveInstance();
      if (synced.length <= 1) return; // a project always has at least one element
      const idx = synced.findIndex((i) => i.id === id);
      const instances = synced.filter((i) => i.id !== id);
      if (id !== get().activeInstanceId) {
        set({ instances });
        return;
      }
      const next = instances[Math.max(0, idx - 1)]!;
      const slice = checkout(next);
      set({ instances, activeInstanceId: next.id, ...slice, activeCutId: slice.cuts[0]!.id, selectedGroupIds: [] });
    },

    renameInstance: (id, mark) =>
      set({ instances: get().syncActiveInstance().map((i) => (i.id === id ? { ...i, mark } : i)) }),

    setInstanceQuantity: (id, quantity) =>
      set({ instances: get().syncActiveInstance().map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.round(quantity)) } : i)) }),

    selectInstance: (id) => {
      const synced = get().syncActiveInstance();
      const target = synced.find((i) => i.id === id);
      if (!target || id === get().activeInstanceId) return;
      const slice = checkout(target);
      set({
        instances: synced,
        activeInstanceId: id,
        ...slice,
        activeCutId: slice.cuts[0]!.id,
        selectedGroupIds: [],
        sectionTool: defaultToolFor(slice.doc),
      });
    },

    moveInstance: (id, dir) => {
      const synced = get().syncActiveInstance();
      const idx = synced.findIndex((i) => i.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= synced.length) return; // out of range: no-op
      const next = synced.slice();
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      set({ instances: next }); // reorder only — the active checkout (doc/cuts) is untouched
    },

    selectElement: (element) => {
      const s = withDoc(defaultDocFor(element));
      set({ ...s, selectedGroupIds: [], activeCutId: s.cuts[0]!.id, sectionTool: defaultToolFor(s.doc) });
    },

    selectScheme: (schemeId) => {
      const cur = get().doc;
      const base = defaultDocFor(cur.element, schemeId);
      // keep the project edits (geometry/material/cover/exposure), remap the reinforcement
      const merged = {
        ...base,
        geometry: cur.geometry,
        material: cur.material,
        cover: cur.cover,
        exposure: cur.exposure,
        ...(cur.fire !== undefined ? { fire: cur.fire } : {}),
        dg: cur.dg,
        supplements: [],
      } as ElementDoc;
      const s = withDoc(merged);
      set({ ...s, selectedGroupIds: [], activeCutId: s.cuts[0]!.id });
    },

    setMaterial: (patch) =>
      set(edit({ ...get().doc, material: { ...get().doc.material, ...patch } })),
    setCover: (mm) => set(edit({ ...get().doc, cover: mm })),
    setExposure: (exposure) => set(edit({ ...get().doc, exposure })),

    setGeometry: (patch) =>
      set(edit(asColumn(get().doc, (d) => ({ ...d, geometry: { ...d.geometry, ...patch } })))),
    setLongitudinal: (patch) =>
      set(edit(asColumn(get().doc, (d) => ({ ...d, longitudinal: { ...d.longitudinal, ...patch } })))),
    setTie: (patch) =>
      set(edit(asColumn(get().doc, (d) => ({ ...d, tie: { ...d.tie, ...patch } })))),

    setCrossTies: (crossTies) => {
      const doc = get().doc;
      if (isColumnDoc(doc)) set(edit({ ...doc, tie: { ...doc.tie, crossTies } }));
      else if (isBeamDoc(doc)) set(edit({ ...doc, stirrup: { ...doc.stirrup, crossTies } }));
    },
    setCrossTieHookAngle: (angle) => {
      const doc = get().doc;
      if (isColumnDoc(doc)) set(edit({ ...doc, tie: { ...doc.tie, crossTieHookAngle: angle } }));
      else if (isBeamDoc(doc)) set(edit({ ...doc, stirrup: { ...doc.stirrup, crossTieHookAngle: angle } }));
    },

    setBarOverrides: (overrides) => {
      const doc = get().doc;
      if (isColumnDoc(doc)) set(edit({ ...doc, longitudinal: { ...doc.longitudinal, barOverrides: overrides } }));
      else if (isBeamDoc(doc)) set(edit({ ...doc, span: { ...doc.span, barOverrides: overrides } }));
    },
    setExtraBars: (bars) => {
      const doc = get().doc;
      if (isColumnDoc(doc)) set(edit({ ...doc, extraBars: bars }));
      else if (isBeamDoc(doc)) set(edit({ ...doc, extraBars: bars }));
    },
    setSelectedBars: (indices) => set({ selectedBars: indices }),
    setSelectedExtraId: (id) => set({ selectedExtraId: id }),

    // --- v1.0.6 N6 (U5) — station-model edits on the currently selected bar ---------------------
    // One private router patches the selected bar (a group override by index, or an extra by id) and
    // re-solves through the same setters the inspector uses; undefined-valued keys are stripped so a
    // cleared curtailment leaves no field behind. Used by curtail / anchorage / splice below.
    curtailSelectedBar: (end, station) => {
      const field = end === "start" ? "startStation" : "endStation";
      patchSelectedBar(get, { [field]: station });
    },
    setSelectedBarAnchorage: (choice) => patchSelectedBar(get, { anchorage: choice }),
    addSelectedBarSplice: (at, kind) => {
      const cur = selectedBarStations(get().doc, get().selection);
      if (!cur) return;
      const next: Splice[] = [...cur.splices.filter((sp) => sp.at !== at), { at, kind }].sort((a, b) => a.at - b.at);
      patchSelectedBar(get, { splices: next });
    },
    removeSelectedBarSplice: (at) => {
      const cur = selectedBarStations(get().doc, get().selection);
      if (!cur) return;
      const next = cur.splices.filter((sp) => sp.at !== at);
      // empty list → clear the field (undefined) so an otherwise-untouched bar stays legacy-identical.
      patchSelectedBar(get, { splices: next.length ? next : undefined });
    },
    setReleveBend: (id, station) => {
      const doc = get().doc;
      if (!isBeamDoc(doc)) return;
      const releves = (doc.releves ?? []).map((r) => (r.id === id ? { ...r, bendStation: Math.max(0, Math.round(station)) } : r));
      get().setReleves(releves);
    },
    moveStirrupRegionBoundary: (index, station) => {
      const doc = get().doc;
      if (!isColumnDoc(doc) && !isBeamDoc(doc)) return;
      const tset = isColumnDoc(doc) ? doc.tie : doc.stirrup;
      const length = memberAxisLength(doc);
      const rows = effectiveRegions(tset.regions, length, tset.spacing).map((r) => ({ ...r }));
      if (index < 0 || index >= rows.length) return;
      rows[index]!.to = station;
      const next = normalizeRegions(rows, length, tset.spacing);
      if (isColumnDoc(doc)) get().setTie({ regions: next });
      else get().setStirrup({ regions: next });
    },

    // v1.0.6 N3 (U3, §0.3.4) — the unified selection entry point. Sets `selection` and keeps the
    // legacy highlight channels mutually-exclusive so the inspector, the 3D and the 2D all agree.
    select: (sel) => {
      if (!sel) {
        set({ selection: null, selectedBars: [], selectedExtraId: null, selectedGroupIds: [] });
        return;
      }
      switch (sel.kind) {
        case "bar":
          set({ selection: sel, selectedBars: [sel.index], selectedExtraId: null, selectedGroupIds: [] });
          break;
        case "extra":
          set({ selection: sel, selectedExtraId: sel.id, selectedBars: [], selectedGroupIds: [] });
          break;
        case "placed":
          // R2: reuse the `selectedExtraId` highlight channel — a placed bar resolves to a `standalone`
          // longBar whose `groupId` IS its id, which is exactly what that channel already highlights.
          // Holding the PARENT id here makes every member of a row/bundle/layer light up together.
          set({ selection: sel, selectedExtraId: sel.id, selectedBars: [], selectedGroupIds: [] });
          break;
        case "crosstie":
          // highlight both engaged bars while the tie is the inspected object.
          set({ selection: sel, selectedBars: [sel.barA, sel.barB], selectedExtraId: null, selectedGroupIds: [] });
          break;
        case "alert":
          set({ selection: sel, selectedGroupIds: sel.groupIds, selectedBars: [], selectedExtraId: null });
          break;
      }
    },
    setAdvancedForm: (on) => set({ advancedForm: on }),

    // v1.0.6 N2 (U2) + N5 (U4) — the ONE section canvas tool router. Switching to any tool that is not
    // `link` clears the armed link state (so arming, then picking an add-tool, doesn't leave it dangling).
    setSectionTool: (tool) =>
      set(tool === "link" ? { sectionTool: "link" } : { sectionTool: tool, sectionLink: null, pendingLinkBar: null }),
    beginLink: (link) =>
      set({ sectionTool: "link", sectionLink: link, pendingLinkBar: null, selectedBars: [], selectedExtraId: null }),
    cancelLink: () => set({ sectionTool: "select", sectionLink: null, pendingLinkBar: null, selectedBars: [] }),
    pickSectionExtra: (id) => {
      set({ pendingLinkBar: null });
      // R2 (F-C): the canvas renders EVERY standalone resolved bar the same way, so it cannot tell a
      // legacy `extraBars` bar from a v1.0.5 `placed` bar — but the doc can. Resolve the id here, once,
      // and route to the right selection kind. Before R2 everything routed to `extra`, so an N5-placed
      // bar was selectable but un-inspectable and un-editable (silently).
      const doc = get().doc;
      const parent = placedParentIdOf(id);
      const isPlaced = ((doc as { placed?: PlacedBarDoc[] }).placed ?? []).some(
        (p) => (p as { id: string }).id === parent,
      );
      get().select(isPlaced ? { kind: "placed", id: parent } : { kind: "extra", id });
    },
    pickSectionBar: (index) => {
      const { sectionTool, sectionLink, pendingLinkBar } = get();
      // SELECT: pick one bar → the unified selection (drives the inspector + the 3D/2D highlight).
      if (sectionTool !== "link" || !sectionLink) {
        get().select({ kind: "bar", index });
        return;
      }
      // LINK: first click arms; re-clicking the pending bar de-selects; a second distinct bar completes.
      if (pendingLinkBar === null) {
        set({ pendingLinkBar: index, selectedBars: [index], selectedExtraId: null });
        return;
      }
      if (pendingLinkBar === index) {
        set({ pendingLinkBar: null, selectedBars: [] });
        return;
      }
      const a = pendingLinkBar;
      const b = index;
      if (sectionLink.kind === "crosstie") {
        const doc = get().doc;
        const cfg = isColumnDoc(doc) ? doc.tie : isBeamDoc(doc) ? doc.stirrup : null;
        if (cfg) {
          const dup = cfg.crossTies.some(
            (ct) => (ct.barA === a && ct.barB === b) || (ct.barA === b && ct.barB === a),
          );
          if (!dup) get().setCrossTies([...cfg.crossTies, { barA: a, barB: b }]);
        }
      } else {
        const doc = get().doc;
        const group = isColumnDoc(doc)
          ? doc.longitudinal.groupId
          : isBeamDoc(doc)
            ? doc.span.groupId
            : (doc.zones[0]?.groupId ?? "");
        get().addSupplement({
          instanceId: `S${++suppInstanceCounter}`,
          supplementId: sectionLink.supplementId,
          group,
          barIndices: [a, b],
          diameter: sectionLink.diameter,
        });
      }
      // stay armed for more links; just clear the pending pick
      set({ pendingLinkBar: null, selectedBars: [] });
    },

    // v1.0.6 N5 (U4) — the placement palette.
    setPaletteShape: (shapeId) => set({ paletteShape: shapeId }),
    setPaletteDiameter: (d) => set({ paletteDiameter: d }),
    setPlaceCoord: (c) => set({ placeCoord: c }),
    setPlaced: (placed) => {
      const doc = get().doc;
      set(edit({ ...doc, placed } as ElementDoc));
    },
    placeInSection: (u, v) => {
      const { doc, result, sectionTool, paletteShape, paletteDiameter } = get();
      // R5 (F-D): the frame comes from the ENGINE's section descriptor (`result.member`), so every one of
      // the 8 elements clamps — a slab against its `Ly×t` box, a pile/circular column RADIALLY. Before R5
      // a non-column/beam doc was handed no `b`/`h` and the cover envelope was silently skipped entirely.
      const frame = sectionFrame(result, doc.cover);
      const snapped = snapToFrame(frame, u, v, paletteDiameter);
      set({ placeCoord: snapped }); // keep the typed-coordinate twin in sync with the snapped drop
      const kind = PLACE_KIND_BY_TOOL[sectionTool];
      if (!kind) return; // select / link / measure: no drop, just the readout
      const existing = (doc as { placed?: PlacedBarDoc[] }).placed ?? [];
      const bar = buildPlacedBar(kind, {
        id: freshPlacedId(existing),
        u: snapped.u,
        v: snapped.v,
        shapeId: paletteShape,
        diameter: paletteDiameter,
        frame,
      });
      get().setPlaced([...existing, bar]);
    },

    setBeamGeometry: (patch) =>
      set(edit(asBeam(get().doc, (d) => ({ ...d, geometry: { ...d.geometry, ...patch } })))),
    setSpan: (patch) =>
      set(edit(asBeam(get().doc, (d) => ({ ...d, span: { ...d.span, ...patch } })))),
    setStirrup: (patch) =>
      set(edit(asBeam(get().doc, (d) => ({ ...d, stirrup: { ...d.stirrup, ...patch } })))),
    setTopBars: (patch) =>
      set(edit(asBeam(get().doc, (d) => ({ ...d, topBars: { ...d.topBars, ...patch } })))),
    setSupport: (side, patch) =>
      set(edit(asBeam(get().doc, (d) => ({
        ...d,
        supports: {
          ...d.supports,
          [side]: {
            ...d.supports[side],
            ...(patch.anchorage !== undefined ? { anchorage: patch.anchorage } : {}),
            ...(patch.width !== undefined ? { width: patch.width } : {}),
            chapeau: { ...d.supports[side].chapeau, ...(patch.chapeau ?? {}) },
          },
        },
      })))),
    setReleves: (releves) =>
      set(edit(asBeam(get().doc, (d) => ({ ...d, releves })))),
    seedStirrupRegions: () =>
      set(edit(asBeam(get().doc, (d) => ({
        ...d,
        stirrup: {
          ...d.stirrup,
          regions: supportSeededRegions(
            d.geometry.L,
            d.supports.left.chapeau.enabled ? d.supports.left.chapeau.length : 0,
            d.supports.right.chapeau.enabled ? d.supports.right.chapeau.length : 0,
            d.stirrup.spacing,
          ),
        },
      })))),

    setGenericGeometry: (key, value) =>
      set(edit(asGeneric(get().doc, (d) => ({ ...d, geometry: { ...d.geometry, [key]: value } })))),
    setZone: (groupId, patch) =>
      set(edit(asGeneric(get().doc, (d) => ({
        ...d,
        zones: d.zones.map((z) => (z.groupId === groupId ? { ...z, ...patch } : z)),
      })))),
    setGenericFlag: (patch) =>
      set(edit(asGeneric(get().doc, (d) => ({ ...d, ...patch })))),

    setSeismic: (seismic) => {
      const doc = get().doc;
      if (isGenericDoc(doc)) return; // seismic overlay applies to column/beam only (v1.0)
      const next = seismic === null
        ? { ...doc, seismic: undefined }
        : { ...doc, seismic };
      set(edit(next as ElementDoc));
    },

    setCodePack: (id) => set(edit({ ...get().doc, codePack: id })),

    addSupplement: (edit2) =>
      set(edit({ ...get().doc, supplements: [...get().doc.supplements, edit2] })),
    removeSupplement: (instanceId) =>
      set(edit({
        ...get().doc,
        supplements: get().doc.supplements.filter((s) => s.instanceId !== instanceId),
      })),
    rebindSupplement: (instanceId, barIndices) =>
      set(edit({
        ...get().doc,
        supplements: get().doc.supplements.map((s) =>
          s.instanceId === instanceId ? { ...s, barIndices } : s,
        ),
      })),

    addCut: (cut) => set({ cuts: [...get().cuts, cut], activeCutId: cut.id }),
    removeCut: (id) => {
      const cut = get().cuts.find((c) => c.id === id);
      if (!cut || cut.isDefault) return; // the default coupe is auto-managed, not removable
      const cuts = get().cuts.filter((c) => c.id !== id);
      const activeCutId = get().activeCutId === id ? cuts[0]!.id : get().activeCutId;
      set({ cuts, activeCutId });
    },
    updateCut: (id, patch) =>
      set({
        cuts: get().cuts.map((c) =>
          c.id === id && !c.isDefault ? { ...c, ...patch, id: c.id, isDefault: false } : c,
        ),
      }),
    selectCut: (id) => set({ activeCutId: id }),
    // N4 (U1): the docks are a session layout pref (like `rightPanels`). Min size floors keep a
    // resized dock usable; nothing here touches the document or `.rcfg`.
    toggleDock: (key) =>
      set({ docks: { ...get().docks, [key]: { ...get().docks[key], open: !get().docks[key].open } } }),
    resizeDock: (key, size) =>
      set({
        docks: {
          ...get().docks,
          [key]: { ...get().docks[key], size: Math.max(120, Math.round(size)) },
        },
      }),
    toggleRightPanel: (key) =>
      set({ rightPanels: { ...get().rightPanels, [key]: !get().rightPanels[key] } }),
    toggleExpandPanels: () => set({ expandPanels: !get().expandPanels }),

    loadProject: (project) => {
      const instances = rcfgToInstances(project);
      if (!instances || instances.length === 0) return; // no recoverable doc (other-tool/future file)
      const first = instances[0]!;
      const slice = checkout(first);
      set({
        instances,
        activeInstanceId: first.id,
        ...slice,
        activeCutId: slice.cuts[0]!.id,
        selectedGroupIds: [],
        expert: false,
      });
    },

    toggleProjection: () =>
      set({ projection: get().projection === "perspective" ? "orthographic" : "perspective" }),
    // snapping to any named view (incl. Home) RE-LEVELS the roll (§1.2): roll is a temporary tweak.
    requestView: (id) => set({ viewRequest: { id, nonce: (get().viewRequest?.nonce ?? 0) + 1 }, rollRad: 0 }),
    homeView: () =>
      set({ viewRequest: { id: DEFAULT_VIEW_ID, nonce: (get().viewRequest?.nonce ?? 0) + 1 }, rollRad: 0 }),
    setRoll: (rad) => set({ rollRad: rad }),
    rollBy: (deltaRad) => set({ rollRad: get().rollRad + deltaRad }),
    toggleNavMode: () => set({ navMode: get().navMode === "orbit" ? "pan" : "orbit" }),
    setNavMode: (mode) => set({ navMode: mode }),

    setDragMode: (on) => set({ dragMode: on }),
    // N3 (U3): an alert row is a unified-selection object — clear the bar/extra channels so the
    // inspector + highlight reflect exactly one selection. Empty ids → clear the selection.
    selectGroups: (ids) =>
      set(
        ids.length === 0
          ? { selectedGroupIds: [], selection: null }
          : { selectedGroupIds: ids, selectedBars: [], selectedExtraId: null, selection: { kind: "alert", groupIds: ids } },
      ),
    toggleExpert: () => set({ expert: !get().expert }),
    toggleLang: () => set({ lang: get().lang === "fr" ? "en" : "fr" }),
    toggleSection: () => set({ showSection: !get().showSection }),
    toggleDebugPerf: () => set({ debugPerf: !get().debugPerf }),
    reset: () => {
      const s = withDoc(defaultColumnDoc());
      const inst = makeInstance(s.doc, s.cuts, "P1");
      set({
        ...s,
        activeCutId: s.cuts[0]!.id,
        instances: [inst],
        activeInstanceId: inst.id,
        selectedGroupIds: [],
        selectedBars: [],
        selectedExtraId: null,
        sectionTool: "select",
        sectionLink: null,
        pendingLinkBar: null,
        paletteShape: "DROITE",
        paletteDiameter: 12,
        placeCoord: { u: 0, v: 0 },
        selection: null,
        expert: false,
        projection: "perspective",
        viewRequest: null,
        rollRad: 0,
        navMode: "orbit",
      });
    },
  };
});
