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
 * H8 ([v1.0.4], owner A-5) — geometric validity for ADDRESSABLE bars (per-bar overrides + independent
 * extra bars), the one class of steel the grouped face-based `clear_spacing` never sees. Three pure
 * predicates over the resolved `longBars[]`, tiered per the owner's A-5 ruling:
 *   • `addressable_axial_extent` — a bar whose `[axisStart, axisStart+run]` leaves the member → 🔴 FAIL.
 *   • `addressable_section_bounds` — a FOCUS bar (a standalone extra OR a per-bar Ø override) whose
 *     `(u,v)` + its real Ø break the cover envelope (`cover + Ø/2` off a face — i.e. the bar pokes out
 *     of / through the concrete cover) → 🔴 FAIL. A Ø-override enlarges the bar at its grid slot, so an
 *     oversized override eats the cover the grouped face-based `cover` check (group Ø) never re-measures.
 *   • `addressable_clear_spacing` — a standalone extra closer than the code minimum
 *     `max(k1·Ø, dg+k2, 20)` (k1=1, k2=5 defaults) to a coexisting bar → 🔴 FAIL below the minimum,
 *     🟠 WARN if merely tight (within the pack spacing band).
 *
 * Legacy-safe by construction: emitted only when there is real addressable content (a standalone
 * extra, or a bar carried off-station by `axisStart`, or an actual violation) — a doc with no
 * addressable bars never reaches here (the grouped fast path emits no `longBars`), and a benign
 * Ø-only override adds no item. A2 later folds the spacing predicate into the general validator so
 * grouped bars are judged over the same real placed set.
 */
export interface AddressableBarView {
  barIndex: number;
  groupId: string;
  position: { u: number; v: number };
  diameter: number;
  /** axial start station along the member (mm). */
  axisStart: number;
  /** developed extent of the bar's centreline along its run axis (mm). */
  axialRun: number;
  removed: boolean;
  standalone: boolean;
  /**
   * A2 clear-spacing fold: this bar's real spacing must be judged against its neighbours — a
   * standalone extra OR a per-bar Ø override (its enlarged Ø crowds the grid the face-based check
   * never re-measures). A plain grouped/base bar (`false`) is only a spacing *neighbour*, judged by
   * the grouped `clear_spacing`, so a legacy grid is never re-reported here.
   */
  focus: boolean;
  /**
   * v1.0.5 M4 (V-B): the id of the bundle this bar belongs to, when it is a member of a `Bundle` (bars
   * deliberately in contact, centre-to-centre = Ø). Two bars sharing a `bundleId` are exempt from the
   * clear-spacing check between *each other* (they are supposed to touch); the bundle's own cover/count
   * limits are judged by the bundle rules (`placedBarRules.ts`). Absent for a non-bundle bar.
   */
  bundleId?: string;
  /**
   * v1.0.6-fix R1 (F-A): the diameter the CODE rules judge this bar on, when it differs from the
   * physical `diameter` — i.e. `φₙ = φ·√n` for a bundle member (spec P-E, owner O-1). The clear-spacing
   * **minimum** is a function of Ø, so a bundle must be judged as one equivalent bar; the **measured**
   * gap stays physical (edge-to-edge on the real bars). Absent → the physical Ø is the code Ø.
   */
  codeDiameter?: number;
}

export interface AddressableSectionCtx {
  /** section width (u) / height (v) in mm; frame origin at the centre. */
  b: number;
  h: number;
  cover: number;
  /** member length (mm) the bars run along. */
  memberLength: number;
  /** max aggregate size (mm) for the clear-spacing minimum. */
  dg: number;
  codeRef: string;
  /** pack WARN band above the spacing minimum (fraction, e.g. 0.05). */
  spacingBand: number;
}

const TOL = 1; // mm slack so a full-length bar (run == memberLength) never false-fails.

/** Clear-spacing minimum (mm): max(k1·Ø, dg+k2, 20) with the sourced k1=1, k2=5 defaults (§2). */
function clearSpacingMin(phi: number, dg: number): number {
  return Math.max(phi, dg + 5, 20);
}

/** Do two bars share any axial station (so their clear spacing is a real clash)? */
function axialOverlap(a: AddressableBarView, b: AddressableBarView): boolean {
  const a0 = a.axisStart;
  const a1 = a.axisStart + a.axialRun;
  const b0 = b.axisStart;
  const b1 = b.axisStart + b.axialRun;
  return a0 < b1 - TOL && b0 < a1 - TOL;
}

export function validateAddressableBars(
  bars: AddressableBarView[],
  ctx: AddressableSectionCtx,
): ValidationItem[] {
  const out: ValidationItem[] = [];
  const live = bars.filter((b) => !b.removed);
  const extras = live.filter((b) => b.standalone);
  // section-bounds is judged over every FOCUS bar — a standalone extra (custom u,v) OR a per-bar Ø
  // override (custom Ø at its grid slot) — since both can breach the cover envelope the group-Ø
  // `cover` check never re-measures (A2 fold, Finding-2 fix).
  const bounded = live.filter((b) => b.focus);
  const hasAddressable =
    extras.length > 0 || live.some((b) => Math.abs(b.axisStart) > TOL);

  // --- axial extent: any live bar must sit within [0, memberLength] ---
  let worstOver = 0;
  let overBar: AddressableBarView | undefined;
  for (const b of live) {
    const end = b.axisStart + b.axialRun;
    const over = Math.max(-b.axisStart, end - ctx.memberLength);
    if (over > worstOver + 1e-6) {
      worstOver = over;
      overBar = b;
    }
  }
  if (overBar && (hasAddressable || worstOver > TOL)) {
    const fail = worstOver > TOL;
    const end = Math.round(overBar.axisStart + overBar.axialRun);
    out.push(
      item(
        "addressable_axial_extent",
        fail ? "FAIL" : "PASS",
        overBar.axisStart < 0 ? Math.round(overBar.axisStart) : end,
        ctx.memberLength,
        ctx.codeRef,
        fail
          ? `Barre ${overBar.groupId} hors membre (${overBar.axisStart < 0 ? `début ${Math.round(overBar.axisStart)} mm` : `fin ${end} mm > longueur ${ctx.memberLength} mm`})`
          : `Barres adressables dans les limites du membre (${ctx.memberLength} mm)`,
        fail
          ? `Bar ${overBar.groupId} outside the member (${overBar.axisStart < 0 ? `start ${Math.round(overBar.axisStart)} mm` : `end ${end} mm > length ${ctx.memberLength} mm`})`
          : `Addressable bars within the member length (${ctx.memberLength} mm)`,
        [overBar.groupId],
      ),
    );
  }

  // --- section bounds: a focus bar's (u,v) + its real Ø must stay inside the cover envelope ---
  let worstBreach = 0;
  let breachBar: AddressableBarView | undefined;
  for (const e of bounded) {
    const envU = ctx.b / 2 - ctx.cover - e.diameter / 2;
    const envV = ctx.h / 2 - ctx.cover - e.diameter / 2;
    const breach = Math.max(Math.abs(e.position.u) - envU, Math.abs(e.position.v) - envV);
    if (breach > worstBreach) {
      worstBreach = breach;
      breachBar = e;
    }
  }
  if (bounded.length > 0) {
    const fail = breachBar !== undefined && worstBreach > TOL;
    const ref = breachBar ?? bounded[0]!;
    const envU = Math.round(ctx.b / 2 - ctx.cover - ref.diameter / 2);
    const envV = Math.round(ctx.h / 2 - ctx.cover - ref.diameter / 2);
    out.push(
      item(
        "addressable_section_bounds",
        fail ? "FAIL" : "PASS",
        `(${Math.round(ref.position.u)}, ${Math.round(ref.position.v)})`,
        `±(${envU}, ${envV})`,
        ctx.codeRef,
        fail
          ? `Barre ${ref.groupId} hors du béton/enrobage (position (${Math.round(ref.position.u)}, ${Math.round(ref.position.v)}) mm)`
          : `Barres indépendantes dans le béton (enrobage respecté)`,
        fail
          ? `Bar ${ref.groupId} outside the concrete/cover envelope (position (${Math.round(ref.position.u)}, ${Math.round(ref.position.v)}) mm)`
          : `Independent bars inside the concrete (cover respected)`,
        [ref.groupId],
      ),
    );
  }

  return finishSpacing(out, live, ctx);
}

/**
 * A2 clear-spacing fold: judge every FOCUS bar (standalone extra OR Ø-override) against its coexisting
 * neighbours over the REAL placed set with the sourced limit `max(k1·Ø, dg+k2, 20)` — so an extra
 * crammed between grid bars, or an override whose enlarged Ø crowds its neighbour, is no longer exempt
 * from the grouped face-based check. Split out so the section-bounds early-return still reaches it.
 */
function finishSpacing(
  out: ValidationItem[],
  live: AddressableBarView[],
  ctx: AddressableSectionCtx,
): ValidationItem[] {
  const focus = live.filter((b) => b.focus);
  let worstClear = Infinity;
  let worstMin = 0;
  let clearPair: [AddressableBarView, AddressableBarView] | undefined;
  for (const e of focus) {
    for (const o of live) {
      if (o === e || !axialOverlap(e, o)) continue;
      // V-B: two bars of the SAME bundle are meant to touch — never judge their mutual clear spacing.
      if (e.bundleId !== undefined && e.bundleId === o.bundleId) continue;
      const du = e.position.u - o.position.u;
      const dv = e.position.v - o.position.v;
      // measured gap = PHYSICAL edge-to-edge (the real bars are what they are) …
      const clear = Math.hypot(du, dv) - (e.diameter + o.diameter) / 2;
      // … but the REQUIRED minimum is a function of the CODE diameter: a bundle is judged as one
      // equivalent bar of φₙ (R1/F-A, spec P-E). Non-bundle bars: codeDiameter absent → bare Ø, as before.
      const sMin = clearSpacingMin(Math.max(e.codeDiameter ?? e.diameter, o.codeDiameter ?? o.diameter), ctx.dg);
      // rank by how far below its own minimum the pair sits (worst margin wins)
      if (clear - sMin < worstClear - worstMin) {
        worstClear = clear;
        worstMin = sMin;
        clearPair = [e, o];
      }
    }
  }
  if (clearPair) {
    const status: "FAIL" | "WARN" | "PASS" =
      worstClear < worstMin ? "FAIL" : worstClear < worstMin * (1 + ctx.spacingBand) ? "WARN" : "PASS";
    out.push(
      item(
        "addressable_clear_spacing",
        status,
        Math.round(worstClear * 100) / 100,
        Math.round(worstMin * 100) / 100,
        ctx.codeRef,
        status === "PASS"
          ? `Espacement libre barre indépendante ${Math.round(worstClear)} mm (min ${Math.round(worstMin)} mm)`
          : `Espacement libre barre indépendante ${Math.round(worstClear)} mm ${status === "FAIL" ? "<" : "≈"} min ${Math.round(worstMin)} mm (${clearPair[0].groupId})`,
        status === "PASS"
          ? `Independent-bar clear spacing ${Math.round(worstClear)} mm (min ${Math.round(worstMin)} mm)`
          : `Independent-bar clear spacing ${Math.round(worstClear)} mm ${status === "FAIL" ? "<" : "≈"} min ${Math.round(worstMin)} mm (${clearPair[0].groupId})`,
        [clearPair[0].groupId],
      ),
    );
  }

  return out;
}

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
