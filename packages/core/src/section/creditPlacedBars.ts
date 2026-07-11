/**
 * **v1.0.6-fix R3 (finding F-B)** — crediting freely placed steel to the element's provided-area checks.
 *
 * `v1.0.5_spec` P-B requires: *"The per-metre provided-area accounting (`slabProvidedPerMetre`) gains
 * these bands."* It never did. The four generic pipelines (slab / two-way slab / joist / stair, and the
 * circular column / pile) computed provided steel from their NATIVE zone parameters only — a slab from
 * `slabProvidedPerMetre(Ø, spacing)`, a cage from `count · barArea(Ø)` — and simply ignored
 * `input.placed`. So on **6 of the 8 elements** a bar the user placed was resolved, rendered, scheduled
 * into the BBS and geometry-validated … and then invisible to §7: the verdict never moved, the element
 * stayed 🔴, and export stayed blocked. The tool told the engineer their own steel did not exist.
 *
 * (The RECT path — column/beam — was correct: `element.ts` reconciles As and the area-weighted `d` over
 * the real placed set. R3 brings the other six up to it, reusing the same idea.)
 *
 * **The accounting rule** (owner decision **O-2**, 2026-07-11): a placed band is credited *over its own
 * extent*, because that is what the bars physically do where they sit — 5 Ø12 spread over a 2 m extent is
 * 2.5 bars/m of extra steel there, not 5 bars smeared over the whole element. A point-placed bar or
 * bundle (which has no extent) is credited over the mat's own bar spacing — its tributary width.
 * ⚠ PROVISIONAL accounting convention → G-BAEL / G-EC2.
 *
 * Pure; no element branching (the caller supplies its own zones — the one section-specific thing).
 */
import { barArea } from "../validation/index";
import { isBarRow, isLayer, type PlacedBarInput } from "../types/placed-bar";
import type { PlacedLongBar } from "../pipeline/element";

/** One per-metre flexural zone as the slab-family pipelines hold it, plus what R3 needs to place a bar in it. */
export interface PerMetreZone {
  zone: string;
  /** the zone's section level (mm) in the slab frame: `v = +t/2` is the top fibre. */
  v: number;
  /** the zone's NATIVE per-metre steel (mm²/m) — the mat, before any placed credit. */
  asProvPerM: number;
  /** the zone's NATIVE effective depth (mm). */
  d: number;
  /** the mat's bar spacing (mm) — the tributary width of a point-placed bar in this zone. */
  spacing: number;
}

/** The new per-metre steel + effective depth for a zone that received placed bars. */
export interface CreditedZone {
  asProvPerM: number;
  d: number;
}

/**
 * Credit resolved placed bars to the per-metre zones of a slab-family section (slab / two-way / joist /
 * stair). Returns ONLY the zones that actually received steel — an element with no placed bars gets an
 * empty map and is byte-identical to pre-R3.
 *
 * `d` is recomputed **area-weighted** across the native mat and the credited bars (the same principle as
 * RECT's `computeZoneGeometryWeighted`), so a band placed at a different level moves `d` honestly — a
 * credit without that would be a half-truth (more steel, unchanged lever arm).
 *
 * **Known limitation (logged, not hidden):** a placed bar's SPAN DIRECTION is not expressible in the
 * v1.0.5 placed model (a free bar resolves along the member axis), so on a TWO-WAY slab — where an x-zone
 * and a y-zone can sit at nearly the same level `v` — the bar is credited to the nearest zone by level,
 * which may not be the direction the detailer intended. Deterministic (first zone wins a tie), never
 * silent-wrong in magnitude, but a direction-aware placed band is a follow-up.
 */
export function creditPlacedPerMetre(
  placed: readonly PlacedBarInput[],
  resolved: readonly PlacedLongBar[],
  zones: readonly PerMetreZone[],
  ctx: { thickness: number },
): Map<string, CreditedZone> {
  const out = new Map<string, CreditedZone>();
  if (zones.length === 0 || placed.length === 0) return out;

  // zone id → the steel added and its first moment (Σ as_i · d_i), both PER METRE.
  const added = new Map<string, { as: number; moment: number }>();

  for (const p of placed) {
    const members = resolved.filter((b) => b.placedParentId === p.id && !b.removed);
    if (members.length === 0) continue;

    // the object's mean level decides which zone it reinforces (its own extent decides how much).
    const meanV = members.reduce((a, b) => a + b.position.v, 0) / members.length;
    const zone = nearestZone(zones, meanV);
    if (!zone) continue;

    // O-2: credit over the object's OWN extent; a point object (single / bundle) over its tributary width.
    const extent = isBarRow(p) ? p.extent : isLayer(p) ? p.span : 0;
    const widthMm = extent > 0 ? extent : zone.spacing;
    if (widthMm <= 0) continue;
    const perMetre = 1000 / widthMm;

    const acc = added.get(zone.zone) ?? { as: 0, moment: 0 };
    for (const b of members) {
      const as = barArea(b.diameter) * perMetre; // mm²/m — PHYSICAL Ø (φₙ is a rule diameter, never steel)
      acc.as += as;
      acc.moment += as * depthInZone(b.position.v, zone.v, ctx.thickness);
    }
    added.set(zone.zone, acc);
  }

  for (const z of zones) {
    const a = added.get(z.zone);
    if (!a || a.as <= 0) continue;
    const asNew = z.asProvPerM + a.as;
    // area-weighted: the mat's steel at the mat's d, plus each placed bar's steel at its own d.
    const dNew = asNew > 0 ? (z.asProvPerM * z.d + a.moment) / asNew : z.d;
    out.set(z.zone, { asProvPerM: asNew, d: dNew });
  }
  return out;
}

/** The zone whose level is closest to `v` (first wins a tie → deterministic, D-P0-3). */
function nearestZone(zones: readonly PerMetreZone[], v: number): PerMetreZone | undefined {
  let best: PerMetreZone | undefined;
  let bestGap = Infinity;
  for (const z of zones) {
    const gap = Math.abs(z.v - v);
    if (gap < bestGap) {
      bestGap = gap;
      best = z;
    }
  }
  return best;
}

/**
 * A bar's effective depth within a zone: the distance from the zone's COMPRESSION fibre to the bar.
 * The slab frame puts `v = +t/2` at the top fibre, and a zone's own `d` is measured from the fibre
 * opposite its tension face — so `d = t/2 + s·v`, where `s = +1` for a top (hogging) zone and `−1` for a
 * bottom (sagging) one. A bar on the wrong side of its zone therefore earns a SHORT lever arm rather
 * than a flattering one, which is the honest answer. Floored at 0.
 */
function depthInZone(barV: number, zoneV: number, thickness: number): number {
  const s = zoneV >= 0 ? 1 : -1;
  return Math.max(0, thickness / 2 + s * barV);
}
