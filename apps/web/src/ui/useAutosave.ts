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
import { docToRcfg } from "../engine/rcfgDoc";

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
      if (state.doc === prev.doc && state.cuts === prev.cuts) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void managerRef.current!.save(docToRcfg(state.doc, state.cuts));
      }, DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);
}
