/**
 * TREILLIS_MESH bespoke generator (spec §5.2.1g, plan P4a). An orthogonal welded mat is not a
 * single bent bar, so it is the second bespoke registered generator. Asserts per-direction wire
 * counts/lengths, total wire length, overhangs, and registry dispatch.
 */
import { describe, it, expect } from "vitest";
import { generateMesh, generateShape } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const archetype = loadShape("treillis_mesh");

describe("TREILLIS_MESH — welded mat generator", () => {
  it("counts wires per direction (n = floor(extent/pitch)+1) with overhangs in the lengths", () => {
    const r = generateMesh(
      archetype,
      { pitch_x: 150, pitch_y: 250, Lx: 3000, Ly: 4000, overhang_x: 50, overhang_y: 50 },
      8,
      code,
    );
    expect(r.nWiresY).toBe(21); // along X at pitch_x=150 over Lx=3000 → 21 wires running in Y
    expect(r.nWiresX).toBe(17); // along Y at pitch_y=250 over Ly=4000 → 17 wires running in X
    expect(r.wireLengthX).toBe(3100); // Lx + 2·overhang_x
    expect(r.wireLengthY).toBe(4100); // Ly + 2·overhang_y
    expect(r.totalLength).toBe(17 * 3100 + 21 * 4100);
    expect(r.cutLength).toBe(r.totalLength);
  });

  it("defaults overhangs to 0", () => {
    const r = generateMesh(archetype, { pitch_x: 200, pitch_y: 200, Lx: 2000, Ly: 2000 }, 8, code);
    expect(r.wireLengthX).toBe(2000);
    expect(r.nWiresX).toBe(11);
    expect(r.nWiresY).toBe(11);
  });

  it("is reached through the shape registry by archetype id (TREILLIS_MESH)", () => {
    const viaRegistry = generateShape(
      archetype,
      { pitch_x: 150, pitch_y: 150, Lx: 3000, Ly: 3000 },
      8,
      code,
    );
    expect(viaRegistry.archetypeId).toBe("TREILLIS_MESH");
    expect(viaRegistry.cutLength).toBeGreaterThan(0);
  });
});
