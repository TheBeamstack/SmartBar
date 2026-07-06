/**
 * A2 clear-spacing fold ([v1.0.4]) — the addressable clear-spacing predicate (H8) judges every FOCUS
 * bar (standalone extra OR per-bar Ø override) against the REAL placed set with the sourced limit
 * `max(k1·Ø, dg+k2, 20)`, so add-ons/overrides are no longer exempt from the grouped face-based check.
 * A bar's enlarged Ø crowding its grid neighbour now FAILs even where the grouped `clear_spacing`,
 * which only knows the group Ø, still passes.
 */
import { describe, it, expect } from "vitest";
import { solveElement, type ElementSolveInput } from "@rebarconfig/core";
import { column, droite, H } from "./g2-helpers";

// a column whose TOP face seats 3 bars at 50 mm centres: the Ø20 grid clears 30 mm (≥ 25 → PASS), but
// a Ø32 override on a corner bar clears only 50 − (32+20)/2 = 24 mm < 32 (its own min) → FAIL.
const tight = (opts: Parameters<typeof column>[0] = {}): ElementSolveInput => ({
  ...column(opts),
  geometry: { b: 196, h: 600, H },
});

const spacingOf = (r: ReturnType<typeof solveElement>) =>
  r.validation.find((v) => v.rule === "addressable_clear_spacing");

describe("A2 — clear-spacing fold over the real placed set", () => {
  it("the grouped grid (no addressable bars) passes the face-based clear_spacing", () => {
    const r = solveElement(tight());
    expect(r.longBars).toBeUndefined();
    expect(r.validation.find((v) => v.rule.startsWith("clear_spacing"))?.status).not.toBe("FAIL");
  });

  it("a Ø-override that crowds its grid neighbour FAILs the folded addressable spacing", () => {
    const r = solveElement(tight({ overrides: [{ barIndex: 0, shape: droite, params: { L: H }, diameter: 32 }] }));
    expect(spacingOf(r)?.status).toBe("FAIL");
    expect(r.status).toBe("FAIL"); // export-lock
  });

  it("a standalone extra crammed against a grid bar FAILs (add-ons not exempt)", () => {
    // extra Ø16 at (u:-40, v:252) — 10 mm from the TOP corner grid bar at (-50, 252)
    const r = solveElement(
      tight({ extra: [{ id: "XT", position: { u: -40, v: 252 }, shape: droite, params: { L: H }, diameter: 16 }] }),
    );
    expect(spacingOf(r)?.status).toBe("FAIL");
  });
});
