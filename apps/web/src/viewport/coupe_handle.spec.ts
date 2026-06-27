/**
 * Coupe drag-handle station math (spec v1.0.1 Feature B §2.5). The GPU handle is verified by hand,
 * but its pure helpers — clamp to the member, snap onto a transverse station, and the section
 * extents — are asserted here (headless), exactly like the ViewCube camera-state module.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { clampStation, snapStation, memberHalfExtents, snapStationsFor } from "./coupeHandle";
import { useStore } from "../store/useStore";

describe("coupe handle helpers", () => {
  it("clamps a dragged station to the member length", () => {
    expect(clampStation(-50, 3000)).toBe(0);
    expect(clampStation(5000, 3000)).toBe(3000);
    expect(clampStation(1500, 3000)).toBe(1500);
  });

  it("snaps to the nearest transverse station within tolerance, else leaves the station alone", () => {
    const st = [200, 400, 600];
    expect(snapStation(390, st, 50)).toBe(400); // within tol → snaps
    expect(snapStation(300, st, 50)).toBe(300); // 100 away from both → no snap
  });

  it("returns the section half-extents for RECT and CIRCULAR members", () => {
    expect(memberHalfExtents({ envelope: "RECT", length: 3000, b: 300, h: 600, transverse: [] })).toEqual({ halfW: 150, halfH: 300 });
    expect(memberHalfExtents({ envelope: "CIRCULAR", length: 3000, D: 500, transverse: [] })).toEqual({ halfW: 250, halfH: 250 });
  });

  it("derives snap stations from the live solved member (the reference column has stirrup stations)", () => {
    useStore.getState().reset();
    const stations = snapStationsFor(useStore.getState().result);
    expect(stations.length).toBeGreaterThan(0);
    expect(stations.every((s) => s >= 0 && s <= useStore.getState().result.member.length)).toBe(true);
  });
});
