/**
 * Topological / detailing-logic validity predicates (spec §7.13 [REF-MATH-740]).
 *
 * Beyond numeric limits, the validity layer registers named predicates — structural-detailing
 * rules that depend on bar *arrangement*, not just a constant. Each is a pure function returning
 * the standard tiered ValidationItem. Adding a predicate is a function (+ manifest), never an
 * engine change (§0.1). P4a ships the slab + two-way-corner predicates; end-support anchorage is
 * the beam profile's existing check (§7.7). P4b adds the stair + seismic predicates.
 *
 * Pure + deterministic; pack-agnostic.
 */
import type { Ductility } from "../types/seismic";
import { item, type ValidationItem } from "./index";
import { mm2 } from "./index";

/**
 * `slab_distribution_min` (§7.13, §7.4) — secondary/distribution steel must be ≥ a fraction of
 * the main steel (EC2 §9.3.1.1(2): 0.20·As,main). Below → tier-1 FAIL.
 */
export function slabDistributionMin(
  asMainProvPerM: number,
  asDistProvPerM: number,
  fraction: number,
  codeRef: string,
  groupIds: string[],
): ValidationItem {
  const need = fraction * asMainProvPerM;
  const ok = asDistProvPerM >= need;
  const pct = Math.round(fraction * 100);
  return item(
    "slab_distribution_min",
    ok ? "PASS" : "FAIL",
    Math.round(asDistProvPerM * 100) / 100,
    Math.round(need * 100) / 100,
    codeRef,
    ok
      ? `Aciers de répartition ${mm2(asDistProvPerM)}/m ≥ ${pct}%·As,principal (${mm2(need)}/m)`
      : `Aciers de répartition ${mm2(asDistProvPerM)}/m < ${pct}%·As,principal (${mm2(need)}/m)`,
    ok
      ? `Distribution steel ${mm2(asDistProvPerM)}/m ≥ ${pct}%·As,main (${mm2(need)}/m)`
      : `Distribution steel ${mm2(asDistProvPerM)}/m < ${pct}%·As,main (${mm2(need)}/m)`,
    groupIds,
  );
}

/**
 * `twoway_corner_torsion_missing` (§7.13, §7.4) — a restrained discontinuous corner of a two-way
 * slab with an EMPTY `As_corner_torsion` zone → tier-2 WARN (corner torsion steel should be
 * provided top + bottom when the corner is held down).
 */
export function twowayCornerTorsionMissing(
  restrained: boolean,
  asCornerProv: number,
  codeRef: string,
  groupIds: string[],
): ValidationItem {
  const missing = restrained && asCornerProv <= 0;
  return item(
    "twoway_corner_torsion_missing",
    missing ? "WARN" : "PASS",
    asCornerProv > 0 ? Math.round(asCornerProv * 100) / 100 : "none",
    "required when restrained",
    codeRef,
    missing
      ? `Coin maintenu sans aciers de torsion (As_corner_torsion) — à prévoir (nappes sup.+inf.)`
      : restrained
      ? `Aciers de torsion d'angle présents (coin maintenu)`
      : `Coin non maintenu — aciers de torsion non requis`,
    missing
      ? `Restrained corner without torsion steel (As_corner_torsion) — provide top+bottom mats`
      : restrained
      ? `Corner torsion steel present (restrained corner)`
      : `Corner not restrained — torsion steel not required`,
    groupIds,
  );
}

/**
 * `stair_reentrant_corner_pullout` (§7.13, §5.2.1) — a **tension** bar bent around a **re-entrant
 * (concave) corner** (the flight↔landing kink of a `MARCHE_PALIER`) must be SPLIT and separately
 * anchored, never wrapped: a wrapped tension bar straightens under load and spalls the cover off
 * the inside of the kink. Fires 🔴 when the main (bottom-tension) bar is continuous around the
 * re-entrant corner; PASS when split+anchored (or no re-entrant corner). A classic detailing error
 * a construction-aware tool must catch.
 */
export function stairReentrantCornerPullout(
  reentrantCorner: boolean,
  mainBarWrapsCorner: boolean,
  codeRef: string,
  groupIds: string[],
): ValidationItem {
  const fires = reentrantCorner && mainBarWrapsCorner;
  return item(
    "stair_reentrant_corner_pullout",
    fires ? "FAIL" : "PASS",
    mainBarWrapsCorner ? "continuous" : "split",
    "split + anchored",
    codeRef,
    fires
      ? `Barre tendue continue autour de l'angle rentrant (jonction volée/palier) — la fendre et l'ancrer séparément (risque d'éclatement de l'enrobage)`
      : reentrantCorner
      ? `Barre tendue fendue et ancrée de part et d'autre de l'angle rentrant (correct)`
      : `Pas d'angle rentrant (palier sans retour) — sans objet`,
    fires
      ? `Tension bar wrapped continuously around the re-entrant flight↔landing corner — split and anchor it separately (cover spalls otherwise)`
      : reentrantCorner
      ? `Tension bar split and anchored on both sides of the re-entrant corner (correct)`
      : `No re-entrant corner — not applicable`,
    groupIds,
  );
}

/**
 * `lap_in_critical_zone` (§7.13, §7.10c) — a lap/splice whose extent intersects a plastic-hinge
 * (`l_c`) segment of a seismic member. Forbidden in critical zones: 🔴 FAIL under ND2/ND3,
 * relaxed to 🟠 WARN under ND1. The engine already knows both the lap extent and `l_c`.
 */
export function lapInCriticalZone(
  intersects: boolean,
  ductility: Ductility,
  codeRef: string,
  groupIds: string[],
): ValidationItem {
  const status = !intersects ? "PASS" : ductility === "ND1" ? "WARN" : "FAIL";
  return item(
    "lap_in_critical_zone",
    status,
    intersects ? "lap ∩ l_c" : "clear of l_c",
    "no lap in l_c",
    codeRef,
    status === "FAIL"
      ? `Recouvrement dans la zone critique (l_c) interdit en ${ductility} — déplacer le recouvrement hors zone de rotule plastique`
      : status === "WARN"
      ? `Recouvrement dans la zone critique (l_c) — à éviter (${ductility})`
      : `Recouvrements hors zones critiques (l_c)`,
    status === "FAIL"
      ? `Lap inside the critical zone (l_c) is forbidden in ${ductility} — move the splice out of the plastic-hinge region`
      : status === "WARN"
      ? `Lap inside the critical zone (l_c) — avoid (${ductility})`
      : `Laps clear of critical zones (l_c)`,
    groupIds,
  );
}

/**
 * `crosstie_engagement` (§7.13, §7.10b) — seismic confinement requires longitudinal bars to be
 * laterally engaged by a tie corner or cross-tie: **alternate** bars under ND2, **every** bar under
 * ND3. Short engagement is a 🟠 **WARN** at every class — the Verification tab flags it but it does
 * **not block export** (owner decision, v1.0.2 F2 / D-V102: indicate, never block). ND1 imposes no
 * engagement requirement. The constants ride the provisional RPS overlay (gate G-RPS).
 */
export function crosstieEngagement(
  rule: "none" | "alternate" | "every",
  totalBars: number,
  engagedBars: number,
  codeRef: string,
  groupIds: string[],
): ValidationItem {
  const need = rule === "every" ? totalBars : rule === "alternate" ? Math.ceil(totalBars / 2) : 0;
  const ok = engagedBars >= need;
  const status = rule === "none" || ok ? "PASS" : "WARN";
  return item(
    "crosstie_engagement",
    status,
    engagedBars,
    rule === "none" ? "no requirement" : need,
    codeRef,
    status === "PASS"
      ? rule === "none"
        ? `Engagement des barres non requis (ND1)`
        : `Barres longitudinales engagées ${engagedBars}/${totalBars} ≥ requis ${need} (${rule})`
      : `Barres engagées ${engagedBars}/${totalBars} < requis ${need} — ajouter des épingles/cross-ties (${rule})`,
    status === "PASS"
      ? rule === "none"
        ? `Bar engagement not required (ND1)`
        : `Longitudinal bars engaged ${engagedBars}/${totalBars} ≥ required ${need} (${rule})`
      : `Engaged bars ${engagedBars}/${totalBars} < required ${need} — add cross-ties/épingles (${rule})`,
    groupIds,
  );
}
