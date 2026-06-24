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

  setDragMode: (on: boolean) => void;
  selectGroups: (ids: string[]) => void;
  toggleExpert: () => void;
  toggleLang: () => void;
  toggleSection: () => void;
  toggleDebugPerf: () => void;
  reset: () => void;
}

/** Produce the next state slice from a new document (solve synchronously, timed for the HUD). */
function withDoc(doc: ElementDoc): { doc: ElementDoc; result: SolveResult; lastSolveMs: number } {
  const t0 = performance.now();
  const result = solveDoc(doc);
  return { doc, result, lastSolveMs: performance.now() - t0 };
}

const asColumn = (doc: ElementDoc, fn: (d: ColumnDoc) => ColumnDoc): ElementDoc =>
  isColumnDoc(doc) ? fn(doc) : doc;
const asBeam = (doc: ElementDoc, fn: (d: BeamDoc) => BeamDoc): ElementDoc =>
  isBeamDoc(doc) ? fn(doc) : doc;

export const useStore = create<AppState>((set, get) => {
  const initial = withDoc(defaultColumnDoc());
  return {
    doc: initial.doc,
    result: initial.result,
    lastSolveMs: initial.lastSolveMs,
    dragMode: false,
    selectedGroupIds: [],
    expert: false,
    lang: "fr",
    showSection: false,
    debugPerf: false,

    selectElement: (element) =>
      set({ ...withDoc(defaultDocFor(element)), selectedGroupIds: [] }),

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
      set({ ...withDoc(merged), selectedGroupIds: [] });
    },

    setMaterial: (patch) =>
      set(withDoc({ ...get().doc, material: { ...get().doc.material, ...patch } })),
    setCover: (mm) => set(withDoc({ ...get().doc, cover: mm })),
    setExposure: (exposure) => set(withDoc({ ...get().doc, exposure })),

    setGeometry: (patch) =>
      set(withDoc(asColumn(get().doc, (d) => ({ ...d, geometry: { ...d.geometry, ...patch } })))),
    setLongitudinal: (patch) =>
      set(withDoc(asColumn(get().doc, (d) => ({ ...d, longitudinal: { ...d.longitudinal, ...patch } })))),
    setTie: (patch) =>
      set(withDoc(asColumn(get().doc, (d) => ({ ...d, tie: { ...d.tie, ...patch } })))),

    setBeamGeometry: (patch) =>
      set(withDoc(asBeam(get().doc, (d) => ({ ...d, geometry: { ...d.geometry, ...patch } })))),
    setSpan: (patch) =>
      set(withDoc(asBeam(get().doc, (d) => ({ ...d, span: { ...d.span, ...patch } })))),
    setChapeau: (patch) =>
      set(withDoc(asBeam(get().doc, (d) => ({ ...d, chapeau: { ...d.chapeau, ...patch } })))),
    setStirrup: (patch) =>
      set(withDoc(asBeam(get().doc, (d) => ({ ...d, stirrup: { ...d.stirrup, ...patch } })))),

    addSupplement: (edit) =>
      set(withDoc({ ...get().doc, supplements: [...get().doc.supplements, edit] })),
    removeSupplement: (instanceId) =>
      set(withDoc({
        ...get().doc,
        supplements: get().doc.supplements.filter((s) => s.instanceId !== instanceId),
      })),
    rebindSupplement: (instanceId, barIndices) =>
      set(withDoc({
        ...get().doc,
        supplements: get().doc.supplements.map((s) =>
          s.instanceId === instanceId ? { ...s, barIndices } : s,
        ),
      })),

    setDragMode: (on) => set({ dragMode: on }),
    selectGroups: (ids) => set({ selectedGroupIds: ids }),
    toggleExpert: () => set({ expert: !get().expert }),
    toggleLang: () => set({ lang: get().lang === "fr" ? "en" : "fr" }),
    toggleSection: () => set({ showSection: !get().showSection }),
    toggleDebugPerf: () => set({ debugPerf: !get().debugPerf }),
    reset: () => set({ ...withDoc(defaultColumnDoc()), selectedGroupIds: [], expert: false }),
  };
});
