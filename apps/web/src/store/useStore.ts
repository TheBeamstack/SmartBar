/**
 * Zustand store (spec §2.1): holds the active element document; EVERY mutation triggers a
 * synchronous engine re-solve + a fresh SolveResult in the same tick — no reload, no network.
 *
 * Correctness is never skipped on commit (plan §2.2): the solve always runs (it is well under
 * the 16 ms budget). `dragMode` does NOT gate the solve — it only tells the *viewport* to
 * degrade its render (centreline LineSegments instead of rebuilt tubes) and the alerts panel
 * to defer the live list until drag-release. See rebarProps.ts for that pure mapping.
 */
import { create } from "zustand";
import type { Lang } from "../i18n/strings";
import { type ColumnDoc, defaultColumnDoc } from "../engine/document";
import { solveDoc, type SolveResult } from "../engine/solveDoc";

export interface AppState {
  doc: ColumnDoc;
  result: SolveResult;
  /** true while a slider/drag is active — viewport degrades, validation list is deferred. */
  dragMode: boolean;
  /** group ids highlighted in 3D (from clicking an alert row); [] = none. */
  selectedGroupIds: string[];
  lang: Lang;
  showSection: boolean;
  debugPerf: boolean;
  /** wall-clock of the last solve (ms) — shown by the perf HUD behind the debug flag. */
  lastSolveMs: number;

  setGeometry: (patch: Partial<ColumnDoc["geometry"]>) => void;
  setMaterial: (patch: Partial<ColumnDoc["material"]>) => void;
  setLongitudinal: (patch: Partial<ColumnDoc["longitudinal"]>) => void;
  setTie: (patch: Partial<ColumnDoc["tie"]>) => void;
  setCover: (mm: number) => void;
  setExposure: (exposure: string) => void;

  setDragMode: (on: boolean) => void;
  selectGroups: (ids: string[]) => void;
  toggleLang: () => void;
  toggleSection: () => void;
  toggleDebugPerf: () => void;
  reset: () => void;
}

/** Produce the next state slice from a new document (solve synchronously, timed for the HUD). */
function withDoc(doc: ColumnDoc): { doc: ColumnDoc; result: SolveResult; lastSolveMs: number } {
  const t0 = performance.now();
  const result = solveDoc(doc);
  return { doc, result, lastSolveMs: performance.now() - t0 };
}

export const useStore = create<AppState>((set, get) => {
  const initial = withDoc(defaultColumnDoc());
  return {
    doc: initial.doc,
    result: initial.result,
    lastSolveMs: initial.lastSolveMs,
    dragMode: false,
    selectedGroupIds: [],
    lang: "fr",
    showSection: false,
    debugPerf: false,

    setGeometry: (patch) =>
      set(withDoc({ ...get().doc, geometry: { ...get().doc.geometry, ...patch } })),
    setMaterial: (patch) =>
      set(withDoc({ ...get().doc, material: { ...get().doc.material, ...patch } })),
    setLongitudinal: (patch) =>
      set(withDoc({ ...get().doc, longitudinal: { ...get().doc.longitudinal, ...patch } })),
    setTie: (patch) => set(withDoc({ ...get().doc, tie: { ...get().doc.tie, ...patch } })),
    setCover: (mm) => set(withDoc({ ...get().doc, cover: mm })),
    setExposure: (exposure) => set(withDoc({ ...get().doc, exposure })),

    setDragMode: (on) => set({ dragMode: on }),
    selectGroups: (ids) => set({ selectedGroupIds: ids }),
    toggleLang: () => set({ lang: get().lang === "fr" ? "en" : "fr" }),
    toggleSection: () => set({ showSection: !get().showSection }),
    toggleDebugPerf: () => set({ debugPerf: !get().debugPerf }),
    reset: () => set({ ...withDoc(defaultColumnDoc()), selectedGroupIds: [] }),
  };
});
