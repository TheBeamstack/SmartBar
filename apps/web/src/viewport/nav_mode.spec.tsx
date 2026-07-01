/**
 * G9 (§9.2, [REF-UI-850]) — the hand-pan tool toggle. The toolbar button flips the session
 * `navMode` between "orbit" and "pan" (the Viewport maps LEFT-drag to pan when active); the pure
 * store toggle + the a11y button are headless-tested here (the OrbitControls mapping itself is GPU).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewControls } from "./ViewCube";
import { useStore } from "../store/useStore";

describe("hand-pan tool (RTL + store)", () => {
  beforeEach(() => useStore.getState().reset());

  it("defaults to orbit", () => {
    expect(useStore.getState().navMode).toBe("orbit");
  });

  it("the toolbar hand button toggles navMode orbit ⇄ pan", () => {
    render(<ViewControls />);
    const btn = screen.getByRole("button", { name: /orbite|orbit \(/i });
    expect(btn.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(btn);
    expect(useStore.getState().navMode).toBe("pan");
    // the label + pressed-state now reflect the pan tool
    const panBtn = screen.getByRole("button", { name: /déplacer \(main\)|pan \(hand\)/i });
    expect(panBtn.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(panBtn);
    expect(useStore.getState().navMode).toBe("orbit");
  });

  it("setNavMode / toggleNavMode drive the store directly", () => {
    useStore.getState().setNavMode("pan");
    expect(useStore.getState().navMode).toBe("pan");
    useStore.getState().toggleNavMode();
    expect(useStore.getState().navMode).toBe("orbit");
  });
});
