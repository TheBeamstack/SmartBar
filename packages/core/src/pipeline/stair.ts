/**
 * Straight-flight stair pipeline (spec §3.1 E-STR-01, §6.1, §7.13) — an inclined "waist" slab
 * carrying the steps, optionally turning onto a landing. Reinforcement is slab-family flexure on
 * the waist: main bottom bars (MARCHE_PALIER, waist + landing bend), distribution, top-support
 * chapeaux, and starters into the supporting slab/beam.
 *
 * Section orchestrator sharing the slab seams (per-metre provided steel, shape registry) and
 * dispatching to the `STAIR` profile — which, beyond the numeric slab checks, runs the
 * construction-critical `stair_reentrant_corner_pullout` predicate at the flight↔landing kink.
 * No `if (elementType === …)` branch. Pure + deterministic.
 */
import type { ShapeArchetype } from "../types/shape";
import type { BarRole } from "../types/reinforcing-element";
import type { ZoneGeometry, BarPosition } from "../types/layout";
import type { MaterialContext } from "../types/codepack";
import { generateShape } from "../geometry/registry";
import { slabProvidedPerMetre, slabEffectiveDepth, solveSlabBars, solveSlabDistributionBars, isDistributionLinear } from "../layout/slab";
import { rollupStatus, type ExtendedCodePack } from "../validation/index";
import {
  getValidationProfile,
  type SolvedSlabZone,
  type SlabContext,
  type StairContext,
} from "../validation/profiles";
import type { PlacedBarInput } from "../types/placed-bar";
import { resolvePlacedBars, analyzePlacedBarLaps } from "../section/resolvePlacedBars";
import { creditPlacedPerMetre } from "../section/creditPlacedBars";
import { validatePlacedBarRules } from "../validation/placedBarRules";
import type { SolveResult, SolvedGroup } from "./element";

export interface StairZoneInput {
  zone: string;
  groupId: string;
  role?: BarRole;
  /** MAIN = main bottom; SECONDARY = distribution; TOP = top support / starter. */
  slabRole: "MAIN" | "SECONDARY" | "TOP";
  shape: ShapeArchetype;
  params: Record<string, number>;
  diameter: number;
  spacing: number;
  asReqPerM: number; // mm²/m
  v?: number;
}

export interface StairSolveInput {
  element: string;
  profile: string; // "STAIR"
  geometry: {
    g: number; // going (mm)
    r: number; // riser (mm)
    n_steps: number;
    waist_t: number; // waist thickness (mm)
    flight_width: number; // mm
    landing_L?: number; // landing length (mm); >0 ⇒ a re-entrant flight↔landing corner exists
  };
  material: MaterialContext;
  cover: number;
  exposure: string;
  fire?: string;
  dg?: number;
  zones: StairZoneInput[];
  /** the main bottom bar is continuous AROUND the re-entrant corner (the unsafe wrap) vs split. */
  mainBarWrapsCorner?: boolean;
  /**
   * v1.0.5 M2 (P-B): freely placed bars riding the waist/landing frame (like the main bar) at a chosen
   * `(u,v)`. Resolved by the shared pass + appended to `SolveResult.longBars`. Absent → none.
   */
  placed?: PlacedBarInput[];
  code: ExtendedCodePack;
}

/** Solve a straight-flight stair (E-STR-01). */
export function solveStair(input: StairSolveInput): SolveResult {
  const { geometry, code } = input;
  const dg = input.dg ?? 20;
  const t = geometry.waist_t;
  const width = geometry.flight_width;
  const reentrantCorner = (geometry.landing_L ?? 0) > 0;

  const groups: SolvedGroup[] = [];
  const zonesGeom: ZoneGeometry[] = [];
  const slabZones: SolvedSlabZone[] = [];
  const bars: BarPosition[] = [];
  /** R3: each zone's RESOLVED level `v` — what a placed band is matched against. */
  const zoneVs: number[] = [];
  let phiLMax = 0;
  let mainGroupId = "";

  for (const z of input.zones) {
    phiLMax = Math.max(phiLMax, z.diameter);
    if (z.slabRole === "MAIN" && mainGroupId === "") mainGroupId = z.groupId;
    const d = slabEffectiveDepth(t, input.cover, z.diameter);
    const asProvPerM = slabProvidedPerMetre(z.diameter, z.spacing);
    const role = z.role ?? (z.slabRole === "SECONDARY" ? "DISTRIBUTION" : "PRIMARY_LONGITUDINAL");
    const shape = generateShape(z.shape, z.params, z.diameter, code);
    const span = geometry.n_steps * geometry.g;
    const v = z.v ?? t / 2 - input.cover;
    zoneVs.push(v); // R3: the level this zone's steel actually sits at
    // v1.0.4 C1: a DISTRIBUTION linear bar runs ACROSS the flight width at span (going) stations
    // (exact coupe); a MAIN/TOP bar keeps the along-span row (`across` never set → byte-identical).
    const linearDist = isDistributionLinear(role, shape);
    const zoneBars = linearDist
      ? solveSlabDistributionBars(span, z.spacing, v, z.zone)
      : solveSlabBars(width, z.spacing, v, z.zone);
    zonesGeom.push({ zone: z.zone, d, dPrime: input.cover, tensionCentroid: { u: 0, v: z.v ?? 0 } });
    groups.push({
      groupId: z.groupId,
      role,
      diameter: z.diameter,
      // C1 review-fix (F2, 2026-07-08): a linear DISTRIBUTION bar is counted from the SPAN-distributed
      // set actually placed (BBS/table/3D agree); MAIN/TOP keep the width-derived representative count.
      count: linearDist ? zoneBars.length : Math.floor(width / z.spacing) + 1,
      zone: z.zone,
      shape,
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
    bars.push(...zoneBars);
  }

  // v1.0.5 M2 (P-B): resolve any freely placed waist/landing bars additively to the base steel.
  // v1.0.6-fix R3 (F-B): resolved BEFORE the profile runs — placed steel must exist by the time §7 judges.
  const memberLength = geometry.n_steps * geometry.g;
  const longBars =
    input.placed && input.placed.length > 0
      ? resolvePlacedBars(input.placed, {
          memberLength,
          code,
          material: input.material,
          layoutBars: bars,
          groups,
          section: "SLAB",
          sectionDims: { b: geometry.flight_width, h: t }, // M3: a Layer offsets from the waist face
          startIndex: bars.length,
        })
      : undefined;

  // R3 (F-B): credit the placed steel to the waist's per-metre zones (As,prov + area-weighted `d`).
  if (longBars && input.placed) {
    const credited = creditPlacedPerMetre(
      input.placed,
      longBars,
      slabZones.map((z, i) => ({ zone: z.zone, v: zoneVs[i] ?? 0, asProvPerM: z.asProvPerM, d: z.d, spacing: z.spacing })),
      { thickness: t },
    );
    for (const z of slabZones) {
      const c = credited.get(z.zone);
      if (!c) continue;
      z.asProvPerM = c.asProvPerM;
      z.d = c.d;
      const zg = zonesGeom.find((g) => g.zone === z.zone);
      if (zg) zg.d = c.d;
    }
  }

  const slab: SlabContext = { thickness: t, zones: slabZones };
  const stair: StairContext = {
    reentrantCorner,
    mainBarWrapsCorner: input.mainBarWrapsCorner ?? false,
    mainGroupId: mainGroupId || (input.zones[0]?.groupId ?? "main"),
  };

  const validate = getValidationProfile(input.profile);
  const validation = validate({
    element: input.element,
    section: "SLAB",
    geometry: { Lx: geometry.n_steps * geometry.g, t },
    cover: input.cover,
    exposure: input.exposure,
    ...(input.fire !== undefined ? { fire: input.fire } : {}),
    dg,
    material: input.material,
    slab,
    stair,
    longitudinal: [],
    transverse: [],
    phiLMax,
    code,
  });

  // v1.0.5 M4 (Track V): honest tiers for freely placed steel on the stair waist (bundle/layer/curtailment
  // + element-agnostic geometry). Only fires when the user placed bars (legacy stair byte-identical).
  if (longBars && input.placed) {
    validation.push(
      ...validatePlacedBarRules(input.placed, longBars, {
        section: "SLAB",
        b: geometry.flight_width,
        h: t,
        cover: input.cover,
        memberLength,
        dg,
        codeRef: (code as { codeRef?: string }).codeRef ?? code.id,
        material: input.material,
        bands: { spacing: code.warnBands?.spacing ?? 0.05, anchorage: code.warnBands?.anchorage ?? 0.05 },
        includeGeometry: true,
      }, code),
    );
  }

  // v1.0.5 M5 (Track S): a freely placed waist bar carrying its OWN splices gets the per-bar stagger check.
  // Fires only when a placed bar actually laps → legacy stair byte-identical.
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
    // stair waist → RECT envelope: flight width × waist t, bars run along the going (§9.5).
    member: {
      envelope: "RECT",
      length: memberLength,
      b: geometry.flight_width,
      h: t,
      transverse: [],
    },
    ...(longBars ? { longBars, hasUserAddressableContent: true } : {}),
  };
}
