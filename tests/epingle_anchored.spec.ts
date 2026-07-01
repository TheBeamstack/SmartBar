/**
 * v1.0.3 G5 — cross-tie / épingle unification + anchoring ([REF-SYS-756b], spec §5). Every épingle
 * is an ANCHORED cross-tie (placed on the line between its two bars), its HOOK (crochet) is part of
 * the rendered centreline (visible in 3D/coupe/PDF/DXF), and the legacy "supplement épingle" CENTRED
 * render path is removed — a SUPPLEMENTAL épingle group is never placed at the section centre.
 */
import { describe, it, expect } from "vitest";
import {
  solveElement,
  placeBars,
  generateBarShape,
  type ElementSolveInput,
} from "@rebarconfig/core";
import { makeBaelPack } from "@rebarconfig/codepacks";
import { loadShape } from "./p1-helpers";

const code = makeBaelPack();
const cadre = loadShape("cadre_rect");
const epingle = loadShape("epingle");
const droite = loadShape("droite");

/** local centreline lateral coords (the hooks bend into local y; the body span is on y=0). */
const localY = (cl: number[]) => cl.filter((_, i) => i % 3 === 1);

function column(extra: ElementSolveInput["transverse"] = []): ElementSolveInput {
  return {
    element: "E-COL-01",
    profile: "BAEL_COLUMN",
    section: "RECT",
    geometry: { b: 300, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    layout: { principle: "SYMMETRIC", nTop: 3, nBottom: 3, nLeft: 2, nRight: 2 },
    phiT: 8,
    phiLInset: 20,
    longitudinal: [
      {
        zone: "As_total",
        groupId: "L1",
        role: "PRIMARY_LONGITUDINAL",
        shape: droite,
        params: { L: 3000 },
        diameter: 20,
        faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"],
        asReq: 1800,
        tensionFace: "BOTTOM",
      },
    ],
    transverse: [
      { zone: "Asw_confinement", groupId: "T1", shape: cadre, params: { w: 244, h: 544 }, diameter: 8, spacing: 200, nLegs: 2 + extra.length * 2, aswReqPerM: 300 },
      ...extra,
    ],
    code,
  };
}

const anchoredEpingle: ElementSolveInput["transverse"][number] = {
  zone: "T1_xtie",
  groupId: "T1_X1",
  shape: epingle,
  params: { span: 240, hook_angle: 135 },
  diameter: 8,
  spacing: 200,
  nLegs: 2,
  aswReqPerM: 0,
  anchor: { u: 80, v: 0, angleDeg: 90 },
};

describe("G5 — the épingle hook is part of the rendered centreline (visible)", () => {
  it("an épingle's centreline now bends into the hook return (real lateral extent)", () => {
    const ys = localY(generateBarShape(epingle, { span: 240, hook_angle: 135 }, 8, code).centerline3D);
    // before G5 the épingle rendered as a flat straight span (y≡0); now the crochets show
    expect(Math.max(...ys.map(Math.abs))).toBeGreaterThan(10);
  });

  it("a straight DROITE is byte-identical (no hook → zero lateral extent)", () => {
    const ys = localY(generateBarShape(droite, { L: 3000 }, 20, code).centerline3D);
    expect(Math.max(...ys.map(Math.abs))).toBeLessThan(1e-6);
  });

  it("the hook angle drives the rendered geometry (90° hook tip ≠ 135° hook tip)", () => {
    const tip = (cl: number[]) => cl.slice(-3);
    const a90 = generateBarShape(epingle, { span: 240, hook_angle: 90 }, 8, code);
    const a135 = generateBarShape(epingle, { span: 240, hook_angle: 135 }, 8, code);
    expect(tip(a90.centerline3D)).not.toEqual(tip(a135.centerline3D));
  });
});

describe("G5 — épingles are anchored, never centred", () => {
  it("an anchored épingle is placed at its bar-pair anchor, NOT the section centre", () => {
    const placed = placeBars(solveElement(column([anchoredEpingle]))).filter((b) => b.groupId === "T1_X1");
    expect(placed.length).toBeGreaterThan(0);
    const xs = placed[0]!.points.filter((_, i) => i % 3 === 0);
    const centroidX = xs.reduce((s, x) => s + x, 0) / xs.length;
    // the loop centroid sits near the anchor u=80, not collapsed at the centre (the legacy bug)
    expect(centroidX).toBeGreaterThan(40);
  });

  it("a SUPPLEMENTAL épingle group is NEVER rendered centred (legacy path removed)", () => {
    const input = column();
    input.supplements = [
      { groupId: "SUP1", role: "SUPPLEMENTAL", shape: epingle, params: { span: 200, hook_angle: 135 }, diameter: 8, count: 1 },
    ];
    const placed = placeBars(solveElement(input));
    // the épingle-shape supplement is skipped by placeBars — it must be an anchored cross-tie instead
    expect(placed.some((b) => b.groupId === "SUP1")).toBe(false);
  });

  it("a plain column (no cross-tie) materialises no épingle bars at all", () => {
    const placed = placeBars(solveElement(column()));
    expect(placed.some((b) => b.groupId.includes("_X"))).toBe(false);
  });
});
