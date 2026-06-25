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
import { defaultCoupeFor, type SectionCut } from "@rebarconfig/core";
import { type RcfgProject } from "@rebarconfig/exporters";
import type { Lang } from "../i18n/strings";
import {
  type ElementDoc,
  type ColumnDoc,
  type BeamDoc,
  type GenericDoc,
  type ZoneEdit,
  type SeismicEdit,
  type ElementId,
  type SupplementEdit,
  defaultColumnDoc,
  defaultDocFor,
  isColumnDoc,
  isBeamDoc,
  isGenericDoc,
} from "../engine/document";
import { solveDoc, type SolveResult } from "../engine/solveDoc";
import {
  type ElementInstance,
  makeInstance,
  defaultMark,
} from "../engine/project";
import { rcfgToInstances } from "../engine/projectRcfg";

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

  /** user-placed coupes (§9.5); index 0 is always the auto-managed default representative coupe. */
  cuts: SectionCut[];
  /** the coupe currently shown in the manager preview + 3D cutting-line. */
  activeCutId: string;
  /** which bottom panel is open (coupe manager / BBS table / project takeoff), or none. */
  bottomPanel: "coupes" | "bbs" | "project" | null;

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
  setChapeau: (patch: Partial<BeamDoc["chapeau"]>) => void;
  setStirrup: (patch: Partial<BeamDoc["stirrup"]>) => void;
  setTopBars: (patch: Partial<BeamDoc["topBars"]>) => void;

  // generic-element edits (circular / slab / joist / stair)
  setGenericGeometry: (key: string, value: number) => void;
  setZone: (groupId: string, patch: Partial<ZoneEdit>) => void;
  setGenericFlag: (patch: Pick<Partial<GenericDoc>, "restrainedCorner" | "cornerTorsionProvided" | "mainBarWrapsCorner">) => void;

  // seismic regime (§7.10) — applies to the column + beam (plastic-hinge members)
  setSeismic: (seismic: SeismicEdit | null) => void;

  // supplements (§5.5)
  addSupplement: (edit: SupplementEdit) => void;
  removeSupplement: (instanceId: string) => void;
  rebindSupplement: (instanceId: string, barIndices: number[]) => void;

  // coupes (§9.5)
  addCut: (cut: SectionCut) => void;
  removeCut: (id: string) => void;
  updateCut: (id: string, patch: Partial<SectionCut>) => void;
  selectCut: (id: string) => void;
  setBottomPanel: (panel: "coupes" | "bbs" | "project" | null) => void;

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
}

/**
 * Produce the next state slice from a new document: solve synchronously (timed for the HUD) and
 * re-seed the auto-managed default coupe at index 0, preserving any user-added cuts in `prevCuts`.
 * Pass `prevCuts = []` (the default) to drop user cuts — correct when the element/scheme changes,
 * since a cut's world position is meaningless against a different member.
 */
function withDoc(doc: ElementDoc, prevCuts: SectionCut[] = []): DocSlice {
  const t0 = performance.now();
  const result = solveDoc(doc);
  const lastSolveMs = performance.now() - t0;
  const userCuts = prevCuts.filter((c) => !c.isDefault);
  return { doc, result, lastSolveMs, cuts: [defaultCoupeFor(result), ...userCuts] };
}

const asColumn = (doc: ElementDoc, fn: (d: ColumnDoc) => ColumnDoc): ElementDoc =>
  isColumnDoc(doc) ? fn(doc) : doc;
const asBeam = (doc: ElementDoc, fn: (d: BeamDoc) => BeamDoc): ElementDoc =>
  isBeamDoc(doc) ? fn(doc) : doc;
const asGeneric = (doc: ElementDoc, fn: (d: GenericDoc) => GenericDoc): ElementDoc =>
  isGenericDoc(doc) ? fn(doc) : doc;

export const useStore = create<AppState>((set, get) => {
  const initial = withDoc(defaultColumnDoc());
  const firstInstance = makeInstance(initial.doc, initial.cuts, "P1");
  /** Solve `doc`, preserving the current user cuts (call sites that switch element pass nothing). */
  const edit = (doc: ElementDoc) => withDoc(doc, get().cuts);
  /** Check out an instance into the live editing slice (fresh solve + re-seeded default coupe). */
  const checkout = (inst: ElementInstance): DocSlice => withDoc(inst.doc, inst.cuts);
  return {
    doc: initial.doc,
    result: initial.result,
    lastSolveMs: initial.lastSolveMs,
    cuts: initial.cuts,
    activeCutId: initial.cuts[0]!.id,
    instances: [firstInstance],
    activeInstanceId: firstInstance.id,
    dragMode: false,
    selectedGroupIds: [],
    expert: false,
    lang: "fr",
    showSection: false,
    debugPerf: false,
    bottomPanel: null,

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
      set({ instances: synced, activeInstanceId: id, ...slice, activeCutId: slice.cuts[0]!.id, selectedGroupIds: [] });
    },

    selectElement: (element) => {
      const s = withDoc(defaultDocFor(element));
      set({ ...s, selectedGroupIds: [], activeCutId: s.cuts[0]!.id });
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

    setBeamGeometry: (patch) =>
      set(edit(asBeam(get().doc, (d) => ({ ...d, geometry: { ...d.geometry, ...patch } })))),
    setSpan: (patch) =>
      set(edit(asBeam(get().doc, (d) => ({ ...d, span: { ...d.span, ...patch } })))),
    setChapeau: (patch) =>
      set(edit(asBeam(get().doc, (d) => ({ ...d, chapeau: { ...d.chapeau, ...patch } })))),
    setStirrup: (patch) =>
      set(edit(asBeam(get().doc, (d) => ({ ...d, stirrup: { ...d.stirrup, ...patch } })))),
    setTopBars: (patch) =>
      set(edit(asBeam(get().doc, (d) => ({ ...d, topBars: { ...d.topBars, ...patch } })))),

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
    setBottomPanel: (panel) => set({ bottomPanel: get().bottomPanel === panel ? null : panel }),

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

    setDragMode: (on) => set({ dragMode: on }),
    selectGroups: (ids) => set({ selectedGroupIds: ids }),
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
        expert: false,
      });
    },
  };
});
