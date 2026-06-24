/**
 * store_resolve (plan P2): a param mutation produces a new SolveResult synchronously, and the
 * store stays deterministic (same mutation → identical result).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import { asProvidedMm2 } from "../ui/derived";

describe("store synchronous re-solve", () => {
  beforeEach(() => useStore.getState().reset());

  it("a param mutation yields a brand-new SolveResult in the same tick", () => {
    const before = useStore.getState().result;
    useStore.getState().setLongitudinal({ diameter: 25 });
    const after = useStore.getState().result;

    expect(after).not.toBe(before); // new object, solved synchronously
    expect(asProvidedMm2(after, useStore.getState().doc)).toBeGreaterThan(
      asProvidedMm2(before, useStore.getState().doc),
    );
  });

  it("is deterministic: the same edit from the same start gives an identical result", () => {
    useStore.getState().setTie({ spacing: 150 });
    const a = useStore.getState().result;

    useStore.getState().reset();
    useStore.getState().setTie({ spacing: 150 });
    const b = useStore.getState().result;

    expect(JSON.stringify(b)).toEqual(JSON.stringify(a));
  });

  it("records a solve timing for the perf HUD", () => {
    useStore.getState().setGeometry({ b: 350 });
    expect(useStore.getState().lastSolveMs).toBeGreaterThanOrEqual(0);
  });
});
