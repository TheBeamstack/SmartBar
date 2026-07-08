/**
 * v1.0.4 H10 (`hook_not_dropped`) — a hook edit is NEVER dropped while a *parameter* is mid-invalid.
 *
 * The FaconnageEditor validates a hook change against the last-VALID params (the committed set), not
 * the in-progress buffer, so changing the start/end hook still lands even while the user is fixing a
 * bad parameter — and the invalid parameter stays in its field (never-commit-invalid, H4/H17).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useState } from "react";
import { render, fireEvent } from "@testing-library/react";
import { FaconnageEditor } from "./FaconnageEditor";
import { useStore } from "../store/useStore";
import type { BarFaconnage } from "../engine/document";

/** Controlled wrapper: mirrors how the Sidebar feeds `faconnage` back after each onChange. */
function Harness() {
  const [shapeId, setShapeId] = useState("DROITE");
  const [fac, setFac] = useState<BarFaconnage | undefined>(undefined);
  return (
    <FaconnageEditor
      shapeId={shapeId}
      diameter={20}
      faconnage={fac}
      memberLength={3000}
      onChange={(patch) => {
        if (patch.shapeId) setShapeId(patch.shapeId);
        if (patch.faconnage) setFac(patch.faconnage);
      }}
    />
  );
}

const selects = (c: HTMLElement) => [...c.querySelectorAll("select")] as HTMLSelectElement[];
const lengthInput = (c: HTMLElement) => c.querySelector('input[type="number"]') as HTMLInputElement;
// DOM order of the selects: [shape, start-hook, end-hook].
const endHook = (c: HTMLElement) => selects(c)[2]!;

describe("H10 — a hook edit survives an invalid parameter (hook_not_dropped)", () => {
  beforeEach(() => useStore.getState().reset());

  it("changing the end hook while the length is invalid still commits the hook (last-valid params)", () => {
    const { container } = render(<Harness />);

    // 1. commit a valid end hook (135°) on the seeded valid shape.
    fireEvent.change(endHook(container), { target: { value: "135" } });
    expect(endHook(container).value).toBe("135");

    // 2. drive the length param invalid (L=0 → non-positive leg). It stays in the field (H17) and is
    //    NOT committed; the last-valid sketch remains on screen.
    const L = lengthInput(container);
    fireEvent.change(L, { target: { value: "0" } });
    expect(L.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".faconnage-error-detail")).toBeTruthy();

    // 3. NOW change the end hook to 180° WHILE the parameter is invalid.
    fireEvent.change(endHook(container), { target: { value: "180" } });

    // the hook edit landed (was previously dropped by validating against the invalid buffer) …
    expect(endHook(container).value).toBe("180");
    // … and the invalid parameter is still shown for the user to fix (never silently reverted).
    expect(lengthInput(container).getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".faconnage-error-detail")).toBeTruthy();
    // the last-valid sketch is still on screen — the edit was never visually dropped (H17).
    expect(container.querySelector(".faconnage-lastvalid")).toBeTruthy();
    expect(container.querySelector(".faconnage-sketch")).toBeTruthy();
  });

  it("a hook edit on a fully-valid shape commits normally (no regression)", () => {
    const { container } = render(<Harness />);
    fireEvent.change(endHook(container), { target: { value: "90" } });
    expect(endHook(container).value).toBe("90");
    // still valid → the live sketch (not the fallback) is shown, no error.
    expect(container.querySelector(".faconnage-error-detail")).toBeFalsy();
  });
});
