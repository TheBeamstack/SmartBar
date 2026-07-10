/**
 * Hollow-block joist-slab pipeline (spec §3.1 E-SLB-03, §6.1) — the "poutrelle-hourdis" floor:
 * precast/insitu joists (ribs) at `joist_spacing` spanning between supports, hollow blocks between
 * them, and a thin reinforced topping (`t_topping`) cast on top. Reinforcement: joist bottom bars
 * (MAIN), joist top-support bars (chapeaux, TOP), and the topping welded mesh (SECONDARY).
 *
 * Slab-family section orchestrator: provided steel is per metre of width (spacing-driven), shapes
 * go through the registry (mesh via the bespoke TREILLIS_MESH generator), and validation dispatches
 * to the `JOIST_SLAB` profile. No `if (elementType === …)` branch. Pure + deterministic.
 */
import type { ShapeArchetype } from "../types/shape";
import type { BarRole } from "../types/reinforcing-element";
import type { ZoneGeometry, BarPosition } from "../types/layout";
import type { MaterialContext } from "../types/codepack";
import { generateShape } from "../geometry/registry";
import { slabProvidedPerMetre, slabEffectiveDepth, solveSlabBars } from "../layout/slab";
import { rollupStatus, type ExtendedCodePack } from "../validation/index";
import { getValidationProfile, type SolvedSlabZone, type SlabContext } from "../validation/profiles";
import type { PlacedBarInput } from "../types/placed-bar";
import { resolvePlacedBars, analyzePlacedBarLaps } from "../section/resolvePlacedBars";
import { validatePlacedBarRules } from "../validation/placedBarRules";
import type { SolveResult, SolvedGroup } from "./element";

export interface JoistZoneInput {
  zone: string;
  groupId: string;
  role?: BarRole;
  /** MAIN = joist bottom; TOP = joist top support; SECONDARY = topping mesh (distribution). */
  slabRole: "MAIN" | "SECONDARY" | "TOP";
  shape: ShapeArchetype;
  params: Record<string, number>;
  diameter: number;
  spacing: number;
  asReqPerM: number; // mm²/m
  /** v position (mm) for the rendered bar line (+t/2 top, −t/2 bottom). */
  v?: number;
}

export interface JoistSolveInput {
  element: string;
  profile: string; // "JOIST_SLAB"
  geometry: {
    L: number;
    t_total: number;
    t_topping: number;
    b_joist: number;
    block_w: number;
    block_h: number;
    joist_spacing: number;
  };
  material: MaterialContext;
  cover: number;
  exposure: string;
  fire?: string;
  dg?: number;
  zones: JoistZoneInput[];
  /**
   * v1.0.5 M2 (P-B): freely placed bars in a rib (e.g. an extra bottom bar). Resolved by the shared
   * pass + appended to `SolveResult.longBars` alongside the per-metre rib steel. Absent → none.
   */
  placed?: PlacedBarInput[];
  code: ExtendedCodePack;
}

/** Solve a hollow-block joist slab (E-SLB-03). */
export function solveJoist(input: JoistSolveInput): SolveResult {
  const { geometry, code } = input;
  const dg = input.dg ?? 20;
  const t = geometry.t_total;
  const width = geometry.joist_spacing; // one rib's tributary width for the rendered bar lines

  const groups: SolvedGroup[] = [];
  const zonesGeom: ZoneGeometry[] = [];
  const slabZones: SolvedSlabZone[] = [];
  const bars: BarPosition[] = [];
  let phiLMax = 0;

  for (const z of input.zones) {
    phiLMax = Math.max(phiLMax, z.diameter);
    const d = slabEffectiveDepth(t, input.cover, z.diameter);
    const asProvPerM = slabProvidedPerMetre(z.diameter, z.spacing);
    zonesGeom.push({ zone: z.zone, d, dPrime: input.cover, tensionCentroid: { u: 0, v: z.v ?? 0 } });
    groups.push({
      groupId: z.groupId,
      role: z.role ?? (z.slabRole === "SECONDARY" ? "DISTRIBUTION" : "PRIMARY_LONGITUDINAL"),
      diameter: z.diameter,
      count: Math.floor(width / z.spacing) + 1,
      zone: z.zone,
      shape: generateShape(z.shape, z.params, z.diameter, code),
    });
    slabZones.push({
      zone: z.zone,
      groupId: z.groupId,
      diameter: z.diameter,
      spacing: z.spacing,
      asReqPerM: z.asReqPerM,
      asProvPerM,
      d,
      role: z.slabRole,
    });
    bars.push(...solveSlabBars(width, z.spacing, z.v ?? t / 2 - input.cover, z.zone));
  }

  const slab: SlabContext = { thickness: t, zones: slabZones };

  const validate = getValidationProfile(input.profile);
  const validation = validate({
    element: input.element,
    section: "SLAB",
    geometry: { Lx: geometry.L, t },
    cover: input.cover,
    exposure: input.exposure,
    ...(input.fire !== undefined ? { fire: input.fire } : {}),
    dg,
    material: input.material,
    slab,
    longitudinal: [],
    transverse: [],
    phiLMax,
    code,
  });

  // v1.0.5 M2 (P-B): resolve any freely placed rib bars additively to the per-metre steel.
  const longBars =
    input.placed && input.placed.length > 0
      ? resolvePlacedBars(input.placed, {
          memberLength: geometry.L,
          code,
          material: input.material,
          layoutBars: bars,
          groups,
          section: "SLAB",
          sectionDims: { b: width, h: t }, // M3: a Layer offsets from the rib face
          startIndex: bars.length,
        })
      : undefined;

  // v1.0.5 M4 (Track V): honest tiers for freely placed rib steel (bundle/layer/curtailment + geometry).
  // Only fires when the user placed bars (legacy joist byte-identical).
  if (longBars && input.placed) {
    validation.push(
      ...validatePlacedBarRules(input.placed, longBars, {
        section: "SLAB",
        b: width,
        h: t,
        cover: input.cover,
        memberLength: geometry.L,
        dg,
        codeRef: (code as { codeRef?: string }).codeRef ?? code.id,
        material: input.material,
        bands: { spacing: code.warnBands?.spacing ?? 0.05, anchorage: code.warnBands?.anchorage ?? 0.05 },
        includeGeometry: true,
      }, code),
    );
  }

  // v1.0.5 M5 (Track S): a freely placed joist/rib bar carrying its OWN splices gets the per-bar stagger
  // check; the per-metre topping-mesh distribution is never spliced. Fires only on a real placed lap.
  if (longBars) {
    validation.push(...analyzePlacedBarLaps(longBars, code).staggerItems);
  }

  return {
    element: input.element,
    bars,
    zones: zonesGeom,
    groups,
    validation,
    status: rollupStatus(validation),
    provisional: (code as { _provisional?: boolean })._provisional === true,
    // joist rib → RECT envelope: tributary width × total depth, bars run along the span L (§9.5).
    member: { envelope: "RECT", length: geometry.L, b: width, h: t, transverse: [] },
    ...(longBars ? { longBars, hasUserAddressableContent: true } : {}),
  };
}
