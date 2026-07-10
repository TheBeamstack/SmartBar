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
import { resolvePlacedBars } from "../section/resolvePlacedBars";
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
  let phiLMax = 0;

  for (const z of input.zones) {
    phiLMax = Math.max(phiLMax, z.diameter);
    const d = slabEffectiveDepth(geometry.t, input.cover, z.diameter);
    const asProvPerM = slabProvidedPerMetre(z.diameter, z.spacing);
    const role = z.role ?? (z.slabRole === "SECONDARY" ? "DISTRIBUTION" : "PRIMARY_LONGITUDINAL");
    const shape = generateShape(z.shape, z.params, z.diameter, code);
    const v = z.v ?? geometry.t / 2 - input.cover;
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

  // v1.0.5 M2 (P-B): resolve any freely placed bars (an extra band) additively to the per-metre mat.
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
