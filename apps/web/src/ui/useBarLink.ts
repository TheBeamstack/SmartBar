/**
 * Two-bar link interaction for the F7 section picker (spec §7.2). The pending first pick is LOCAL to
 * each editor (so a cross-tie picker and a supplement picker never cross-fire), while it is mirrored
 * into the store's `selectedBars` so the 3D viewport highlights the same bar. A second pick fires
 * `onLink(a,b)` and clears; re-clicking the pending bar de-selects it. Identical index ⇒ identical
 * bind whichever path (SVG dot or keyboard list) is used (a11y parity, invariant 5).
 */
import { useState } from "react";
import { useStore } from "../store/useStore";

export function useBarLink(onLink: (a: number, b: number) => void): (index: number) => void {
  const [pending, setPending] = useState<number | null>(null);
  const setSelected = useStore((s) => s.setSelectedBars);
  return (i: number) => {
    if (pending === null) {
      setPending(i);
      setSelected([i]);
      return;
    }
    if (pending === i) {
      setPending(null);
      setSelected([]);
      return;
    }
    onLink(pending, i);
    setPending(null);
    setSelected([]);
  };
}
