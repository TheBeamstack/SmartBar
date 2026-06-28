/**
 * UI-edge derivations (spec §2.3 "SI internally, convert at the edge"). The engine stores
 * mm / mm²; these helpers convert to the French display units (geometry mm, steel area cm²)
 * and pull the live badge values out of the SolveResult. Pure — no React.
 *
 * Generic over the element: the "primary" flexural zone is the column's As_total or the beam's
 * As_span_bottom; its provided-area rule and computed `d` drive the badges.
 */
import { barArea, type SolveResult } from "@rebarconfig/core";
import { type ElementDoc, isColumnDoc, isGenericDoc } from "../engine/document";
import { t, type Lang } from "../i18n/strings";

export const MM2_TO_CM2 = 0.01;

/** The primary flexural zone's provided_area rule id + the doc's required steel + its φ. */
function primaryZone(doc: ElementDoc): { rule: string; asReq: number; diameter: number; groupId: string } {
  if (isColumnDoc(doc)) {
    return {
      rule: "provided_area",
      asReq: doc.longitudinal.asReq,
      diameter: doc.longitudinal.diameter,
      groupId: doc.longitudinal.groupId,
    };
  }
  if (isGenericDoc(doc)) {
    const z =
      doc.zones.find((x) => x.primary) ??
      doc.zones.find((x) => x.slabRole === "MAIN") ??
      doc.zones.find((x) => x.kind === "longitudinal") ??
      doc.zones[0]!;
    return {
      rule: `provided_area:${z.zone}`,
      asReq: z.asReq ?? z.asReqPerM ?? 0,
      diameter: z.diameter,
      groupId: z.groupId,
    };
  }
  return {
    rule: "provided_area:As_span_bottom",
    asReq: doc.span.asReq,
    diameter: doc.span.diameter,
    groupId: doc.span.groupId,
  };
}

/** As,provided (mm²) of the primary flexural zone — from its provided_area rule, with fallback. */
export function asProvidedMm2(result: SolveResult, doc: ElementDoc): number {
  const pz = primaryZone(doc);
  const rule = result.validation.find((v) => v.rule === pz.rule);
  if (rule && typeof rule.value === "number") return rule.value;
  const grp = result.groups.find((g) => g.groupId === pz.groupId);
  return grp ? grp.count * barArea(pz.diameter) : 0;
}

export function asReqMm2(doc: ElementDoc): number {
  return primaryZone(doc).asReq;
}

/** Effective depth d (mm) of the primary flexural zone ([REF-SYS-611]). */
export function effectiveDepthMm(result: SolveResult): number | null {
  const z = result.zones[0];
  return z ? z.d : null;
}

export function cm2(mm2: number): string {
  return (mm2 * MM2_TO_CM2).toFixed(2);
}

/** Does As,prov meet As,req? (badge tone). */
export function meetsAsReq(result: SolveResult, doc: ElementDoc): boolean {
  return asProvidedMm2(result, doc) >= asReqMm2(doc) - 1e-6;
}

// ---------------------------------------------------------------------------
// F3 — per-zone verification readout ([REF-UI-820]). A pure selector that
// projects every flexural zone of the solved element to one display row, so the
// sticky readout never shows just the aggregate. The per-zone provided area +
// `ZoneGeometry.d` already exist on SolveResult; this only reshapes them.
// ---------------------------------------------------------------------------

/** One reinforcement zone projected for the sticky readout (one row each). */
export interface ZoneReadoutRow {
  /** stable zone key (e.g. "As_total", "As_span_bottom", a slab zone id). */
  zone: string;
  /** localized zone label. */
  label: string;
  asProvMm2: number;
  asReqMm2: number;
  /** As,prov ≥ As,req for this zone. */
  ok: boolean;
  /** computed effective depth (mm), or null if not available. */
  d: number | null;
  /** slab/per-metre zone → values are mm²/m (display "cm²/m"); else mm² (total). */
  perMetre: boolean;
}

const PROVIDED_AREA = "provided_area";

/** Localized label for a zone key (generic zones carry their own labels in the doc). */
function zoneLabel(doc: ElementDoc, zoneKey: string, lang: Lang): string {
  if (isGenericDoc(doc)) {
    const z = doc.zones.find((x) => x.zone === zoneKey);
    if (z) return lang === "fr" ? z.label_fr : z.label_en;
  }
  const zones = t(lang).readout.zones as Record<string, string>;
  return zones[zoneKey] ?? zoneKey;
}

/** Slab (spacing-controlled) generic zones report per-metre steel; rect zones report totals. */
function zonePerMetre(doc: ElementDoc, zoneKey: string): boolean {
  if (isGenericDoc(doc)) {
    return doc.zones.find((x) => x.zone === zoneKey)?.control === "spacing";
  }
  return false;
}

/**
 * One row per flexural zone (As,prov vs As,req + ok + d), driven off the validation
 * `provided_area[:zone]` items and `result.zones`. Generic over all 8 elements; the column's
 * single un-suffixed `provided_area` rule maps onto its lone zone.
 */
export function perZoneReadout(result: SolveResult, doc: ElementDoc, lang: Lang): ZoneReadoutRow[] {
  const byZone = new Map<string, { asProv: number; asReq: number; ok: boolean }>();
  for (const v of result.validation) {
    let key: string | null = null;
    if (v.rule === PROVIDED_AREA) key = result.zones[0]?.zone ?? "";
    else if (v.rule.startsWith(`${PROVIDED_AREA}:`)) key = v.rule.slice(PROVIDED_AREA.length + 1);
    if (key === null) continue;
    byZone.set(key, {
      asProv: typeof v.value === "number" ? v.value : 0,
      asReq: typeof v.limit === "number" ? v.limit : 0,
      ok: v.status === "PASS",
    });
  }

  return result.zones.map((z) => {
    const pa = byZone.get(z.zone);
    return {
      zone: z.zone,
      label: zoneLabel(doc, z.zone, lang),
      asProvMm2: pa?.asProv ?? 0,
      asReqMm2: pa?.asReq ?? 0,
      ok: pa?.ok ?? true,
      d: Number.isFinite(z.d) ? z.d : null,
      perMetre: zonePerMetre(doc, z.zone),
    };
  });
}
