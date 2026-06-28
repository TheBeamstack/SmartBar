/**
 * F1 ([REF-SYS-811]/[REF-UI-811]) — in-plane view roll. The pure `rollUpVector` (headless: level up
 * at 0, perpendicular at 90°, always unit ⟂ the view axis) + the RTL roll buttons that drive the
 * session `rollRad` and the Home/named-view re-level.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { rollUpVector, type Vec3 } from "./cameraState";
import { ViewControls } from "./ViewCube";
import { useStore } from "../store/useStore";

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

describe("rollUpVector (pure)", () => {
  const front: Vec3 = [0, 0, 1]; // camera in front, looking down −Z

  it("roll 0 → the level (element) up, a unit vector ⟂ the view axis", () => {
    const up = rollUpVector(front, 0);
    expect(up[0]).toBeCloseTo(0, 6);
    expect(up[1]).toBeCloseTo(1, 6);
    expect(up[2]).toBeCloseTo(0, 6);
    expect(len(up)).toBeCloseTo(1, 6);
  });

  it("roll 90° → up turns perpendicular to the level up (still unit, still ⟂ axis)", () => {
    const up = rollUpVector(front, Math.PI / 2);
    expect(Math.abs(dot(up, [0, 1, 0]))).toBeCloseTo(0, 6); // perpendicular to level up
    expect(Math.abs(dot(up, front))).toBeCloseTo(0, 6); // perpendicular to the view axis
    expect(len(up)).toBeCloseTo(1, 6);
  });

  it("a 360° roll round-trips back to the level up", () => {
    const up = rollUpVector(front, 2 * Math.PI);
    expect(up[1]).toBeCloseTo(1, 6);
  });

  it("a near-vertical view axis still yields a valid (non-degenerate) up", () => {
    const up = rollUpVector([0, 1, 0], 0); // looking straight down
    expect(len(up)).toBeCloseTo(1, 6);
    expect(Math.abs(dot(up, [0, 1, 0]))).toBeCloseTo(0, 6);
  });
});

describe("roll controls (RTL)", () => {
  beforeEach(() => useStore.getState().reset());

  it("↺ / ↻ buttons nudge rollRad by ±90°; Home re-levels it to 0", () => {
    render(<ViewControls />);
    fireEvent.click(screen.getByRole("button", { name: /pivoter à gauche|roll left/i }));
    expect(useStore.getState().rollRad).toBeCloseTo(Math.PI / 2, 6);

    fireEvent.click(screen.getByRole("button", { name: /pivoter à droite|roll right/i }));
    expect(useStore.getState().rollRad).toBeCloseTo(0, 6);

    // roll, then Home resets it
    act(() => useStore.getState().setRoll(1.2));
    fireEvent.click(screen.getByRole("button", { name: /vue par défaut|default view/i }));
    expect(useStore.getState().rollRad).toBe(0);
  });

  it("Shift-click gives the fine ±5° step", () => {
    render(<ViewControls />);
    fireEvent.click(screen.getByRole("button", { name: /pivoter à gauche|roll left/i }), { shiftKey: true });
    expect(useStore.getState().rollRad).toBeCloseTo((5 * Math.PI) / 180, 6);
  });

  it("snapping to a named view re-levels the roll", () => {
    useStore.getState().setRoll(0.8);
    useStore.getState().requestView("FRONT");
    expect(useStore.getState().rollRad).toBe(0);
  });
});
