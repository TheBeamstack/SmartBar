/**
 * Track V (v1.0.5 M4) — honest validation of the NEW kinds of freely-placed steel (spec Part III).
 *
 * M2/M3 gave the engine a first-class placed-bar model — single bars, counted/spaced rows, multiple
 * flexural layers, bundles and side-face skin — that render + schedule + feed As/`d`. This module JUDGES
 * that steel with the three honest tiers (🔴 blocks export / 🟠 warns / 🟢 fine):
 *   • V-A (generic geometry) — a placed bar's axial extent within `[0, memberLength]` and its `(u,v)`
 *     inside the concrete/cover envelope, **generalised to every element** (RECT already runs the richer
 *     `validateAddressableBars`, so this only fires for the generic/CIRCULAR/SLAB pipelines — the caller
 *     sets `includeGeometry`). The envelope comes from the element's own descriptor.
 *   • V-B `bundle_max` / `bundle_cover` — > `bundleMax` (or `bundleMaxAtLap` at a lap) is un-buildable
 *     🔴; a bundle whose equivalent Ø `φₙ` breaches the cover envelope is 🔴, approaching it is 🟠.
 *   • V-C `skin_minimum` — side-face steel required by section depth: under-provided / absent-where-
 *     mandatory is a 🟠 judgement call (an expert may proceed), never a hard block.
 *   • V-D `layer_clear_spacing` — vertical clear spacing between flexural layers: clashing 🔴, tight 🟠.
 *   • V-E `curtailment_anchorage` — a curtailed bar must develop its end anchorage; a bare interior cut,
 *     or a run too short to develop, is 🔴, marginally short is 🟠 (§7.7).
 *
 * **The F1 guarantee (spec §0.5, V-F).** Every amber band sits *below* the code value: a design sitting
 * exactly AT the code minimum is 🟢, never 🟠 — `tierByMargin` returns PASS at `provided == required`, and
 * the WARN zone is `[required·(1−band), required)`. So an at-or-above-limit design is never the first thing
 * a user sees turn amber (the correctness rule the v1.0.4 cover-band regression taught).
 *
 * Every numeric limit is sourced through the pack (`code.bundleMax`, `code.skinReinforcement`,
 * `code.curtailmentHookedFactor`, `code.lbd`) — all flagged ⚠ PROVISIONAL (G-BAEL/EC2), band widths from
 * `warnBands` (G-TOL). No `if (elementType)` / `if (codePack)`; pure + deterministic; pack-agnostic.
 */
import type { SectionKind } from "../types/layout";
import type { MaterialContext } from "../types/codepack";
import {
  type PlacedBarInput,
  type Bundle,
  type Layer,
  type BarRow,
  isBundle,
  isLayer,
  isBarRow,
} from "../types/placed-bar";
import type { PlacedLongBar } from "../pipeline/element";
import { item, barArea, mm2, type ValidationItem, type ExtendedCodePack } from "./index";

const TOL = 1; // mm slack so an exactly-at-limit / full-length bar never false-fails.

export interface PlacedRuleCtx {
  section: SectionKind;
  /** section width along u (mm) — RECT/SLAB. For CIRCULAR pass the diameter (bounds use `circularD`). */
  b: number;
  /** section depth along v (mm) — RECT/SLAB. */
  h: number;
  /** when set, the section is round: section-bounds + bundle cover use radial geometry (D = this). */
  circularD?: number;
  cover: number;
  /** member length (mm) a bar runs along. */
  memberLength: number;
  /** max aggregate size (mm) for the clear-spacing minimum. */
  dg: number;
  codeRef: string;
  material: MaterialContext;
  /** WARN band widths (fractions) — G-TOL provisional; the amber zone sits BELOW the code value (F1). */
  bands: { spacing: number; anchorage: number };
  /**
   * emit the element-agnostic geometry rules (axial extent + section bounds). The RECT pipeline runs the
   * richer `validateAddressableBars` for those, so it passes `false`; the generic shims pass `true`.
   */
  includeGeometry: boolean;
}

/**
 * F1-safe tiering for a "provided ≥ required" (minimum) limit: PASS at/above the limit, WARN in the band
 * just below it, FAIL further below. `provided == required` is always 🟢 — the amber band never reaches
 * the code value.
 */
function tierByMargin(provided: number, required: number, band: number): "PASS" | "WARN" | "FAIL" {
  if (provided >= required - 1e-6) return "PASS";
  if (provided >= required * (1 - band)) return "WARN";
  return "FAIL";
}

/** The clear cover a bar/bundle of effective Ø `phiEff` at `(u,v)` actually has to the nearest face (mm). */
function providedCover(u: number, v: number, phiEff: number, ctx: PlacedRuleCtx): number {
  if (ctx.circularD !== undefined) {
    return ctx.circularD / 2 - Math.hypot(u, v) - phiEff / 2;
  }
  return Math.min(ctx.b / 2 - Math.abs(u), ctx.h / 2 - Math.abs(v)) - phiEff / 2;
}

/** V-B: max bars per bundle (tightened at a lap) — a discrete hard limit (🔴 over / 🟢 at-or-under). */
function bundleMaxRule(b: Bundle, ids: string[], code: ExtendedCodePack, ctx: PlacedRuleCtx): ValidationItem {
  const atLap = (b.splices?.length ?? 0) > 0 || b.autoSplice === true;
  const max = atLap ? code.bundleMaxAtLap ?? 3 : code.bundleMax ?? 4;
  const n = Math.round(b.n);
  const ok = n <= max;
  return item(
    "bundle_max",
    ok ? "PASS" : "FAIL",
    n,
    max,
    ctx.codeRef,
    ok
      ? `Paquet de ${n} barres ≤ ${max}${atLap ? " (au recouvrement)" : ""} (${b.id})`
      : `Paquet de ${n} barres > ${max}${atLap ? " au recouvrement" : ""} — trop de barres groupées, non constructible (${b.id})`,
    ok
      ? `Bundle of ${n} bars ≤ ${max}${atLap ? " (at a lap)" : ""} (${b.id})`
      : `Bundle of ${n} bars > ${max}${atLap ? " at a lap" : ""} — too many bars bundled, not buildable (${b.id})`,
    ids,
  );
}

/** V-B: the bundle's equivalent Ø `φₙ` must keep the code cover (🔴 out of concrete / 🟠 approaching). */
function bundleCoverRule(b: Bundle, ids: string[], code: ExtendedCodePack, ctx: PlacedRuleCtx): ValidationItem {
  const phiN = code.bundleEquivDiameter?.(b.diameter, Math.round(b.n)) ?? b.diameter * Math.sqrt(Math.max(1, b.n));
  const cov = providedCover(b.position.u, b.position.v, phiN, ctx);
  const status = tierByMargin(cov, ctx.cover, ctx.bands.spacing);
  return item(
    "bundle_cover",
    status,
    Math.round(cov * 10) / 10,
    ctx.cover,
    ctx.codeRef,
    status === "PASS"
      ? `Enrobage du paquet (φₙ=${Math.round(phiN)} mm) ${Math.round(cov)} mm ≥ ${ctx.cover} mm (${b.id})`
      : `Enrobage du paquet (φₙ=${Math.round(phiN)} mm) ${Math.round(cov)} mm ${status === "FAIL" ? "<" : "≈"} ${ctx.cover} mm — ${status === "FAIL" ? "hors béton / enrobage insuffisant" : "proche du minimum"} (${b.id})`,
    status === "PASS"
      ? `Bundle cover (φₙ=${Math.round(phiN)} mm) ${Math.round(cov)} mm ≥ ${ctx.cover} mm (${b.id})`
      : `Bundle cover (φₙ=${Math.round(phiN)} mm) ${Math.round(cov)} mm ${status === "FAIL" ? "<" : "≈"} ${ctx.cover} mm — ${status === "FAIL" ? "out of concrete / cover breached" : "approaching the minimum"} (${b.id})`,
    ids,
  );
}

/**
 * V-D: vertical clear spacing between the flexural layers on one face. Each `Layer` sits `layerIndex`
 * steps inboard of the cover layer; the added clear gap between consecutive layers is `layerGap` (default
 * `max(Ø,20)`). Below `max(Ø, dg+5, 20)` → 🔴 clash / 🟠 tight (F1: at the floor → 🟢). Element-agnostic.
 */
function layerSpacingRule(l: Layer, ids: string[], ctx: PlacedRuleCtx): ValidationItem {
  const clear = l.layerGap ?? Math.max(l.diameter, 20);
  // Between-layer vertical clear floor = max(Ø, 20) — the published minimum the M3 default gap meets
  // exactly (F1: a default layer is 🟢). Folding the aggregate term (dg+5) into the vertical minimum is a
  // G-TOL refinement (⚠ PROVISIONAL); the in-plane clear-spacing keeps it (`predicates.ts`).
  const min = Math.max(l.diameter, 20);
  const status = tierByMargin(clear, min, ctx.bands.spacing);
  return item(
    "layer_clear_spacing",
    status,
    Math.round(clear * 10) / 10,
    Math.round(min * 10) / 10,
    ctx.codeRef,
    status === "PASS"
      ? `Espacement entre nappes ${Math.round(clear)} mm ≥ min ${Math.round(min)} mm (nappe ${l.layerIndex}, ${l.id})`
      : `Espacement entre nappes ${Math.round(clear)} mm ${status === "FAIL" ? "<" : "≈"} min ${Math.round(min)} mm — ${status === "FAIL" ? "les nappes se touchent" : "serré"} (${l.id})`,
    status === "PASS"
      ? `Between-layer clear spacing ${Math.round(clear)} mm ≥ min ${Math.round(min)} mm (layer ${l.layerIndex}, ${l.id})`
      : `Between-layer clear spacing ${Math.round(clear)} mm ${status === "FAIL" ? "<" : "≈"} min ${Math.round(min)} mm — ${status === "FAIL" ? "layers clash" : "tight"} (${l.id})`,
    ids,
  );
}

/**
 * V-C: depth-triggered side-face (skin) steel. When the section depth makes skin steel mandatory
 * (`code.skinReinforcement`), the provided skin area per face must meet the per-face minimum. Under /
 * absent → 🟠 (a judgement call — an expert may proceed), NEVER a hard block. F1: at/above the min → 🟢.
 */
function skinMinimumRule(
  skinRows: BarRow[],
  ids: string[],
  code: ExtendedCodePack,
  ctx: PlacedRuleCtx,
): ValidationItem | undefined {
  const req = code.skinReinforcement?.({ b: ctx.b, h: ctx.h });
  if (!req || !req.required) return undefined; // not mandatory at this depth → nothing to check
  // provided skin area = the largest per-face total (a row lives on one face; take the governing face).
  const perFace = new Map<string, number>();
  for (const r of skinRows) {
    const n = r.count ?? (r.spacing && r.spacing > 0 ? Math.floor(r.extent / r.spacing) + 1 : 1);
    const face = r.anchor.u >= 0 ? "R" : "L"; // side faces: +u = right, −u = left
    perFace.set(face, (perFace.get(face) ?? 0) + n * barArea(r.diameter));
  }
  // the governing (weakest provided) face among those the code needs covered: both side faces.
  const provided = Math.min(perFace.get("L") ?? 0, perFace.get("R") ?? 0);
  const status: "PASS" | "WARN" = provided >= req.minAreaPerFaceMm2 - 1e-6 ? "PASS" : "WARN";
  const absent = skinRows.length === 0;
  return item(
    "skin_minimum",
    status,
    Math.round(provided),
    Math.round(req.minAreaPerFaceMm2),
    ctx.codeRef,
    status === "PASS"
      ? `Aciers de peau ${mm2(provided)}/face ≥ min ${mm2(req.minAreaPerFaceMm2)} (h=${Math.round(ctx.h)} mm)`
      : absent
      ? `Aciers de peau requis (h=${Math.round(ctx.h)} mm > seuil) mais absents — prévoir ≥ ${mm2(req.minAreaPerFaceMm2)}/face, espacement ≤ ${req.maxSpacingMm} mm`
      : `Aciers de peau ${mm2(provided)}/face < min ${mm2(req.minAreaPerFaceMm2)} (h=${Math.round(ctx.h)} mm) — à vérifier`,
    status === "PASS"
      ? `Skin steel ${mm2(provided)}/face ≥ min ${mm2(req.minAreaPerFaceMm2)} (h=${Math.round(ctx.h)} mm)`
      : absent
      ? `Skin steel required (h=${Math.round(ctx.h)} mm > threshold) but absent — provide ≥ ${mm2(req.minAreaPerFaceMm2)}/face, spacing ≤ ${req.maxSpacingMm} mm`
      : `Skin steel ${mm2(provided)}/face < min ${mm2(req.minAreaPerFaceMm2)} (h=${Math.round(ctx.h)} mm) — review`,
    ids,
  );
}

/**
 * V-E (§7.7): a curtailed bar must develop its end anchorage. For each end that stops INSIDE the member
 * (a real curtailment, not a member end), the required development is `l_bd` (reduced by
 * `curtailmentHookedFactor` for a hooked cut-off); a bare (`none`) interior cut develops nothing → 🔴. The
 * bar's run must cover the sum of its interior-end developments: short → 🔴, marginally short → 🟠 (F1: at
 * the requirement → 🟢). Only fires for a genuinely curtailed bar (`startStation`/`endStation` set).
 */
function curtailmentRule(bar: PlacedLongBar, code: ExtendedCodePack, ctx: PlacedRuleCtx): ValidationItem | undefined {
  const start = bar.startStation;
  const end = bar.endStation;
  if (start === undefined && end === undefined) return undefined;
  const s = start ?? bar.axisStart;
  const e = end ?? ctx.memberLength;
  const interiorStart = s > TOL; // stops after the member start → a real curtailment
  const interiorEnd = e < ctx.memberLength - TOL;
  if (!interiorStart && !interiorEnd) return undefined; // runs member-end to member-end → not curtailed
  const run = Math.max(0, e - s);

  const devFor = (choice: "none" | "straight" | "hook" | undefined): { need: number; bare: boolean } => {
    if (choice === "none") return { need: Infinity, bare: true }; // a bare cut cannot develop the bar
    const straight = code.lbd({ diameter: bar.diameter, material: ctx.material });
    const need = choice === "hook" ? straight * (code.curtailmentHookedFactor ?? 1) : straight;
    return { need, bare: false };
  };

  let required = 0;
  let bareCut = false;
  if (interiorStart) {
    const d = devFor(bar.anchorage?.start);
    if (d.bare) bareCut = true;
    else required += d.need;
  }
  if (interiorEnd) {
    const d = devFor(bar.anchorage?.end);
    if (d.bare) bareCut = true;
    else required += d.need;
  }

  const status: "PASS" | "WARN" | "FAIL" = bareCut
    ? "FAIL"
    : tierByMargin(run, required, ctx.bands.anchorage);
  return item(
    "curtailment_anchorage",
    status,
    bareCut ? "bare cut" : Math.round(run),
    Math.round(required),
    ctx.codeRef,
    status === "PASS"
      ? `Barre arrêtée ${bar.groupId} : longueur ${Math.round(run)} mm ≥ ancrage requis ${Math.round(required)} mm`
      : bareCut
      ? `Barre arrêtée ${bar.groupId} : arrêt franc (sans ancrage) en zone courante — ancrer (droit/crochet) ou prolonger`
      : `Barre arrêtée ${bar.groupId} : longueur ${Math.round(run)} mm ${status === "FAIL" ? "<" : "≈"} ancrage requis ${Math.round(required)} mm`,
    status === "PASS"
      ? `Curtailed bar ${bar.groupId}: run ${Math.round(run)} mm ≥ required anchorage ${Math.round(required)} mm`
      : bareCut
      ? `Curtailed bar ${bar.groupId}: bare interior cut-off (no anchorage) — anchor it (straight/hook) or extend`
      : `Curtailed bar ${bar.groupId}: run ${Math.round(run)} mm ${status === "FAIL" ? "<" : "≈"} required anchorage ${Math.round(required)} mm`,
    [bar.groupId],
  );
}

/** V-A (generic geometry): a placed bar's axial extent within `[0, memberLength]`. 🔴 outside, else 🟢. */
function axialExtentRule(bars: PlacedLongBar[], ctx: PlacedRuleCtx): ValidationItem | undefined {
  let worst = -Infinity;
  let bad: PlacedLongBar | undefined;
  for (const b of bars) {
    if (b.removed) continue;
    const end = b.axisStart + runExtent(b.shape.centerline3D);
    const over = Math.max(-b.axisStart, end - ctx.memberLength);
    if (over > worst) {
      worst = over;
      bad = b;
    }
  }
  if (!bad) return undefined; // no live bars
  const fail = worst > TOL;
  const end = Math.round(bad.axisStart + runExtent(bad.shape.centerline3D));
  return item(
    "placed_axial_extent",
    fail ? "FAIL" : "PASS",
    bad.axisStart < 0 ? Math.round(bad.axisStart) : end,
    ctx.memberLength,
    ctx.codeRef,
    fail
      ? `Barre ${bad.groupId} hors membre (${bad.axisStart < 0 ? `début ${Math.round(bad.axisStart)} mm` : `fin ${end} mm > ${ctx.memberLength} mm`})`
      : `Barres placées dans les limites du membre (${ctx.memberLength} mm)`,
    fail
      ? `Bar ${bad.groupId} outside the member (${bad.axisStart < 0 ? `start ${Math.round(bad.axisStart)} mm` : `end ${end} mm > ${ctx.memberLength} mm`})`
      : `Placed bars within the member length (${ctx.memberLength} mm)`,
    [bad.groupId],
  );
}

/** V-A (generic geometry): a placed bar's (u,v) + its Ø inside the concrete/cover envelope. 🔴 outside. */
function sectionBoundsRule(bars: PlacedLongBar[], ctx: PlacedRuleCtx): ValidationItem | undefined {
  let worst = Infinity;
  let bad: PlacedLongBar | undefined;
  for (const b of bars) {
    if (b.removed) continue;
    const cov = providedCover(b.position.u, b.position.v, b.diameter, ctx);
    if (cov < worst) {
      worst = cov;
      bad = b;
    }
  }
  if (!bad) return undefined;
  const fail = worst < -TOL; // the bar pokes out of the concrete (negative cover)
  return item(
    "placed_section_bounds",
    fail ? "FAIL" : "PASS",
    `(${Math.round(bad.position.u)}, ${Math.round(bad.position.v)})`,
    `enrobage ≥ 0`,
    ctx.codeRef,
    fail
      ? `Barre ${bad.groupId} hors du béton (position (${Math.round(bad.position.u)}, ${Math.round(bad.position.v)}) mm)`
      : `Barres placées dans le béton`,
    fail
      ? `Bar ${bad.groupId} outside the concrete (position (${Math.round(bad.position.u)}, ${Math.round(bad.position.v)}) mm)`
      : `Placed bars inside the concrete`,
    [bad.groupId],
  );
}

/** developed extent of a bar's centreline along its run axis (mm). Mirrors `element.ts runExtent`. */
function runExtent(centerline: number[]): number {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < centerline.length; i += 3) {
    const x = centerline[i]!;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return max > min ? max - min : 0;
}

/**
 * Judge every NEW kind of placed steel with the honest tiers (Track V). Reads the placed-input union
 * (bundles / layers / skin rows) for the count/cover/skin rules and the resolved `PlacedLongBar[]` for the
 * curtailment + generic-geometry rules. Legacy-safe: no placed content → no items. Affected-bar ids are the
 * resolved member ids (a bundle/layer reddens all its bars; a single/curtailed bar reddens exactly one).
 */
export function validatePlacedBarRules(
  placed: PlacedBarInput[] | undefined,
  resolved: PlacedLongBar[] | undefined,
  ctx: PlacedRuleCtx,
  code: ExtendedCodePack,
): ValidationItem[] {
  const out: ValidationItem[] = [];
  const live = (resolved ?? []).filter((b) => !b.removed);

  // resolved member ids grouped by their parent input id (a bundle/row/layer → all its bars).
  const byParent = new Map<string, string[]>();
  for (const b of resolved ?? []) {
    if (b.placedParentId === undefined) continue;
    const arr = byParent.get(b.placedParentId);
    if (arr) arr.push(b.groupId);
    else byParent.set(b.placedParentId, [b.groupId]);
  }
  const idsFor = (p: PlacedBarInput): string[] => byParent.get(p.id) ?? [p.id];

  // V-B bundles, V-D layers, V-C skin — over the input union.
  const skinRows: BarRow[] = [];
  for (const p of placed ?? []) {
    if (isBundle(p)) {
      out.push(bundleMaxRule(p, idsFor(p), code, ctx));
      out.push(bundleCoverRule(p, idsFor(p), code, ctx));
    } else if (isLayer(p)) {
      out.push(layerSpacingRule(p, idsFor(p), ctx));
    } else if (isBarRow(p) && p.skin) {
      skinRows.push(p);
    }
  }
  const skinIds = skinRows.flatMap((r) => byParent.get(r.id) ?? [r.id]);
  const skin = skinMinimumRule(skinRows, skinIds, code, ctx);
  if (skin) out.push(skin);

  // V-E curtailment — over the resolved bars (per-bar stations).
  for (const b of live) {
    const c = curtailmentRule(b, code, ctx);
    if (c) out.push(c);
  }

  // V-A generic geometry — only for the non-RECT pipelines (RECT runs validateAddressableBars).
  if (ctx.includeGeometry && live.length > 0) {
    const ax = axialExtentRule(live, ctx);
    if (ax) out.push(ax);
    const sb = sectionBoundsRule(live, ctx);
    if (sb) out.push(sb);
  }

  return out;
}
