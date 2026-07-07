/**
 * Scheme / placement / supplement resolver (spec §5.3, §5.4, §5.5).
 *
 * This is the "killer feature" backbone: it maps a curated **scheme** onto an element's
 * reinforcement **zones**, resolves **placement rules** (a supplement that links two
 * longitudinal bars positions itself exactly between them), and re-solves dependents when the
 * base layout changes — flagging a supplement WARN when a referenced bar no longer exists.
 *
 * Everything is DATA-driven (golden rule §0.1): no element/scheme is hard-wired. Bindings
 * store STABLE IDS (group + barIndices), never resolved coordinates (§10), so a base-param
 * change re-solves the dependent supplement.
 *
 * Pure + deterministic; no DOM/React/three, no Node built-ins (browser- and test-safe).
 */
import type { BarRole } from "../types/reinforcing-element";
import type { BarPosition } from "../types/layout";
import type { PlacementRule } from "../types/placement";
import type { AnchorageArgs, MaterialContext } from "../types/codepack";

// --- light manifest views (mirror the JSON; the integrity gate pins their full shape) ---
export interface ElementZoneDef {
  key: string;
  kind: "longitudinal" | "transverse";
  unit?: string;
  label_fr?: string;
  label_en?: string;
}
export interface ElementManifestView {
  id: string;
  label_fr?: string;
  label_en?: string;
  As_zones: ElementZoneDef[];
  compatibleSchemes?: string[];
  validationProfile?: string;
}
export interface SchemeBaseGroupDef {
  role: BarRole;
  zone?: string;
  shape: string;
  placement?: PlacementRule;
}
export interface SchemeManifestView {
  id: string;
  label_fr?: string;
  label_en?: string;
  elementType: string;
  baseGroups: SchemeBaseGroupDef[];
  supplementalCatalog?: string[];
  validationProfile?: string;
}
export interface SupplementParamDef {
  key: string;
  type: string;
  default?: number;
}
export interface SupplementManifestView {
  id: string;
  label_fr?: string;
  label_en?: string;
  role: BarRole;
  shape: string;
  requires?: { hostRole?: string; min_bars?: number };
  placement?: PlacementRule;
  params?: SupplementParamDef[];
  validation?: string[];
}

// ---------------------------------------------------------------------------
// 5.3 — scheme → zone mapping (and clean remap when switching schemes)
// ---------------------------------------------------------------------------
export interface ResolvedBaseGroup {
  /** synthetic stable group id, `${scheme.id}:${zone|role}`. */
  groupId: string;
  role: BarRole;
  zone?: string;
  zoneKind?: "longitudinal" | "transverse";
  shape: string;
  placement?: PlacementRule;
}

export interface SchemeResolution {
  schemeId: string;
  elementType: string;
  groups: ResolvedBaseGroup[];
  /** zones the scheme's base groups actually cover. */
  coveredZones: string[];
  /** declared element zones with no base group (would leave As unmet). */
  uncoveredZones: string[];
  supplementalCatalog: string[];
  validationProfile?: string;
  errors: string[];
}

/**
 * Map a scheme's base groups onto the element's declared zones (§5.3). Switching schemes is
 * just calling this with another scheme — the previous mapping is replaced wholesale, so
 * groups remap cleanly with no stale state.
 */
export function resolveScheme(
  scheme: SchemeManifestView,
  element: ElementManifestView,
): SchemeResolution {
  const errors: string[] = [];
  if (scheme.elementType !== element.id) {
    errors.push(`scheme "${scheme.id}" targets ${scheme.elementType}, not ${element.id}`);
  }
  const zoneKind = new Map(element.As_zones.map((z) => [z.key, z.kind] as const));
  const covered = new Set<string>();
  const groups: ResolvedBaseGroup[] = scheme.baseGroups.map((g, i) => {
    if (g.zone !== undefined) {
      if (!zoneKind.has(g.zone)) {
        errors.push(`scheme "${scheme.id}": base group #${i} references unknown zone "${g.zone}"`);
      } else {
        covered.add(g.zone);
      }
    }
    return {
      groupId: `${scheme.id}:${g.zone ?? g.role}:${i}`,
      role: g.role,
      ...(g.zone !== undefined ? { zone: g.zone } : {}),
      ...(g.zone !== undefined && zoneKind.has(g.zone)
        ? { zoneKind: zoneKind.get(g.zone)! }
        : {}),
      shape: g.shape,
      ...(g.placement !== undefined ? { placement: g.placement } : {}),
    };
  });
  const uncovered = element.As_zones.map((z) => z.key).filter((k) => !covered.has(k));
  return {
    schemeId: scheme.id,
    elementType: scheme.elementType,
    groups,
    coveredZones: [...covered],
    uncoveredZones: uncovered,
    supplementalCatalog: scheme.supplementalCatalog ?? [],
    ...(scheme.validationProfile !== undefined ? { validationProfile: scheme.validationProfile } : {}),
    errors,
  };
}

// ---------------------------------------------------------------------------
// 5.4 — placement resolution (host-geometry references → positions)
// ---------------------------------------------------------------------------
export interface PointUV {
  u: number;
  v: number;
}

export interface BarPairPlacement {
  valid: boolean;
  /** midpoint between the two bound bars (section frame, mm). */
  position?: PointUV;
  /** centre-to-centre distance between the bound bars (mm) — the épingle `span` param. */
  span?: number;
  /** orientation of the A→B line within the u–v plane (degrees) — the cross-tie anchor angle (F2). */
  angleDeg?: number;
  /** which referenced index (if any) is out of range → needs rebind (§5.5). */
  brokenIndices?: number[];
}

/**
 * Map a picked point (section frame) to the nearest base-bar index. This is the pure backbone
 * of BOTH binding paths (§8 a11y): a 3D click raycasts to a point → this returns the bar index;
 * the keyboard/index list supplies the same index directly. Identical index ⇒ identical bind.
 */
export function nearestBarIndex(bars: BarPosition[], point: PointUV): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < bars.length; i++) {
    const p = bars[i]!.position;
    const d = Math.hypot(p.u - point.u, p.v - point.v);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Resolve a `LINK_BAR_PAIR` placement: position the add-on exactly between base bars i and j
 * (§5.4). Re-running this after the base layout changes re-solves the supplement (§5.5),
 * because it reads the CURRENT bar positions, not a stored coordinate.
 */
export function resolveBarPairPlacement(
  bars: BarPosition[],
  i: number,
  j: number,
): BarPairPlacement {
  const broken: number[] = [];
  if (i < 0 || i >= bars.length) broken.push(i);
  if (j < 0 || j >= bars.length) broken.push(j);
  if (broken.length > 0) return { valid: false, brokenIndices: broken };
  const a = bars[i]!.position;
  const b = bars[j]!.position;
  const span = Math.hypot(b.u - a.u, b.v - a.v);
  return {
    valid: true,
    position: { u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 },
    span,
    angleDeg: (Math.atan2(b.v - a.v, b.u - a.u) * 180) / Math.PI,
  };
}

// ---------------------------------------------------------------------------
// 5.5 — supplement resolution against the resolved base layout (+ broken-ref WARN)
// ---------------------------------------------------------------------------
export interface SupplementBinding {
  /** which catalog supplement this instance is. */
  supplementId: string;
  /** unique instance id (one user-added add-on). */
  instanceId: string;
  /** base group whose resolved bars the binding indexes into. */
  group: string;
  /** the picked longitudinal bar indices (click-to-bind OR keyboard/index list — identical). */
  barIndices: number[];
  /** instance param overrides (diameter, hook_angle, …). */
  params?: Record<string, number>;
}

export interface ResolvedSupplement {
  instanceId: string;
  supplementId: string;
  role: BarRole;
  shape: string;
  diameter: number;
  /** resolved shape params (e.g. { span } for an épingle). */
  params: Record<string, number>;
  /** centroid of the add-on in the section frame (mm), when point-placed. Equals `anchors[0]`. */
  position?: PointUV;
  /**
   * v1.0.4 B3 ([REF-SYS-756c], §5.4): in-plane orientation of the add-on (degrees) — a corner
   * diagonal along its bar pair, an interior diamond tie at 45°, a skin bar at 0°. Absent → 0.
   */
  angleDeg?: number;
  /**
   * v1.0.4 B3 ([REF-SYS-756c], §5.4): the FULL fan-out of placements for a multi-bar add-on — a
   * SIDE_FACES skin group is `count_per_side` bars on BOTH lateral faces, each anchored at its own
   * (u,v). A point-placed add-on (diagonal / diamond) carries a single entry. `position`/`angleDeg`
   * mirror `anchors[0]` (the representative) for back-compat.
   */
  anchors?: { u: number; v: number; angleDeg: number }[];
  /** PASS while every referenced bar exists; WARN when a base bar was deleted/moved out. */
  status: "PASS" | "WARN";
  /** human cue when a rebind is needed (§5.5). */
  message_fr?: string;
  message_en?: string;
  brokenIndices?: number[];
  /** affected group ids for alert highlighting. */
  affectedGroupIds: string[];
}

const defaultParam = (defs: SupplementParamDef[] | undefined, key: string, fallback: number): number => {
  const d = defs?.find((p) => p.key === key)?.default;
  return d ?? fallback;
};

/**
 * Resolve one user-added supplement instance against the current base layout (§5.5).
 *
 * - `requires.min_bars`: if the host doesn't have enough longitudinal bars → WARN.
 * - `LINK_BAR_PAIR`: resolves the épingle between the bound pair; out-of-range index (a base
 *   bar was deleted) → WARN with a rebind prompt and `brokenIndices`.
 */
export function resolveSupplement(
  supplement: SupplementManifestView,
  binding: SupplementBinding,
  baseBars: BarPosition[],
  baseGroupId: string,
): ResolvedSupplement {
  const diameter = binding.params?.["diameter"] ?? defaultParam(supplement.params, "diameter", 8);
  const base = {
    instanceId: binding.instanceId,
    supplementId: supplement.id,
    role: supplement.role,
    shape: supplement.shape,
    diameter,
    affectedGroupIds: [binding.instanceId, baseGroupId],
  };

  // host-capacity requirement (§5.5 `requires.min_bars`)
  const minBars = supplement.requires?.min_bars ?? 0;
  if (baseBars.length < minBars) {
    return {
      ...base,
      params: {},
      status: "WARN",
      message_fr: `${supplement.id}: support insuffisant (${baseBars.length} < ${minBars} barres) — retirer ou changer de schéma`,
      message_en: `${supplement.id}: insufficient host (${baseBars.length} < ${minBars} bars) — remove or change scheme`,
    };
  }

  const rule = supplement.placement?.rule;
  if (rule === "LINK_BAR_PAIR") {
    const [i, j] = binding.barIndices;
    const placed = resolveBarPairPlacement(baseBars, i ?? -1, j ?? -1);
    if (!placed.valid) {
      return {
        ...base,
        params: {},
        status: "WARN",
        message_fr: `${supplement.id}: barre de référence supprimée — re-lier ou retirer l'épingle`,
        message_en: `${supplement.id}: referenced bar deleted — rebind or remove the cross-tie`,
        ...(placed.brokenIndices ? { brokenIndices: placed.brokenIndices } : {}),
      };
    }
    return {
      ...base,
      params: { span: placed.span! },
      position: placed.position!,
      status: "PASS",
    };
  }

  // v1.0.4 B3 ([REF-SYS-756c], §5.4): anchored section placement for the remaining archetypes —
  // each resolves a REAL position (+ orientation) from the base layout instead of rendering centred
  // at the origin (the legacy "centred-for-presence", D-P3-6). The bar envelope (outermost bar u/v)
  // gives the face lines; corners come from the bound pair.
  const params = { ...(binding.params ?? {}) };
  let uMax = 0;
  let vMax = 0;
  for (const bp of baseBars) {
    uMax = Math.max(uMax, Math.abs(bp.position.u));
    vMax = Math.max(vMax, Math.abs(bp.position.v));
  }

  if (rule === "CORNER_DIAGONAL") {
    // a diagonal bar spanning the two bound corner bars: sit on their midpoint, oriented A→B.
    const [i, j] = binding.barIndices;
    const placed = resolveBarPairPlacement(baseBars, i ?? -1, j ?? -1);
    if (!placed.valid) {
      return {
        ...base,
        params: {},
        status: "WARN",
        message_fr: `${supplement.id}: barre de référence supprimée — re-lier ou retirer la diagonale`,
        message_en: `${supplement.id}: referenced bar deleted — rebind or remove the diagonal`,
        ...(placed.brokenIndices ? { brokenIndices: placed.brokenIndices } : {}),
      };
    }
    const a = { u: placed.position!.u, v: placed.position!.v, angleDeg: placed.angleDeg ?? 0 };
    return { ...base, params, position: placed.position!, angleDeg: a.angleDeg, anchors: [a], status: "PASS" };
  }

  if (rule === "INTERIOR_DIAMOND") {
    // a diamond confinement tie: centred but rotated 45° (its corners engage the mid-face bars).
    return { ...base, params, position: { u: 0, v: 0 }, angleDeg: 45, anchors: [{ u: 0, v: 0, angleDeg: 45 }], status: "PASS" };
  }

  if (rule === "SIDE_FACES") {
    // v1.0.4 B3 fanout: `count_per_side` skin bars on BOTH lateral faces (u = ±uMax), spaced evenly in
    // the clear height between the corner bars — bar k of n sits at v = −vMax + k/(n+1)·(2·vMax). One
    // bar/side (n=1) reproduces the legacy representative at mid-height (v=0). RIGHT face first so
    // `anchors[0]`/`position` stays (uMax, mid) — back-compatible with the single-bar callers.
    const n = Math.max(
      1,
      Math.round(params["count_per_side"] ?? defaultParam(supplement.params, "count_per_side", 1)),
    );
    const anchors: { u: number; v: number; angleDeg: number }[] = [];
    for (const u of [uMax, -uMax]) {
      for (let k = 1; k <= n; k++) anchors.push({ u, v: -vMax + (k / (n + 1)) * (2 * vMax), angleDeg: 0 });
    }
    const first = anchors[0]!;
    return { ...base, params, position: { u: first.u, v: first.v }, angleDeg: 0, anchors, status: "PASS" };
  }

  // generic / explicit-param placements
  return { ...base, params, status: "PASS" };
}

// ---------------------------------------------------------------------------
// 5.7 — curtailment & shift rule (spec §7.7) — feeds chapeau/curtailed bar cutLength
// ---------------------------------------------------------------------------
export interface CurtailmentResult {
  /** shift a_l ≈ z·cotθ/2, default ≈ d for members with shear links (§7.7). */
  shift: number;
  /** design anchorage l_bd from the active pack (mm). */
  lbd: number;
  /** chapeau extension into the span = supportZone + a_l + l_bd (mm). */
  extension: number;
}

/**
 * Compute the curtailment extension for a `CHAPEAU` / curtailed bar (§7.7). The chapeau
 * extends `l_support_zone + a_l + l_bd` past its theoretical cut-off; this code-derived length
 * flows into the bar's `cutLength` and the BBS, so support bar lengths are correct on site.
 */
export function computeCurtailment(
  code: { lbd(args: AnchorageArgs): number },
  args: {
    diameter: number;
    material: MaterialContext;
    supportZone: number;
    /** effective depth (mm) — the default shift a_l ≈ d. */
    d: number;
    asReqOverProv?: number;
    goodBond?: boolean;
  },
): CurtailmentResult {
  const lbd = code.lbd({
    diameter: args.diameter,
    material: args.material,
    ...(args.goodBond !== undefined ? { goodBond: args.goodBond } : {}),
    ...(args.asReqOverProv !== undefined ? { asReqOverProv: args.asReqOverProv } : {}),
  });
  const shift = args.d; // a_l ≈ d (default for members with shear links, §7.7)
  return { shift, lbd, extension: args.supportZone + shift + lbd };
}
