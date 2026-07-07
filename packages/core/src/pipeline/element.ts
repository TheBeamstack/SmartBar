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
import type { BarPosition, ZoneGeometry, LayoutDescriptor, MemberPlacement, TransverseRegion, FaceTag } from "../types/layout";
import type { RectLayout } from "../types/placement";
import type { MaterialContext, ValidationStatus } from "../types/codepack";
import type { SeismicOverlay, CritZoneSegment, LapExtent } from "../types/seismic";
import type { BarShapeResult, UserHook } from "../geometry/segment-grammar";
import { generateShape } from "../geometry/registry";
import { spliceBar, autoSplices, evaluateLapStagger, type Splice, type SpliceResult } from "../geometry/splice";
import {
  solveRectLayout,
  computeZoneGeometry,
  computeZoneGeometryWeighted,
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
  validateAddressableBars,
  type AddressableBarView,
} from "../validation/predicates";
import {
  getValidationProfile,
  governingAswSpacing,
  type SolvedLongZone,
  type SolvedTransZone,
  type SupportInput,
} from "../validation/profiles";

export interface SolvedGroup {
  groupId: string;
  role: BarRole;
  diameter: number;
  /** bars in the cross-section (longitudinal) or 1 representative (transverse set). */
  count: number;
  zone?: string;
  shape: BarShapeResult;
  /** v1.0.4 E1: the archetype param values (for the canonical §10 `reinforcement[]` export). */
  params?: Record<string, number>;
  /** v1.0.4 E1: the supplement catalog id (supplemental groups) for the canonical export. */
  supplementId?: string;
  /** v1.0.3 G4 ([REF-SYS-770]): lap/coupler segmentation of this group's bars (absent → unspliced). */
  splice?: SpliceResult;
  /** v1.0.4 B3 ([REF-SYS-756c]): section-frame placement for an anchored supplement (skin/diagonal/
   *  diamond) — placeBars renders it here instead of centred at the origin. Absent → centred. */
  anchor?: { u: number; v: number; angleDeg: number };
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
  /**
   * v1.0.3 G2 ([REF-SYS-530]): explicit per-bar longitudinal placements (shape/Ø/axial start/removed)
   * + appended extra bars. Present ONLY when the element has overrides/extra bars; `placeBars` + the
   * BBS read it instead of the grouped path. Absent → grouped (every existing golden byte-identical).
   */
  longBars?: PlacedLongBar[];
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
  /** v1.0.3 G4 ([REF-SYS-770]): manual lap/coupler splice points along this group's bars. */
  splices?: Splice[];
  /** v1.0.3 G4: auto-split when the fabricated run exceeds the stock length (default 12 m). */
  autoSplice?: boolean;
  /**
   * v1.0.4 B2 ([REF-SYS-260]): axial start station (mm) for THIS zone's bars along the member — so a
   * beam's right-support chapeau sits over its support (`L − extension`) rather than at station 0. Read
   * by the addressable channel (`buildLongBars`); a zone without it defaults to 0 (byte-identical). The
   * grouped fast path ignores it (representative placement — unchanged).
   */
  axisStart?: number;
}

/**
 * v1.0.3 G2 ([REF-SYS-530]) — a per-bar override on one bar of a longitudinal group. `barIndex` is
 * the STABLE index into the solved `bars[]` (the same index the F7 picker / cross-ties bind to,
 * D-P3-4). The adapter passes the FULL `shape`+`params` for an override (it knows the group default
 * + the user edit) so the engine regenerates the bar's geometry exactly; geometry/schedule only —
 * the validation layout/As is untouched (the group still drives the §7 checks). Absent → grouped.
 */
export interface LongBarOverride {
  barIndex: number;
  shape?: ShapeArchetype;
  params?: Record<string, number>;
  hooks?: { start?: UserHook; end?: UserHook };
  diameter?: number;
  /** axial start station along the member (mm) — feeds the G1 `axisStart` (unique-position bars). */
  axisStart?: number;
  /** v1.0.4 B1: explicit per-bar lap/coupler stations (staggered by the caller). */
  splices?: Splice[];
  /** v1.0.4 H14: auto-split this bar at the stock length (`ElementSolveInput.stockLength`). */
  autoSplice?: boolean;
  /** drop this bar from the render + schedule (kept in the validation count — see note above). */
  removed?: boolean;
}

/**
 * v1.0.3 G2 ([REF-SYS-530]) — an independent addressable bar, not part of any count-group: its own
 * section position `(u,v)` (the `v` IS its section level, incl. an intermediate U-bar level), shape,
 * length/axial position and Ø. Rendered + scheduled like a real bar. **v1.0.4 A2 (owner 2026-07-06):**
 * it is real steel — it contributes π/4·Ø² to the As,prov of the zone whose tension region its `(u,v)`
 * lies in, and enters the area-weighted `d` (was: detailing-only). Absent → none (legacy byte-identical).
 */
export interface ExtraLongBar {
  id: string;
  position: { u: number; v: number };
  shape: ShapeArchetype;
  params: Record<string, number>;
  hooks?: { start?: UserHook; end?: UserHook };
  diameter: number;
  axisStart?: number;
  role?: BarRole;
  /** v1.0.4 B1: explicit per-bar lap/coupler stations. */
  splices?: Splice[];
  /** v1.0.4 H14: auto-split at the stock length. */
  autoSplice?: boolean;
}

/**
 * v1.0.3 G2 — one rendered longitudinal bar with its OWN resolved geometry (shape/Ø/axial start).
 * The pipeline emits a `SolveResult.longBars[]` only when overrides/extra bars exist; `placeBars`
 * (3D/coupe/PDF/DXF) and `computeBBS` (schedule) then read it instead of the grouped fast path, so
 * a per-bar shape/length/extra bar appears everywhere. Absent → grouped (every existing golden held).
 */
export interface PlacedLongBar {
  /** stable index (base bars keep their `bars[]` index; extra bars get appended indices). */
  barIndex: number;
  groupId: string;
  role: BarRole;
  position: { u: number; v: number };
  shape: BarShapeResult;
  diameter: number;
  axisStart: number;
  removed: boolean;
  /** true for an independent extra bar (not a member of a count-group). */
  standalone: boolean;
  /** v1.0.4 H14/B1: this bar's per-bar splice (explicit or auto at stock length). Absent → unspliced. */
  splice?: SpliceResult;
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
  /**
   * v1.0.4 B3 ([REF-SYS-756c]): resolved section-frame placement (skin bar on a side face, corner
   * diagonal, interior diamond) so the add-on renders in its TRUE position + orientation instead of
   * centred at the origin. Absent → centred (byte-identical to the legacy presence render).
   */
  anchor?: { u: number; v: number; angleDeg: number };
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
  /** v1.0.3 G2: per-bar overrides on the longitudinal groups (absent → grouped, byte-identical). */
  longOverrides?: LongBarOverride[];
  /** v1.0.3 G2: independent addressable bars / extra section levels (absent → none). */
  extraBars?: ExtraLongBar[];
  supplements?: ElementSupplementInput[];
  /**
   * v1.0.4 H14: commercial stock bar length (mm) for per-bar auto-splitting on the addressable
   * channel. ⚠ PROVISIONAL default 12000 (owner_tasks §C / `structural_data §2`), owner-confirmable.
   */
  stockLength?: number;
  /**
   * v1.0.4 B2: element supports (a beam's V1/V2) with each support's provided bottom-bar anchorage +
   * bearing width, for the per-support §7.7 anchorage check. Consumed only by profiles that read it
   * (BAEL_BEAM); absent for supportless elements (columns/slabs) → no per-support check.
   */
  supports?: SupportInput[];
  /** optional RPS seismic overlay (§7.10), composed on top of the base validation. */
  seismic?: SeismicElementInput;
  code: ExtendedCodePack;
}

const FACES: TensionFace[] = ["TOP", "BOTTOM", "LEFT", "RIGHT"];

/** Roles whose bars are individually rendered longitudinal members (G2 addressable bars). */
const LONG_ROLES = new Set<BarRole>(["PRIMARY_LONGITUDINAL", "DISTRIBUTION"]);

/**
 * H8 helper: the developed extent of a shape's centreline along its run axis (local-frame u = index
 * 0 of the flat `[x,y,z,…]` centreline). This is the along-member footprint the axial-extent validity
 * predicate measures against the member length. Pure.
 */
function runExtent(centerline3D: number[]): number {
  if (centerline3D.length < 3) return 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < centerline3D.length; i += 3) {
    const x = centerline3D[i]!;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return max - min;
}

/**
 * v1.0.4 (A2 completeness): the face(s) a placed rect bar belongs to, matching the layout's
 * `faceCounts` convention where a CORNER bar is counted on BOTH its edges. Used to reduce the
 * authoritative `faceCounts` by removed bars so `face_min_bars` reflects removals exactly (a
 * geometry recompute would diverge from the declared per-face counts — corners are shared).
 */
function faceMembership(bp: BarPosition): TensionFace[] {
  if (bp.isCorner) {
    return [bp.position.v > 0 ? "TOP" : "BOTTOM", bp.position.u > 0 ? "RIGHT" : "LEFT"];
  }
  return [bp.faceTag as TensionFace];
}

/**
 * v1.0.3 G2 ([REF-SYS-530]): build the explicit per-bar longitudinal list when the element has
 * overrides or extra bars (else `undefined` → the grouped fast path, byte-identical). Each base bar
 * inherits its group's shape unless an override replaces it; extra bars are appended with their own
 * geometry. The bar→group mapping mirrors `placeBars` (zone match, else the rect TOP/main convention)
 * so the rendered bar and its schedule line agree. Pure; no element branching.
 */
function buildLongBars(
  input: ElementSolveInput,
  groups: SolvedGroup[],
  layoutBars: BarPosition[],
  code: ExtendedCodePack,
): PlacedLongBar[] | undefined {
  const overrides = input.longOverrides ?? [];
  const extra = input.extraBars ?? [];
  if (overrides.length === 0 && extra.length === 0) return undefined;
  const longGroups = groups.filter((g) => LONG_ROLES.has(g.role));
  if (longGroups.length === 0) return undefined;

  const byZone = new Map<string, SolvedGroup>();
  for (const g of groups) if (g.zone) byZone.set(g.zone, g);
  const mainLong = longGroups[0]!;
  const topLong = longGroups[1] ?? longGroups[0]!;
  // Distribute the section's bars across the longitudinal ZONES that share a face, in declaration
  // order, up to each zone's resolved provided count — so a face carrying several zones (a beam's
  // montage + the two per-support chapeaux, G3) maps each physical bar to the right zone's shape/Ø,
  // and the schedule lists each zone distinctly. A single-zone face (column) maps every bar to it
  // (byte-identical to the old TOP/main convention). Slab-family bars match their zone via `faceTag`.
  const groupById = new Map<string, SolvedGroup>(groups.map((g) => [g.groupId, g]));
  const faceZones = new Map<string, SolvedGroup[]>();
  const repPosByFace = new Map<string, { u: number; v: number }[]>();
  for (const lz of input.longitudinal) {
    const g = groupById.get(lz.groupId);
    if (!g || !LONG_ROLES.has(g.role)) continue;
    for (const face of lz.faces) (faceZones.get(face) ?? faceZones.set(face, []).get(face)!).push(g);
  }
  for (const bp of layoutBars) (repPosByFace.get(bp.faceTag) ?? repPosByFace.set(bp.faceTag, []).get(bp.faceTag)!).push(bp.position);
  const placed = new Map<string, number>(); // bars assigned per group (vs its provided count)
  const inc = (gid: string): void => { placed.set(gid, (placed.get(gid) ?? 0) + 1); };
  const groupForBar = (bp: BarPosition): SolvedGroup => {
    const byZ = byZone.get(bp.faceTag);
    if (byZ && LONG_ROLES.has(byZ.role)) { inc(byZ.groupId); return byZ; } // slab-family exact zone
    const zs = faceZones.get(bp.faceTag);
    if (zs && zs.length > 0) {
      for (const g of zs) if ((placed.get(g.groupId) ?? 0) < g.count) { inc(g.groupId); return g; }
      const last = zs[zs.length - 1]!; inc(last.groupId); return last; // face over-full → last zone
    }
    const fb = (bp.faceTag === "TOP" ? topLong : mainLong) ?? mainLong;
    inc(fb.groupId); return fb;
  };
  const ovByIndex = new Map<number, LongBarOverride>(overrides.map((o) => [o.barIndex, o]));
  // v1.0.4 B2: per-zone axial start (a beam's right-support chapeau over its support = `L − extension`).
  const zoneAxisStart = new Map<string, number>();
  for (const lz of input.longitudinal) if (lz.axisStart !== undefined) zoneAxisStart.set(lz.groupId, lz.axisStart);
  // v1.0.4 H14/B1: per-bar splice — explicit stations + optional auto-split at the stock length. The
  // segments feed the schedule (BBS) + the stagger/seismic checks; unspliced bars → undefined (no-op).
  const stock = input.stockLength ?? 12000;
  const barSplice = (shape: BarShapeResult, dia: number, splices?: Splice[], autoSplice?: boolean): SpliceResult | undefined => {
    const pts: Splice[] = [...(splices ?? []), ...(autoSplice ? autoSplices(shape.cutLength, stock) : [])];
    if (pts.length === 0) return undefined;
    return spliceBar(shape.cutLength, pts, code, { diameter: dia, material: input.material, fractionLapped: 1 });
  };

  const out: PlacedLongBar[] = [];
  for (let i = 0; i < layoutBars.length; i++) {
    const bp = layoutBars[i]!;
    const g = groupForBar(bp);
    const ov = ovByIndex.get(i);
    let shape = g.shape;
    let diameter = g.diameter;
    let axisStart = zoneAxisStart.get(g.groupId) ?? 0;
    let removed = false;
    if (ov) {
      removed = ov.removed === true;
      diameter = ov.diameter ?? g.diameter;
      axisStart = ov.axisStart ?? axisStart;
      if (ov.shape) {
        shape = generateShape(ov.shape, ov.params ?? {}, diameter, code, ov.hooks ? { hooks: ov.hooks } : undefined);
      }
    }
    const splice = removed ? undefined : barSplice(shape, diameter, ov?.splices, ov?.autoSplice);
    out.push({ barIndex: i, groupId: g.groupId, role: g.role, position: bp.position, shape, diameter, axisStart, removed, standalone: false, ...(splice ? { splice } : {}) });
  }
  // Any longitudinal zone the representative section couldn't seat (e.g. the second beam support's
  // chapeau — both supports never share a cross-section, G3) is emitted as addressable bars so it
  // still renders + schedules. Representative position: a bar slot on the zone's own face.
  let nextIndex = layoutBars.length;
  for (const lz of input.longitudinal) {
    const g = groupById.get(lz.groupId);
    if (!g || !LONG_ROLES.has(g.role)) continue;
    const shortfall = g.count - (placed.get(g.groupId) ?? 0);
    if (shortfall <= 0) continue;
    const reps = lz.faces.flatMap((f) => repPosByFace.get(f) ?? []);
    const zAxis = lz.axisStart ?? 0; // B2: place the under-seated zone (e.g. right chapeau) at its support
    for (let k = 0; k < shortfall; k++) {
      const pos = reps.length > 0 ? reps[k % reps.length]! : { u: 0, v: 0 };
      out.push({ barIndex: nextIndex++, groupId: g.groupId, role: g.role, position: pos, shape: g.shape, diameter: g.diameter, axisStart: zAxis, removed: false, standalone: false });
    }
  }
  extra.forEach((eb) => {
    const shape = generateShape(eb.shape, eb.params, eb.diameter, code, eb.hooks ? { hooks: eb.hooks } : undefined);
    const splice = barSplice(shape, eb.diameter, eb.splices, eb.autoSplice);
    out.push({
      barIndex: nextIndex++,
      groupId: eb.id,
      role: eb.role ?? "PRIMARY_LONGITUDINAL",
      position: eb.position,
      shape,
      diameter: eb.diameter,
      axisStart: eb.axisStart ?? 0,
      removed: false,
      standalone: true,
      ...(splice ? { splice } : {}),
    });
  });
  return out;
}

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
  const lapExtents: LapExtent[] = []; // G4: for lap_in_critical_zone + the stagger WARN
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
    // G4 ([REF-SYS-770]): split this group's bars at their lap/coupler points (or auto when the run
    // exceeds stock). The lap overlap comes from `code.l0`; the segments feed the schedule (BBS) and
    // the lap extents feed the seismic lap_in_critical_zone / stagger checks. Absent → unspliced.
    let splice: SpliceResult | undefined;
    const splicePts: Splice[] = [
      ...(lz.splices ?? []),
      ...(lz.autoSplice ? autoSplices(shape.cutLength) : []),
    ];
    if (splicePts.length > 0) {
      splice = spliceBar(shape.cutLength, splicePts, code, {
        diameter: lz.diameter,
        material: input.material,
        fractionLapped: 1,
      });
      const half = splice.lapLength / 2;
      for (const p of splicePts) {
        if (p.at <= 1e-6 || p.at >= shape.cutLength - 1e-6) continue;
        if (p.kind === "lap") lapExtents.push({ groupId: lz.groupId, start: Math.max(0, p.at - half), end: p.at + half });
      }
    }
    groups.push({
      groupId: lz.groupId,
      role: lz.role ?? "PRIMARY_LONGITUDINAL",
      diameter: lz.diameter,
      count: providedCount,
      zone: lz.zone,
      shape,
      params: lz.params, // E1
      ...(splice ? { splice } : {}),
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
      params: tz.params, // E1
    });
    solvedTrans.push({
      zone: tz.zone,
      groupId: tz.groupId,
      diameter: tz.diameter,
      spacing: tz.spacing,
      nLegs: tz.nLegs,
      aswReqPerM: tz.aswReqPerM,
      ...(tz.userMandrel !== undefined ? { userMandrel: tz.userMandrel } : {}),
      ...(tz.regions !== undefined ? { regions: tz.regions } : {}), // A2: per-region Asw
    });
  }

  // --- supplemental groups (positioned by the placement resolver; B3: carry the section anchor) ---
  for (const sup of input.supplements ?? []) {
    const shape = generateShape(sup.shape, sup.params, sup.diameter, code);
    groups.push({
      groupId: sup.groupId,
      role: sup.role,
      diameter: sup.diameter,
      count: sup.count,
      shape,
      params: sup.params, // E1
      ...(sup.catalogId !== undefined ? { supplementId: sup.catalogId } : {}), // E1
      ...(sup.anchor !== undefined ? { anchor: sup.anchor } : {}),
    });
  }

  // --- v1.0.4 A2 ([owner ruling 2026-07-05], structural_data §1): reconcile per-zone As,prov +
  // effective depth `d` over the REAL placed set — per-bar Ø overrides, removed bars, and standalone
  // extras/supplements assigned by region — so EVERY steel add/remove feeds §7 (was: count×area over
  // the layout). Exact for mixed Ø + mixed levels via the area-weighted centroid. Only runs when the
  // addressable channel is active (`longBars` present); a grouped doc keeps the byte-identical
  // count-based As (extras count toward the zone they reinforce — owner decision 2026-07-06). ---
  const section = { b: geometry.b, h: geometry.h };
  const nearestFace = (p: { u: number; v: number }): TensionFace => {
    const dist: Record<TensionFace, number> = {
      TOP: section.h / 2 - p.v,
      BOTTOM: p.v + section.h / 2,
      LEFT: p.u + section.b / 2,
      RIGHT: section.b / 2 - p.u,
    };
    return (["TOP", "BOTTOM", "LEFT", "RIGHT"] as TensionFace[]).reduce((a, b) => (dist[b] < dist[a] ? b : a));
  };
  // a standalone extra reinforces the zone whose tension face it sits nearest (region rule); if no
  // zone owns that face, it falls to the first zone (A1 review confirms the edge conventions).
  const zoneForExtra = (p: { u: number; v: number }): string | undefined => {
    const face = nearestFace(p);
    return (solvedLong.find((z) => z.tensionFace === face) ?? solvedLong[0])?.groupId;
  };

  const longBars = buildLongBars(input, groups, layout.bars, code);
  if (longBars !== undefined && solvedLong.length > 0) {
    const faceTagOf = (pb: PlacedLongBar): FaceTag =>
      pb.standalone ? nearestFace(pb.position) : layout.bars[pb.barIndex]?.faceTag ?? nearestFace(pb.position);

    for (let i = 0; i < solvedLong.length; i++) {
      const sl = solvedLong[i]!;
      const placed = longBars.filter(
        (pb) =>
          !pb.removed &&
          (pb.standalone ? zoneForExtra(pb.position) === sl.groupId : pb.groupId === sl.groupId),
      );
      sl.asProv = placed.reduce((s, pb) => s + barArea(pb.diameter), 0);
      sl.providedCount = placed.length;
      sl.geometry = computeZoneGeometryWeighted(
        sl.zone,
        placed.map((pb) => ({ position: pb.position, area: barArea(pb.diameter), faceTag: faceTagOf(pb) })),
        section,
        sl.tensionFace,
      );
      zones[i] = sl.geometry; // keep SolveResult.zones in sync with the reconciled geometry
    }
  }

  // --- v1.0.4 B3 ([REF-SYS-756c], §5.4): fold anchored ADD-ONS into A2's steel accounting, so "every
  // steel add feeds §7" holds for supplements too (was: supplements rendered but never counted). An OPEN
  // add-on that runs along the member — a SKIN bar OR a CORNER-DIAGONAL bar — is real longitudinal steel:
  // its area joins the As,prov + provided count of the zone whose tension region its anchor sits in (the
  // owner's extra→zone rule; the beam extra→zone limitation is the standing A1 open call). `d` is left on
  // the extreme-tension layer (a mid-face skin bar does NOT lower the flexural lever arm — conservative +
  // honest). A CLOSED confinement tie (interior DIAMANT) crosses the shear plane with 2 legs → extra
  // Asw/m on every transverse zone, credited at the geometrically-derived orientation factor
  // cos(inclination) (a 45° diamond ⇒ ~0.707 of a vertical leg). ⚠ the leg-crossing/orientation
  // convention is a G-BAEL/EC2 sign-off item (flagged) — the value is DERIVED geometry, not an invented
  // constant. Self-gated to anchored add-ons → a doc without them is byte-identical. ---
  const aswExtraByZone = new Map<string, number>();
  for (const sup of input.supplements ?? []) {
    if (!sup.anchor) continue;
    if (!sup.shape.closed) {
      // open longitudinal add-on (skin bar / corner diagonal) → As of the zone it reinforces.
      const gid = zoneForExtra(sup.anchor);
      const sl = solvedLong.find((z) => z.groupId === gid);
      if (!sl) continue;
      sl.asProv += barArea(sup.diameter) * sup.count;
      sl.providedCount += sup.count;
    } else {
      const orient = Math.abs(Math.cos((sup.anchor.angleDeg * Math.PI) / 180)); // 45° diamond → ~0.707
      const perLeg = barArea(sup.diameter) * sup.count;
      for (const tz of solvedTrans) {
        const extra = (2 * orient * perLeg * 1000) / governingAswSpacing(tz);
        aswExtraByZone.set(tz.groupId, (aswExtraByZone.get(tz.groupId) ?? 0) + extra);
      }
    }
  }
  if (aswExtraByZone.size > 0) {
    for (const tz of solvedTrans) {
      const extra = aswExtraByZone.get(tz.groupId);
      if (extra) tz.aswProvExtraPerM = (tz.aswProvExtraPerM ?? 0) + extra;
    }
  }

  // --- v1.0.4 (A2 completeness fix): the REAL placed bar count + per-face counts drive min_bars /
  // face_min_bars, so a removal that drops the count below the code minimum (or empties a face) is
  // caught — was: the nominal `layout.count`, which let a below-minimum column export green. Only
  // computed when the addressable channel is active (`longBars`); grouped docs pass `undefined` →
  // the validator falls back to the layout counts → byte-identical. ---
  let placedCount: number | undefined;
  let placedUnderfilledFaces: TensionFace[] | undefined;
  if (longBars !== undefined) {
    placedCount = longBars.filter((pb) => !pb.removed).length;
    if (layout.faceCounts) {
      const real: Record<string, number> = { ...layout.faceCounts };
      for (const pb of longBars) {
        if (!pb.removed || pb.standalone) continue;
        const bp = layout.bars[pb.barIndex];
        if (!bp) continue;
        for (const f of faceMembership(bp)) real[f] = (real[f] ?? 0) - 1;
      }
      placedUnderfilledFaces = FACES.filter((f) => (layout.faceCounts![f] ?? 0) > 0 && (real[f] ?? 0) < 2);
    }
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
    ...(input.supports !== undefined ? { supports: input.supports } : {}),
    ...(placedCount !== undefined ? { placedCount } : {}),
    ...(placedUnderfilledFaces !== undefined ? { placedUnderfilledFaces } : {}),
    phiLMax: phiLMax || input.phiLInset,
    code,
  });

  // --- G4 ([REF-SYS-770], §4.2): a lap splice must be STAGGERED between adjacent bars. Group-level
  // splices land every bar's lap at the same station (coincident), so warn to stagger them (this is
  // WARN-only; the seismic lap_in_critical_zone below adds the hinge-zone check when a regime is set).
  for (const g of groups) {
    if (!g.splice || !g.splice.segments.some((s) => s.lapForward)) continue;
    validation.push({
      rule: `lap_stagger:${g.zone ?? g.groupId}`,
      status: "WARN",
      value: g.splice.lapLength,
      limit: null,
      codeRef: (code as { codeRef?: string }).codeRef ?? code.id,
      message_fr: `Recouvrements alignés (l_r=${Math.round(g.splice.lapLength)} mm) — décaler (quinconce) les barres adjacentes`,
      message_en: `Laps coincident (l_r=${Math.round(g.splice.lapLength)} mm) — stagger adjacent bars`,
      affectedGroupIds: [g.groupId],
      tier: 2,
      symbol: "🟠",
    });
  }

  // --- v1.0.4 H14/B1 ([REF-SYS], §B1): per-bar splices on the ADDRESSABLE channel. Each spliced bar's
  // laps feed the seismic lap_in_critical_zone (exact per bar) + a per-zone STAGGER check against the
  // sourced rule (EC2 §8.7.2: ≤ ½ of a zone's bars lapped within one 0.3·l0 section → PASS, else WARN
  // — the group-level blanket WARN above never fires for these, since the per-bar splice lives on the
  // longBar, not the representative group). Grouped-only docs have no addressable splices → inert. ---
  if (longBars !== undefined) {
    const lapStationsOf = (sp: SpliceResult, axisStart: number): number[] => {
      const out: number[] = [];
      let acc = 0;
      for (const seg of sp.segments) {
        acc += seg.cutLength - (seg.lapForward ? sp.lapLength : 0);
        if (seg.lapForward) out.push(axisStart + acc);
      }
      return out;
    };
    const byZone = new Map<string, { stations: number[][]; total: number; lapLength: number; anyLap: boolean }>();
    for (const pb of longBars) {
      if (pb.removed) continue;
      const z = byZone.get(pb.groupId) ?? { stations: [], total: 0, lapLength: 0, anyLap: false };
      z.total++;
      if (pb.splice && pb.splice.segments.some((s) => s.lapForward)) {
        const stations = lapStationsOf(pb.splice, pb.axisStart);
        z.stations.push(stations);
        z.lapLength = pb.splice.lapLength;
        z.anyLap = true;
        for (const at of stations) {
          lapExtents.push({ groupId: pb.groupId, start: at - pb.splice.lapLength / 2, end: at + pb.splice.lapLength / 2 });
        }
      }
      byZone.set(pb.groupId, z);
    }
    for (const [groupId, z] of byZone) {
      if (!z.anyLap) continue;
      const st = evaluateLapStagger(z.stations, z.lapLength, z.total);
      const pct = Math.round(st.worstFraction * 100);
      validation.push({
        rule: `lap_stagger:${groupId}`,
        status: st.pass ? "PASS" : "WARN",
        value: pct,
        limit: 50,
        codeRef: (code as { codeRef?: string }).codeRef ?? code.id,
        message_fr: st.pass
          ? `Recouvrements décalés (${pct} % par section ≤ 50 %)`
          : `Recouvrements alignés (${pct} % > 50 % dans 0,3·l0=${Math.round(st.window)} mm) — décaler (quinconce)`,
        message_en: st.pass
          ? `Laps staggered (${pct} % per section ≤ 50 %)`
          : `Laps clustered (${pct} % > 50 % within 0.3·l0=${Math.round(st.window)} mm) — stagger`,
        affectedGroupIds: [groupId],
        tier: st.pass ? 3 : 2,
        symbol: st.pass ? "🟢" : "🟠",
      });
    }
  }

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
      // G4: the actual lap extents (from spliceBar) drive lap_in_critical_zone, plus any caller laps.
      ...((s.laps ?? []).length + lapExtents.length > 0 ? { laps: [...(s.laps ?? []), ...lapExtents] } : {}),
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

  // --- H8 ([v1.0.4], owner A-5): geometric validity of the ADDRESSABLE channel (overrides + extra
  // bars). Only runs when `longBars` exists (else the grouped fast path — no addressable content),
  // and the predicate self-gates to real addressable bars, so a legacy doc is byte-identical. ---
  if (longBars !== undefined) {
    // A2 clear-spacing fold: a bar is a spacing FOCUS if it is a standalone extra or a per-bar Ø
    // override (its real Ø crowds the grid the face-based check never re-measures).
    const ovDiameter = new Set(
      (input.longOverrides ?? []).filter((o) => o.diameter !== undefined).map((o) => o.barIndex),
    );
    const views: AddressableBarView[] = longBars.map((b) => ({
      barIndex: b.barIndex,
      groupId: b.groupId,
      position: b.position,
      diameter: b.diameter,
      axisStart: b.axisStart,
      axialRun: runExtent(b.shape.centerline3D),
      removed: b.removed,
      standalone: b.standalone,
      focus: b.standalone || ovDiameter.has(b.barIndex),
    }));
    validation.push(
      ...validateAddressableBars(views, {
        b: geometry.b,
        h: geometry.h,
        cover: input.cover,
        memberLength: geometry.H ?? geometry.L ?? geometry.h,
        dg,
        codeRef: (code as { codeRef?: string }).codeRef ?? code.id,
        spacingBand: (code.warnBands?.spacing) ?? 0.05,
      }),
    );
  }

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
    ...(longBars !== undefined ? { longBars } : {}),
  };
}

export type { TensionFace };
