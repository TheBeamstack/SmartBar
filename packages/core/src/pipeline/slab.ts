/**
 * Slab-section element pipeline (spec §6, §6.1 "Slabs/mats") — one-way (E-SLB-01) and two-way
 * (E-SLB-02) solid slabs. Section-specific orchestrator sharing the engine seams: provided steel
 * is per metre of width (spacing-driven), shapes go through the registry (mats via the bespoke
 * TREILLIS_MESH generator), and validation dispatches to the profile registry (`SLAB_ONEWAY` /
 * `SLAB_TWOWAY`). No `if (elementType === …)` branch.
 *
 * Pure + deterministic; pack-agnostic (BAEL/EC2 swap behind code.*).
 */
import type { ShapeArchetype } from "../types/shape";
import type { BarRole } from "../types/reinforcing-element";
import type { ZoneGeometry, BarPosition } from "../types/layout";
import type { MaterialContext } from "../types/codepack";
import { generateShape } from "../geometry/registry";
import { slabProvidedPerMetre, slabEffectiveDepth, solveSlabBars, solveSlabDistributionBars, isDistributionLinear } from "../layout/slab";
import { rollupStatus, type ExtendedCodePack } from "../validation/index";
import { validatePlacedBarRules } from "../validation/placedBarRules";
import {
  getValidationProfile,
  type SolvedSlabZone,
  type SlabContext,
} from "../validation/profiles";
import type { PlacedBarInput } from "../types/placed-bar";
import { resolvePlacedBars, analyzePlacedBarLaps } from "../section/resolvePlacedBars";
import { creditPlacedPerMetre } from "../section/creditPlacedBars";
import type { SolveResult, SolvedGroup } from "./element";

export interface SlabZoneInput {
  zone: string;
  groupId: string;
  role?: BarRole;
  /** validation role: MAIN drives distribution-min; SECONDARY = relaxed spacing limit. */
  slabRole: "MAIN" | "SECONDARY" | "TOP";
  shape: ShapeArchetype;
  params: Record<string, number>;
  diameter: number;
  /** bar spacing / pitch (mm). */
  spacing: number;
  asReqPerM: number; // mm²/m
  /** v position (mm) for the rendered bar line (+t/2 top, −t/2 bottom). */
  v?: number;
  /** v1.0.6-fix R9 (F-H): the span this zone reinforces on a two-way slab ("x"/"y"); lets a placed band's
   *  `spanAxis` credit the right direction where an x-zone and a y-zone share a level. Absent → one-way. */
  axis?: "x" | "y";
}

export interface SlabSolveInput {
  element: string;
  profile: string; // "SLAB_ONEWAY" | "SLAB_TWOWAY"
  geometry: { Lx: number; Ly: number; t: number };
  material: MaterialContext;
  cover: number;
  exposure: string;
  fire?: string;
  dg?: number;
  zones: SlabZoneInput[];
  /** two-way: a restrained discontinuous corner is present. */
  restrainedCorner?: boolean;
  /** two-way: provided corner-torsion steel (mm²); 0/absent → WARN when restrained. */
  cornerTorsionProvided?: number;
  /**
   * v1.0.5 M2 (P-B): freely placed bars — an extra band/bar at a level `(v)` over a span range (e.g.
   * an extra top band around a support). Resolved by the shared pass + appended to `SolveResult.longBars`
   * ALONGSIDE the per-metre mat (kept in `bars`). Absent → none (byte-identical).
   */
  placed?: PlacedBarInput[];
  code: ExtendedCodePack;
}

/** Solve a slab element (E-SLB-01, E-SLB-02). */
export function solveSlab(input: SlabSolveInput): SolveResult {
  const { geometry, code } = input;
  const dg = input.dg ?? 20;

  const groups: SolvedGroup[] = [];
  const zonesGeom: ZoneGeometry[] = [];
  const slabZones: SolvedSlabZone[] = [];
  const bars: BarPosition[] = [];
  /** R3: each zone's RESOLVED section level (the `z.v ?? default` the loop actually used) — the level a
   *  placed band is matched against. Kept alongside `slabZones` so the credit sees the same `v` the bars do. */
  const zoneVs: number[] = [];
  let phiLMax = 0;

  for (const z of input.zones) {
    phiLMax = Math.max(phiLMax, z.diameter);
    const d = slabEffectiveDepth(geometry.t, input.cover, z.diameter);
    const asProvPerM = slabProvidedPerMetre(z.diameter, z.spacing);
    const role = z.role ?? (z.slabRole === "SECONDARY" ? "DISTRIBUTION" : "PRIMARY_LONGITUDINAL");
    const shape = generateShape(z.shape, z.params, z.diameter, code);
    const v = z.v ?? geometry.t / 2 - input.cover;
    zoneVs.push(v); // R3: the level this zone's steel actually sits at
    // v1.0.4 C1: a DISTRIBUTION linear bar runs ACROSS the width at span stations (exact coupe); a
    // MAIN/TOP bar (or a mesh topping) keeps the along-span row (`across` never set → byte-identical).
    const linearDist = isDistributionLinear(role, shape);
    const zoneBars = linearDist
      ? solveSlabDistributionBars(geometry.Lx, z.spacing, v, z.zone)
      : solveSlabBars(geometry.Ly, z.spacing, v, z.zone);
    zonesGeom.push({ zone: z.zone, d, dPrime: input.cover, tensionCentroid: { u: 0, v: z.v ?? 0 } });
    groups.push({
      groupId: z.groupId,
      role,
      diameter: z.diameter,
      // C1 review-fix (F2, 2026-07-08): the fabrication COUNT now matches the rendered/scheduled set —
      // a linear DISTRIBUTION bar is counted from the SPAN-distributed bars actually placed (so the BBS,
      // the bending table and the 3D/coupe agree); MAIN/TOP + mesh topping keep the width-derived count.
      count: linearDist ? zoneBars.length : Math.floor(geometry.Ly / z.spacing) + 1,
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

  // v1.0.5 M2 (P-B): resolve any freely placed bars (an extra band) additively to the per-metre mat.
  // v1.0.6-fix R3 (F-B): this MUST happen BEFORE the profile runs. It used to sit *after* the `validate()`
  // call below — which is the mechanical reason a placed band could never reach §7: by the time the bars
  // existed, the verdict had already been computed from the bare mat.
  const longBars =
    input.placed && input.placed.length > 0
      ? resolvePlacedBars(input.placed, {
          memberLength: geometry.Lx,
          code,
          material: input.material,
          layoutBars: bars,
          groups,
          section: "SLAB",
          sectionDims: { b: geometry.Ly, h: geometry.t }, // M3: a Layer band offsets from the slab face
          startIndex: bars.length,
        })
      : undefined;

  // R3 (F-B): credit the placed steel to the per-metre zones — As,prov rises and `d` is re-weighted, so
  // a band the detailer added to fix an under-provision actually clears the red (owner O-2: credited over
  // the band's own extent). No placed bars → empty map → every legacy slab byte-identical.
  if (longBars && input.placed) {
    const credited = creditPlacedPerMetre(
      input.placed,
      longBars,
      slabZones.map((z, i) => ({
        zone: z.zone,
        v: zoneVs[i] ?? 0,
        asProvPerM: z.asProvPerM,
        d: z.d,
        spacing: z.spacing,
        ...(input.zones[i]?.axis !== undefined ? { axis: input.zones[i]!.axis } : {}), // R9 (F-H)
      })),
      { thickness: geometry.t },
    );
    for (const z of slabZones) {
      const c = credited.get(z.zone);
      if (!c) continue;
      z.asProvPerM = c.asProvPerM;
      z.d = c.d;
      const zg = zonesGeom.find((g) => g.zone === z.zone);
      if (zg) zg.d = c.d; // keep the reported per-zone geometry in step with what was judged
    }
  }

  const slab: SlabContext = {
    thickness: geometry.t,
    zones: slabZones,
    ...(input.restrainedCorner !== undefined ? { restrainedCorner: input.restrainedCorner } : {}),
    ...(input.cornerTorsionProvided !== undefined ? { cornerTorsionProvided: input.cornerTorsionProvided } : {}),
  };

  const validate = getValidationProfile(input.profile);
  const validation = validate({
    element: input.element,
    section: "SLAB",
    geometry: { Lx: geometry.Lx, Ly: geometry.Ly, t: geometry.t },
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

  // v1.0.5 M4 (Track V): honest tiers for freely placed steel on this slab — bundle count/cover, layer
  // spacing, curtailment anchorage + the element-agnostic geometry (axial-extent / section-bounds) the
  // RECT pipeline runs inline. Only fires when the user placed bars (legacy slab byte-identical).
  if (longBars && input.placed) {
    validation.push(
      ...validatePlacedBarRules(input.placed, longBars, {
        section: "SLAB",
        b: geometry.Ly,
        h: geometry.t,
        cover: input.cover,
        memberLength: geometry.Lx,
        dg,
        codeRef: (code as { codeRef?: string }).codeRef ?? code.id,
        material: input.material,
        bands: { spacing: code.warnBands?.spacing ?? 0.05, anchorage: code.warnBands?.anchorage ?? 0.05 },
        includeGeometry: true,
      }, code),
    );
  }

  // v1.0.5 M5 (Track S): a freely placed slab bar carrying its OWN splices gets the per-bar stagger check.
  // The slab's per-metre DISTRIBUTION mat is NEVER spliced (supplied in stock lengths, spec Part IV) — only
  // a user's free `placed` bar can lap here. Fires only when a placed bar actually laps → byte-identical.
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
    // slab-family → RECT envelope: width Ly × thickness t, bars run along the span Lx (§9.5).
    member: { envelope: "RECT", length: geometry.Lx, b: geometry.Ly, h: geometry.t, transverse: [] },
    ...(longBars ? { longBars, hasUserAddressableContent: true } : {}),
  };
}
