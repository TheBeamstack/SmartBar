/**
 * Seismic overlay validation (spec §7.10 [REF-MATH-710]).
 *
 * `applySeismicOverlay` composes the RPS overlay's effects onto an already-solved member, ON TOP
 * of whichever concrete pack ran the base validation. It is the realisation of the four overlay
 * mechanisms (§7.10):
 *   1. inject `END_*` (l_c) + `MIDDLE` segments into the transverse distribution, validate each
 *      segment's spacing per-segment (mid-span PASS while a critical zone FAILs);
 *   2. tighten the critical-zone tie ø;
 *   3. force 135°/≥10φ hooks (90° → FAIL in a seismic member);
 *   4. promote confinement add-ons to required (absent → FAIL, blocks export, §0.1).
 * Plus the §7.13 seismic topological predicates: `lap_in_critical_zone`, `crosstie_engagement`.
 *
 * Engine-side it is overlay-AGNOSTIC: everything comes through the `SeismicOverlay` interface, so
 * a future seismic code (EC8, ASCE 7) swaps the implementation only. Pure + deterministic.
 */
import type { SeismicOverlay, CritZoneSegment, LapExtent } from "../types/seismic";
import type { TransverseRegion } from "../types/layout";
import { item, type ValidationItem } from "./index";
import { lapInCriticalZone, crosstieEngagement } from "./predicates";

/** A resolved transverse (tie/stirrup/spiral) set as fed to the overlay. */
export interface SeismicTransverse {
  groupId: string;
  zone: string;
  diameter: number;
  /** the user's (mid-span) tie spacing (mm) — becomes the MIDDLE segment value. */
  spacing: number;
  /** hook angle on the tie/cross-tie (90 → FAIL in a seismic member). */
  hookAngle: number;
  /** hook extension as a multiple of φ (must reach the overlay's extFactor, ≥10φ). */
  hookExtFactor: number;
  /** optional F5 spacing regions — reconciled against the critical-zone spacing (WARN-only). */
  regions?: TransverseRegion[];
}

export interface SeismicMember {
  kind: "COLUMN" | "BEAM";
  /** clear member length (mm). */
  length: number;
  /** smallest cross-section side (mm). */
  bMin: number;
  /** largest cross-section dimension (mm). */
  hSectionMax: number;
}

export interface SeismicOverlayContext {
  overlay: SeismicOverlay;
  member: SeismicMember;
  /** governing longitudinal ø (mm) for l_c and the critical-zone spacing limit. */
  phiL: number;
  transverse: SeismicTransverse[];
  /** confinement add-on supplement ids present in the resolved arrangement. */
  confinementPresent: string[];
  /** total longitudinal bars / number laterally engaged by a tie corner or cross-tie. */
  longBarsTotal: number;
  longBarsEngaged: number;
  /** lap / splice extents along the member axis (for lap_in_critical_zone). */
  laps?: LapExtent[];
}

export interface SeismicOverlayResult {
  items: ValidationItem[];
  /** plastic-hinge length used (mm). */
  l_c: number;
  /** the injected segment list for the (first) transverse set — preview + per-segment marks. */
  segments: CritZoneSegment[];
}

/** Apply the seismic overlay to a solved member; returns extra validation items + the geometry. */
export function applySeismicOverlay(ctx: SeismicOverlayContext): SeismicOverlayResult {
  const { overlay, member, phiL } = ctx;
  const ref = overlay.codeRef;
  const nd = overlay.regime.ductility;
  const out: ValidationItem[] = [];

  const l_c = overlay.criticalZoneLength({
    member: member.kind,
    hSectionMax: member.hSectionMax,
    clearLength: member.length,
  });
  const sCrit = overlay.critSpacingMax({ phiL, bMin: member.bMin });
  const minTieØ = overlay.critTieDiameterMin();
  const hook = overlay.hookRule();

  let firstSegments: CritZoneSegment[] = [];

  for (const tz of ctx.transverse) {
    const segments = overlay.injectCriticalSegments({
      member: member.kind,
      memberLength: member.length,
      l_c,
      userSpacing: tz.spacing,
    });
    if (firstSegments.length === 0) firstSegments = segments;

    // (1) per-segment spacing: critical segments vs s_crit; the MIDDLE segment is the user spacing
    // (validated against the base pack by the profile — here we only confirm it isn't critical).
    for (const seg of segments) {
      if (!seg.critical) continue;
      const ok = seg.spacing <= sCrit;
      out.push(
        item(
          `crit_zone_spacing:${tz.zone}:${seg.region}`,
          ok ? "PASS" : "FAIL",
          Math.round(seg.spacing),
          Math.round(sCrit),
          ref,
          ok
            ? `Espacement zone critique ${Math.round(seg.spacing)} mm ≤ ${Math.round(sCrit)} mm (${seg.region}, ${nd})`
            : `Espacement zone critique ${Math.round(seg.spacing)} mm > max ${Math.round(sCrit)} mm (${seg.region}, ${nd}) — densifier`,
          ok
            ? `Critical-zone spacing ${Math.round(seg.spacing)} mm ≤ ${Math.round(sCrit)} mm (${seg.region}, ${nd})`
            : `Critical-zone spacing ${Math.round(seg.spacing)} mm > max ${Math.round(sCrit)} mm (${seg.region}, ${nd}) — densify ties`,
          [tz.groupId],
        ),
      );
    }

    // (1b) F5 reconciliation: user regions are the base — the critical-zone spacing TIGHTENS within
    // the end regions rather than silently replacing the list. A user region that overlaps an end
    // critical zone but is LOOSER than s_crit is surfaced as a WARN (never a silent override; rides
    // provisional G-RPS — indicate, don't block, owner decision D-V102/F2). No regions → no item
    // (goldens byte-identical).
    if (tz.regions && tz.regions.length > 0) {
      const Lm = member.length;
      const lcEnd = Math.min(l_c, Lm / 2);
      const inEndZone = (r: TransverseRegion) =>
        Math.max(r.from, 0) < lcEnd - 1e-6 || Math.min(r.to, Lm) > Lm - lcEnd + 1e-6;
      const offenders = tz.regions.filter((r) => inEndZone(r) && r.spacing > sCrit + 1e-6);
      const worst = offenders.reduce((m, r) => Math.max(m, r.spacing), 0);
      const ok = offenders.length === 0;
      out.push(
        item(
          `region_crit_spacing:${tz.zone}`,
          ok ? "PASS" : "WARN",
          ok ? Math.round(sCrit) : Math.round(worst),
          Math.round(sCrit),
          ref,
          ok
            ? `Régions en zone critique conformes (≤ ${Math.round(sCrit)} mm, ${nd})`
            : `Région en zone critique ${Math.round(worst)} mm > max ${Math.round(sCrit)} mm (${nd}) — densifier l'extrémité`,
          ok
            ? `End-zone regions within the critical-zone spacing (≤ ${Math.round(sCrit)} mm, ${nd})`
            : `End-zone region ${Math.round(worst)} mm > critical-zone max ${Math.round(sCrit)} mm (${nd}) — densify the end`,
          [tz.groupId],
        ),
      );
    }

    // (2) critical-zone tie ø
    out.push(
      item(
        `crit_zone_tie_diameter:${tz.zone}`,
        tz.diameter >= minTieØ ? "PASS" : "FAIL",
        tz.diameter,
        minTieØ,
        ref,
        tz.diameter >= minTieØ
          ? `Ø cadre ${tz.diameter} mm ≥ min zone critique ${minTieØ} mm (${nd})`
          : `Ø cadre ${tz.diameter} mm < min zone critique ${minTieØ} mm (${nd})`,
        tz.diameter >= minTieØ
          ? `Tie ø ${tz.diameter} mm ≥ critical-zone min ${minTieØ} mm (${nd})`
          : `Tie ø ${tz.diameter} mm < critical-zone min ${minTieØ} mm (${nd})`,
        [tz.groupId],
      ),
    );

    // (3) 135°/≥10φ hook geometry — 90° FAILs in a seismic member (§7.10c)
    const angleOk = tz.hookAngle === hook.angle;
    const extOk = tz.hookExtFactor >= hook.extFactor;
    const hookOk = angleOk && extOk;
    out.push(
      item(
        `seismic_hook:${tz.zone}`,
        hookOk ? "PASS" : "FAIL",
        `${tz.hookAngle}° / ${tz.hookExtFactor}φ`,
        `${hook.angle}° / ${hook.extFactor}φ`,
        ref,
        hookOk
          ? `Crochets sismiques ${tz.hookAngle}°, ext ${tz.hookExtFactor}φ (conforme)`
          : !angleOk
          ? `Crochet ${tz.hookAngle}° interdit en zone sismique — exiger 135°`
          : `Extension crochet ${tz.hookExtFactor}φ < ${hook.extFactor}φ requis`,
        hookOk
          ? `Seismic hooks ${tz.hookAngle}°, ext ${tz.hookExtFactor}φ (compliant)`
          : !angleOk
          ? `${tz.hookAngle}° hook not allowed in a seismic member — require 135°`
          : `Hook extension ${tz.hookExtFactor}φ < required ${hook.extFactor}φ`,
        [tz.groupId],
      ),
    );
  }

  // (4) required confinement add-ons present → else FAIL (validity layer blocks export, §0.1)
  const required = overlay.requiredConfinement();
  const present = new Set(ctx.confinementPresent);
  const missing = required.filter((id) => !present.has(id));
  out.push(
    item(
      "confinement_required",
      missing.length === 0 ? "PASS" : "FAIL",
      ctx.confinementPresent.length > 0 ? ctx.confinementPresent.join(", ") : "none",
      required.length > 0 ? required.join(", ") : "none",
      ref,
      missing.length === 0
        ? `Armatures de confinement requises présentes (${nd})`
        : `Armatures de confinement requises absentes: ${missing.join(", ")} (${nd}) — export bloqué`,
      missing.length === 0
        ? `Required confinement add-ons present (${nd})`
        : `Required confinement add-ons missing: ${missing.join(", ")} (${nd}) — export blocked`,
      ctx.transverse.map((t) => t.groupId),
    ),
  );

  // §7.13 seismic topological predicates ------------------------------------------------------
  // lap_in_critical_zone: any lap extent ∩ [0,l_c] ∪ [L−l_c, L]
  const L = member.length;
  const lc = Math.min(l_c, L / 2);
  for (const lap of ctx.laps ?? []) {
    const intersects =
      Math.min(lap.end, lc) > Math.max(lap.start, 0) ||
      Math.min(lap.end, L) > Math.max(lap.start, L - lc);
    out.push(lapInCriticalZone(intersects, nd, ref, [lap.groupId]));
  }

  // crosstie_engagement
  out.push(
    crosstieEngagement(
      overlay.engagementRule(),
      ctx.longBarsTotal,
      ctx.longBarsEngaged,
      ref,
      ctx.transverse.map((t) => t.groupId),
    ),
  );

  return { items: out, l_c, segments: firstSegments };
}
