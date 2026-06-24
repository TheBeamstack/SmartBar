/**
 * SPIRALE_HELICE bespoke generator (spec §5.2.1g, plan P4a). The helix centerline is not a
 * planar polyline, so it is one of the two bespoke registered generators. Asserts turns/pitch
 * derivation, the slant coil length, the 3D sampling, and registry dispatch.
 */
import { describe, it, expect } from "vitest";
import { generateHelix, generateShape } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const archetype = loadShape("spirale_helice");

const slant = (pitch: number, D: number) => Math.hypot(Math.PI * D, pitch);

describe("SPIRALE_HELICE — 3D helix generator", () => {
  it("derives turns from height/pitch and computes the slant coil length", () => {
    const r = generateHelix(archetype, { pitch: 60, helix_diameter: 300, height: 600 }, 10, code);
    expect(r.turns).toBeCloseTo(10, 6);
    expect(r.axialHeight).toBeCloseTo(600, 6);
    expect(r.slantPerTurn).toBeCloseTo(slant(60, 300), 6);
    expect(r.coilLength).toBeCloseTo(10 * slant(60, 300), 4);
    // cutLength = coil length (smooth helix, no bend deductions)
    expect(r.cutLength).toBeCloseTo(r.coilLength, 6);
    expect(r.geomLength).toBeCloseTo(r.coilLength, 6);
    expect(r.helixRadius).toBeCloseTo(150, 6);
  });

  it("accepts an explicit turns param", () => {
    const r = generateHelix(archetype, { pitch: 50, helix_diameter: 400, turns: 8 }, 10, code);
    expect(r.turns).toBe(8);
    expect(r.coilLength).toBeCloseTo(8 * slant(50, 400), 4);
  });

  it("samples a flat [x,y,z] centerline along the +v axis (axial run = pitch·turns)", () => {
    const r = generateHelix(archetype, { pitch: 60, helix_diameter: 300, turns: 3 }, 10, code);
    expect(r.centerline3D.length % 3).toBe(0);
    const n = r.centerline3D.length / 3;
    // last point's axial (y) coordinate is the full coil height
    expect(r.centerline3D[(n - 1) * 3 + 1]).toBeCloseTo(180, 4); // 60·3
    // first point on the pitch circle at +u
    expect(r.centerline3D[0]).toBeCloseTo(150, 6);
  });

  it("is reached through the shape registry by archetype id (SPIRALE_HELICE)", () => {
    const viaRegistry = generateShape(archetype, { pitch: 60, helix_diameter: 300, turns: 5 }, 12, code);
    const direct = generateHelix(archetype, { pitch: 60, helix_diameter: 300, turns: 5 }, 12, code);
    expect(viaRegistry.cutLength).toBeCloseTo(direct.cutLength, 6);
    expect(viaRegistry.archetypeId).toBe("SPIRALE_HELICE");
  });
});
