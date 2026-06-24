/**
 * Computed effective depth d/d' ([REF-SYS-611]) — d from the resolved tension-bar centroid,
 * area-weighted across layers, NOT the 0.9h rule of thumb (single + multi-layer).
 */
import { describe, it, expect } from "vitest";
import { solveRectLayout, computeZoneGeometry, barArea } from "@rebarconfig/core";
import type { LayoutDescriptor } from "@rebarconfig/core";

const section = { b: 300, h: 600 };
const cover = 30;
const phiT = 8;
const phiL = 20;

function layoutWith(layers: number, principle: "SYMMETRIC" | "LAYERED") {
  const d: LayoutDescriptor = {
    section: "RECT",
    geometry: section,
    cover,
    phiT,
    phiL,
    rect: { principle, nTop: 3, nBottom: 3, nLeft: 2, nRight: 2, layers },
  };
  return solveRectLayout(d);
}

describe("effective depth — single layer", () => {
  it("d = h − c − φt − φℓ/2 from the real centroid, not 0.9h", () => {
    const r = layoutWith(1, "SYMMETRIC");
    const z = computeZoneGeometry("As_total", r.bars, section, "BOTTOM", barArea(phiL));
    expect(z.d).toBeCloseTo(600 - 30 - 8 - 10, 6); // 552
    expect(z.d).not.toBeCloseTo(0.9 * section.h, 1); // ≠ 540
    expect(z.dPrime).toBeCloseTo(48, 6);
  });
});

describe("effective depth — multi-layer", () => {
  it("ȳ_t is area-weighted across the two bottom rows → d shrinks accordingly", () => {
    const r = layoutWith(2, "LAYERED");
    const z = computeZoneGeometry("As_total", r.bars, section, "BOTTOM", barArea(phiL));
    // outer bottom row v = −(h−2·inset)/2 = −252; inner row inset by φℓ+gap = 40 → v = −212
    const expectedYt = (-252 + -212) / 2;
    const expectedD = section.h / 2 - expectedYt; // 300 − (−232) = 532
    expect(z.d).toBeCloseTo(expectedD, 6);
    expect(z.d).toBeLessThan(552); // tension centroid moved inward vs single layer
  });
});
