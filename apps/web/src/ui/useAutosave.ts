/**
 * IndexedDB autosave + crash recovery (spec §10, plan P5 step 5). On mount we try to recover the
 * last autosaved project and load it; thereafter every doc/cuts change is debounced-persisted to
 * IndexedDB. The persistence is injected behind `KeyValueStore`, so headless (jsdom, no IndexedDB)
 * `indexedDbStore()` transparently falls back to an in-memory store — recovery is a no-op there and
 * the SPA simply starts from the default element (the existing tests are unaffected).
 */
import { useEffect, useRef } from "react";
import { AutosaveManager, indexedDbStore } from "@rebarconfig/exporters";
import { useStore } from "../store/useStore";
import { projectToRcfg } from "../engine/projectRcfg";
import type { ElementInstance } from "../engine/project";

const DEBOUNCE_MS = 600;

export function useAutosave() {
  const managerRef = useRef<AutosaveManager>();
  if (!managerRef.current) managerRef.current = new AutosaveManager(indexedDbStore());
  const loadProject = useStore((s) => s.loadProject);

  // recover once on mount
  useEffect(() => {
    let cancelled = false;
    void managerRef.current!.recover().then((project) => {
      if (!cancelled && project) loadProject(project);
    });
    return () => {
      cancelled = true;
    };
  }, [loadProject]);

  // debounced save on every doc/cuts change
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStore.subscribe((state, prev) => {
      if (state.doc === prev.doc && state.cuts === prev.cuts && state.instances === prev.instances) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        // persist the WHOLE project (v1.1 envelope), reconciling the active instance's live edits.
        const reconciled: ElementInstance[] = state.instances.map((i) =>
          i.id === state.activeInstanceId ? { ...i, doc: state.doc, cuts: state.cuts } : i,
        );
        // v1.0.5 M7: reuse the active instance's live `result` (no double-solve of what's on screen).
        void managerRef.current!.save(
          projectToRcfg(reconciled, {}, { [state.activeInstanceId]: state.result }),
        );
      }, DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);
}
