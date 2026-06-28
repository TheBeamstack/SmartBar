/**
 * Generic element pipeline (spec §6; closes P1 decision D-P1-4).
 *
 * `solveElement` is the ONE orchestrator for every rectangular element: it assembles the
 * cross-section layout, generates each group's shape, computes per-zone effective depth, and
 * validates through the profile registry (validation/profiles.ts) chosen by the manifest's
 * `validationProfile`. There is NO `if (elementType === …)` branch here — the column and the
 * beam differ only in their manifests + registered profile (golden rule §0.1).
 *
 * `solveColumn` (solve.ts) is now a thin, convention-applying shim over this function so the
 * proven P1 column path and the new beam path share a single engine.
 *
 * Pure + deterministic; pack-agnostic.
 */
import type { ShapeArchetype } from "../types/shape";
import type { BarRole } from "../types/reinforcing-element";
import type { BarPosition, ZoneGeometry, LayoutDescriptor, MemberPlacement, TransverseRegion } from "../types/layout";
import type { RectLayout } from "../types/placement";
import type { MaterialContext, ValidationStatus } from "../types/codepack";
import type { SeismicOverlay, CritZoneSegment, LapExtent } from "../types/seismic";
import type { BarShapeResult, UserHook } from "../geometry/segment-grammar";
import { generateShape } from "../geometry/registry";
import {
  solveRectLayout,
  computeZoneGeometry,
  type TensionFace,
} from "../layout/rect";
import {
  rollupStatus,
  barArea,
  type ValidationItem,
  type ExtendedCodePack,
} from "../validation/index";
import { applySeismicOverlay } from "../validation/seismic";
import {
  getValidationProfile,
  type SolvedLongZone,
  type SolvedTransZone,
} from "../validation/profiles";

export interface SolvedGroup {
  groupId: string;
  role: BarRole;
  diameter: number;
  /** bars in the cross-section (longitudinal) or 1 representative (transverse set). */
  count: number;
  zone?: string;
  shape: BarShapeResult;
}

export interface SolveResult {
  element: string;
  bars: BarPosition[];
  zones: ZoneGeometry[];
  groups: SolvedGroup[];
  validation: ValidationItem[];
  status: ValidationStatus;
  /** true when the active pack ships provisional (unsigned) constants (G-BAEL etc.). */
  provisional: boolean;
  /** present when a seismic overlay (RPS, §7.10) was applied: l_c + injected segments. */
  seismic?: { l_c: number; segments: CritZoneSegment[] };
  /** 3D placement descriptor (spec §9.5) — the Section/Coupe engine + viewport read this. */
  member: MemberPlacement;
}

/** One longitudinal group as fed to the generic pipeline (shape + section binding). */
export interface ElementLongInput {
  zone: string;
  groupId: string;
  role?: BarRole;
  shape: ShapeArchetype;
  params: Record<string, number>;
  diameter: number;
  /** faces this zone occupies — its provided area + clear-spacing are taken over these. */
  faces: TensionFace[];
  asReq: number;
  /** tension face for the computed effective depth `d` ([REF-SYS-611]). */
  tensionFace: TensionFace;
  /** fraction of this zone's bars carried past the support (§7.7 end-support anchorage). */
  continuedToSupport?: number;
  /**
   * Explicit provided bar count for this zone, overriding the layout-face count. Lets two zones
   * share a face without double-counting — e.g. a beam's full-length montage top bars vs the
   * over-support chapeaux both on TOP (D-P6-1 fix 8b). Omitted → derived from the layout faces.
   */
  providedCount?: number;
  /** F6 ([REF-SYS-520]): per-end user hook override (none/90/135/180) for this group's shape. */
  hooks?: { start?: UserHook; end?: UserHook };
}

export interface ElementTransInput {
  zone: string;
  groupId: string;
  shape: ShapeArchetype;
  params: Record<string, number>;
  diameter: number;
  spacing: number;
  nLegs: number;
  aswReqPerM: number;
  userMandrel?: number;
  /** tie hook angle (90/135/180) — seismic overlay FAILs 90° (§7.10c). Default 135. */
  hookAngle?: number;
  /** tie hook extension as a multiple of φ — seismic requires ≥10φ. Default 10. */
  hookExtFactor?: number;
  /**
   * Optional section-frame placement (v1.0.2 F2 cross-ties, [REF-SYS-756]): place this set's loop
   * at `(u,v)` rotated by `angleDeg` instead of centred — so a cross-tie épingle sits between the
   * two bars it engages. Absent → centred (perimeter cadre/stirrup, byte-identical to v1.0.1).
   */
  anchor?: { u: number; v: number; angleDeg: number };
  /**
   * Optional ordered, contiguous spacing regions along the member axis (v1.0.2 F5, [REF-SYS-757]):
   * each `{from,to,spacing}` densifies its stretch independently. Absent (or one full-length region)
   * → the uniform `spacing` behaviour, byte-identical to pre-F5. A property of the set — no element
   * branching.
   */
  regions?: TransverseRegion[];
}

/** A pre-resolved supplemental group (already positioned by the scheme/placement resolver). */
export interface ElementSupplementInput {
  groupId: string;
  role: BarRole;
  shape: ShapeArchetype;
  params: Record<string, number>;
  diameter: number;
  count: number;
  /** catalog id (e.g. "SUPP_EPINGLE_CROSSTIE") — used to satisfy required seismic confinement. */
  catalogId?: string;
}

/**
 * Seismic-overlay block (spec §7.10) — when present, the RPS overlay is composed ON TOP of the
 * base profile validation. Member-level inputs; the per-tie hook data comes from `transverse`.
 */
export interface SeismicElementInput {
  overlay: SeismicOverlay;
  member: { kind: "COLUMN" | "BEAM"; length: number; bMin: number; hSectionMax: number };
  /** governing longitudinal ø (mm); defaults to the section's largest. */
  phiL?: number;
  /** confinement add-on ids present; defaults to the supplements' catalogIds. */
  confinementPresent?: string[];
  /** total longitudinal bars / number laterally engaged (crosstie_engagement, §7.13). */
  longBarsTotal: number;
  longBarsEngaged: number;
  /** lap / splice extents along the member (lap_in_critical_zone, §7.13). */
  laps?: LapExtent[];
}

export interface ElementSolveInput {
  element: string;
  /** the registered validation profile id, e.g. "BAEL_COLUMN" | "BAEL_BEAM". */
  profile: string;
  section: "RECT";
  geometry: { b: number; h: number; H?: number; L?: number };
  material: MaterialContext;
  cover: number;
  exposure: string;
  fire?: string;
  dg?: number;
  /** assembled per-face longitudinal counts for the whole section. */
  layout: RectLayout;
  /** transverse ø used for the cover-to-centroid inset d'. */
  phiT: number;
  /** representative (governing/largest) longitudinal ø used for the inset d'. */
  phiLInset: number;
  longitudinal: ElementLongInput[];
  transverse: ElementTransInput[];
  supplements?: ElementSupplementInput[];
  /** optional RPS seismic overlay (§7.10), composed on top of the base validation. */
  seismic?: SeismicElementInput;
  code: ExtendedCodePack;
}

const FACES: TensionFace[] = ["TOP", "BOTTOM", "LEFT", "RIGHT"];

/** Solve any rectangular element generically (spec §6). */
export function solveElement(input: ElementSolveInput): SolveResult {
  const { geometry, code } = input;
  const dg = input.dg ?? 20;

  // --- step 1: cross-section layout (shared by all longitudinal zones) ---
  const descriptor: LayoutDescriptor = {
    section: "RECT",
    geometry: { b: geometry.b, h: geometry.h },
    cover: input.cover,
    phiT: input.phiT,
    phiL: input.phiLInset,
    rect: input.layout,
  };
  const layout = solveRectLayout(descriptor);

  // --- per longitudinal zone: provided count over its faces + computed d + shape ---
  const groups: SolvedGroup[] = [];
  const zones: ZoneGeometry[] = [];
  const solvedLong: SolvedLongZone[] = [];
  let phiLMax = 0;

  for (const lz of input.longitudinal) {
    phiLMax = Math.max(phiLMax, lz.diameter);
    const faceSet = new Set(lz.faces);
    const providedCount = lz.providedCount ?? layout.bars.filter((bp) =>
      faceSet.has(bp.faceTag as TensionFace),
    ).length;
    const zoneGeom = computeZoneGeometry(
      lz.zone,
      layout.bars,
      { b: geometry.b, h: geometry.h },
      lz.tensionFace,
      barArea(lz.diameter),
    );
    zones.push(zoneGeom);
    const shape = generateShape(lz.shape, lz.params, lz.diameter, code, lz.hooks ? { hooks: lz.hooks } : undefined);
    groups.push({
      groupId: lz.groupId,
      role: lz.role ?? "PRIMARY_LONGITUDINAL",
      diameter: lz.diameter,
      count: providedCount,
      zone: lz.zone,
      shape,
    });
    solvedLong.push({
      zone: lz.zone,
      groupId: lz.groupId,
      diameter: lz.diameter,
      providedCount,
      asReq: lz.asReq,
      asProv: providedCount * barArea(lz.diameter),
      geometry: zoneGeom,
      tensionFace: lz.tensionFace,
      faces: lz.faces,
      ...(lz.continuedToSupport !== undefined ? { continuedToSupport: lz.continuedToSupport } : {}),
    });
  }

  // --- per transverse zone: representative shape (1 per set) ---
  const solvedTrans: SolvedTransZone[] = [];
  for (const tz of input.transverse) {
    const shape = generateShape(tz.shape, tz.params, tz.diameter, code);
    groups.push({
      groupId: tz.groupId,
      role: "TRANSVERSE",
      diameter: tz.diameter,
      count: 1,
      zone: tz.zone,
      shape,
    });
    solvedTrans.push({
      zone: tz.zone,
      groupId: tz.groupId,
      diameter: tz.diameter,
      spacing: tz.spacing,
      nLegs: tz.nLegs,
      aswReqPerM: tz.aswReqPerM,
      ...(tz.userMandrel !== undefined ? { userMandrel: tz.userMandrel } : {}),
    });
  }

  // --- supplemental groups (already positioned by the placement resolver) ---
  for (const sup of input.supplements ?? []) {
    const shape = generateShape(sup.shape, sup.params, sup.diameter, code);
    groups.push({
      groupId: sup.groupId,
      role: sup.role,
      diameter: sup.diameter,
      count: sup.count,
      shape,
    });
  }

  // --- validation via the profile registry (no element branching) ---
  const validate = getValidationProfile(input.profile);
  const validation = validate({
    element: input.element,
    geometry,
    cover: input.cover,
    exposure: input.exposure,
    ...(input.fire !== undefined ? { fire: input.fire } : {}),
    dg,
    material: input.material,
    layout,
    longitudinal: solvedLong,
    transverse: solvedTrans,
    phiLMax: phiLMax || input.phiLInset,
    code,
  });

  // --- seismic overlay (RPS, §7.10): compose on top of the base validation if a regime is set ---
  let seismic: { l_c: number; segments: CritZoneSegment[] } | undefined;
  if (input.seismic) {
    const s = input.seismic;
    const present =
      s.confinementPresent ??
      ((input.supplements ?? [])
        .map((x) => x.catalogId)
        .filter((id): id is string => typeof id === "string"));
    const res = applySeismicOverlay({
      overlay: s.overlay,
      member: s.member,
      phiL: s.phiL ?? (phiLMax || input.phiLInset),
      transverse: input.transverse.map((tz) => ({
        groupId: tz.groupId,
        zone: tz.zone,
        diameter: tz.diameter,
        spacing: tz.spacing,
        hookAngle: tz.hookAngle ?? 135,
        hookExtFactor: tz.hookExtFactor ?? 10,
        ...(tz.regions !== undefined ? { regions: tz.regions } : {}),
      })),
      confinementPresent: present,
      longBarsTotal: s.longBarsTotal,
      longBarsEngaged: s.longBarsEngaged,
      ...(s.laps !== undefined ? { laps: s.laps } : {}),
    });
    validation.push(...res.items);
    seismic = { l_c: res.l_c, segments: res.segments };
  }

  const member: MemberPlacement = {
    envelope: "RECT",
    length: geometry.H ?? geometry.L ?? geometry.h,
    b: geometry.b,
    h: geometry.h,
    transverse: input.transverse.map((tz) => ({
      groupId: tz.groupId,
      spacing: tz.spacing,
      ...(tz.anchor !== undefined ? { anchor: tz.anchor } : {}),
      ...(tz.regions !== undefined ? { regions: tz.regions } : {}),
    })),
  };

  return {
    element: input.element,
    bars: layout.bars,
    zones,
    groups,
    validation,
    status: rollupStatus(validation),
    provisional: (code as { _provisional?: boolean })._provisional === true,
    ...(seismic !== undefined ? { seismic } : {}),
    member,
  };
}

export type { TensionFace };
