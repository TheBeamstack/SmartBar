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
  type ElementId,
  type SupplementEdit,
  defaultColumnDoc,
  defaultDocFor,
  isColumnDoc,
  isBeamDoc,
} from "../engine/document";
import { rcfgToDoc } from "../engine/rcfgDoc";
import { solveDoc, type SolveResult } from "../engine/solveDoc";

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
  /** which bottom panel is open (coupe manager / BBS table), or none. */
  bottomPanel: "coupes" | "bbs" | null;

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

  // supplements (§5.5)
  addSupplement: (edit: SupplementEdit) => void;
  removeSupplement: (instanceId: string) => void;
  rebindSupplement: (instanceId: string, barIndices: number[]) => void;

  // coupes (§9.5)
  addCut: (cut: SectionCut) => void;
  removeCut: (id: string) => void;
  updateCut: (id: string, patch: Partial<SectionCut>) => void;
  selectCut: (id: string) => void;
  setBottomPanel: (panel: "coupes" | "bbs" | null) => void;

  // project I/O (§10)
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

export const useStore = create<AppState>((set, get) => {
  const initial = withDoc(defaultColumnDoc());
  /** Solve `doc`, preserving the current user cuts (call sites that switch element pass nothing). */
  const edit = (doc: ElementDoc) => withDoc(doc, get().cuts);
  return {
    doc: initial.doc,
    result: initial.result,
    lastSolveMs: initial.lastSolveMs,
    cuts: initial.cuts,
    activeCutId: initial.cuts[0]!.id,
    dragMode: false,
    selectedGroupIds: [],
    expert: false,
    lang: "fr",
    showSection: false,
    debugPerf: false,
    bottomPanel: null,

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
      const doc = rcfgToDoc(project);
      if (!doc) return; // a file with no recoverable app_document (other-tool/future file) — ignore
      const result = solveDoc(doc);
      const seeded = defaultCoupeFor(result);
      const userCuts = (project.section_cuts ?? []).filter((c) => !c.isDefault);
      const cuts = [seeded, ...userCuts];
      set({ doc, result, lastSolveMs: 0, cuts, activeCutId: seeded.id, selectedGroupIds: [], expert: false });
    },

    setDragMode: (on) => set({ dragMode: on }),
    selectGroups: (ids) => set({ selectedGroupIds: ids }),
    toggleExpert: () => set({ expert: !get().expert }),
    toggleLang: () => set({ lang: get().lang === "fr" ? "en" : "fr" }),
    toggleSection: () => set({ showSection: !get().showSection }),
    toggleDebugPerf: () => set({ debugPerf: !get().debugPerf }),
    reset: () => {
      const s = withDoc(defaultColumnDoc());
      set({ ...s, activeCutId: s.cuts[0]!.id, selectedGroupIds: [], expert: false });
    },
  };
});
