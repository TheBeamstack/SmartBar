/**
 * Straight-flight stair (E-STR-01) — flexure + the re-entrant-corner pull-out predicate
 * (spec §3.1, §7.4, §7.13, plan P4b). A tension (main bottom) bar wrapped continuously around the
 * concave flight↔landing kink → 🔴 FAIL; split + separately anchored → PASS. Pack-agnostic.
 */
import { describe, it, expect } from "vitest";
import { solveStair } from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const marche = loadShape("marche_palier");
const droite = loadShape("droite");
const chapeau = loadShape("chapeau");

function stair(wraps: boolean, landing_L = 1000, distSpacing = 250) {
  return solveStair({
    element: "E-STR-01",
    profile: "STAIR",
    geometry: { g: 280, r: 170, n_steps: 14, waist_t: 180, flight_width: 1200, landing_L },
    material: { f_c28: 25, f_e: 500 },
    cover: 25,
    exposure: "INTERIOR",
    mainBarWrapsCorner: wraps,
    zones: [
      { zone: "As_main_bottom", groupId: "M", slabRole: "MAIN", shape: marche, params: { flight: 3900, landing: 1000, bend: 30 }, diameter: 12, spacing: 150, asReqPerM: 600 },
      { zone: "As_dist", groupId: "D", slabRole: "SECONDARY", shape: droite, params: { L: 1200 }, diameter: 8, spacing: distSpacing, asReqPerM: 120 },
      { zone: "As_top_support", groupId: "T", slabRole: "TOP", shape: chapeau, params: { L: 1500 }, diameter: 10, spacing: 200, asReqPerM: 300 },
    ],
    code,
  });
}

describe("stair flexure", () => {
  it("solves the waist zones with per-metre provided steel + computed d", () => {
    const r = stair(false);
    const main = r.validation.find((v) => v.rule === "provided_area:As_main_bottom")!;
    expect(main.status).toBe("PASS"); // ~754 mm²/m ≥ 600
    expect(r.groups).toHaveLength(3);
  });

  it("distribution minimum on the waist (As_dist ≥ 0.20·As_main)", () => {
    const tooLittle = stair(false, 1000, 400).validation.find((v) => v.rule === "slab_distribution_min")!;
    expect(tooLittle.status).toBe("FAIL"); // 8@400 ≈ 126 < 0.2·754 = 151
  });
});

describe("stair_reentrant_corner_pullout (§7.13)", () => {
  it("main tension bar wrapped around the re-entrant corner → 🔴 FAIL", () => {
    const v = stair(true).validation.find((x) => x.rule === "stair_reentrant_corner_pullout")!;
    expect(v.status).toBe("FAIL");
    expect(v.tier).toBe(1);
  });

  it("split + anchored detailing → PASS", () => {
    const v = stair(false).validation.find((x) => x.rule === "stair_reentrant_corner_pullout")!;
    expect(v.status).toBe("PASS");
  });

  it("no landing (no re-entrant corner) → not applicable, PASS even if continuous", () => {
    const v = stair(true, 0).validation.find((x) => x.rule === "stair_reentrant_corner_pullout")!;
    expect(v.status).toBe("PASS");
  });
});
