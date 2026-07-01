/**
 * v1.0.3 G2 ([REF-SYS-530], spec §2.2) — section levels. Beyond the TOP/BOTTOM faces a user can
 * place steel on an INTERMEDIATE level (e.g. the sous-chapeau U-bars just under the top bars). A
 * level is simply an addressable bar at a chosen section depth `v`; it renders at that depth.
 */
import { describe, it, expect } from "vitest";
import { solveElement, placeBars } from "@rebarconfig/core";
import { column, droite, H } from "./g2-helpers";

describe("G2 — section levels", () => {
  it("an extra bar at an intermediate v adds a third level between the top + bottom faces", () => {
    const r = solveElement(column({ extra: [{ id: "U1", position: { u: 0, v: 0 }, shape: droite, params: { L: H }, diameter: 12 }] }));
    const placed = placeBars(r).filter((b) => b.role === "PRIMARY_LONGITUDINAL");
    const zs = placed.map((b) => b.points[2]!); // first-point section depth (v → world Z)
    expect(Math.max(...zs)).toBeGreaterThan(0); // top-face steel
    expect(Math.min(...zs)).toBeLessThan(0); // bottom-face steel
    expect(zs.some((z) => Math.abs(z) < 1)).toBe(true); // the intermediate U-bar level at v ≈ 0
  });
});
