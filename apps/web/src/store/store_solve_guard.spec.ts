/**
 * H1 ([v1.0.4], owner A-6) — the store's `withDoc` solve guard. A mid-edit solve failure must never
 * blank the app: the last good result + coupes are kept, and a non-blocking `solveError` is set. The
 * next successful solve clears it. (A length-0 override drives the DROITE bar's cutLength to 0, which
 * the core H3 guard rejects — a deterministic way to make `solveDoc` throw.)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";

describe("store solve guard (H1)", () => {
  beforeEach(() => useStore.getState().reset());

  it("keeps the last-good result and sets solveError when an edit throws", () => {
    const good = useStore.getState().result;
    const goodCuts = useStore.getState().cuts;
    useStore.getState().setBarOverrides([{ index: 0, length: 0 }]); // cutLength 0 → throws (H3)
    const st = useStore.getState();
    expect(st.solveError).toBeTruthy();
    expect(st.result).toBe(good); // retained by reference, not re-solved to a blank/partial
    expect(st.cuts).toBe(goodCuts);
  });

  it("clears solveError once a subsequent valid edit solves", () => {
    useStore.getState().setBarOverrides([{ index: 0, length: 0 }]);
    expect(useStore.getState().solveError).toBeTruthy();
    useStore.getState().setBarOverrides([]); // back to the legacy grouped path → valid
    expect(useStore.getState().solveError).toBeNull();
    expect(useStore.getState().result).toBeDefined();
  });

  it("starts with no solveError", () => {
    expect(useStore.getState().solveError).toBeNull();
  });
});
