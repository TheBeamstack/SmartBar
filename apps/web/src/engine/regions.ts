/**
 * Pure helpers for v1.0.2 F5 transverse spacing regions ([REF-SYS-757]). A column tie / beam stirrup
 * carries an ordered, CONTIGUOUS region list over 0..L (`{from,to,spacing}`); the UI edits it through
 * these. No React/DOM — headless-testable. The engine treats an absent list (or one full-length
 * region) as uniform spacing, byte-identical to pre-F5.
 */
import type { TransverseRegion, ElementDoc } from "./document";
import { isColumnDoc, isBeamDoc } from "./document";

/** The member axis length (mm) along which the transverse set is distributed. */
export function memberAxisLength(doc: ElementDoc): number {
  if (isColumnDoc(doc)) return doc.geometry.H;
  if (isBeamDoc(doc)) return doc.geometry.L;
  // generic: best-effort longest geometry value (span-like); the editor is column/beam-first.
  const g = doc.geometry;
  return g.L ?? g.H ?? g.Lx ?? Math.max(0, ...Object.values(g));
}

/** A single full-length region — the uniform (pre-F5) case, the migration default. */
export function uniformRegions(length: number, spacing: number): TransverseRegion[] {
  return [{ from: 0, to: length, spacing }];
}

/**
 * Make a region list contiguous over 0..L: sort by `from`, snap the first start to 0, chain each
 * region's `to` to the next region's `from`, and the last `to` to `length`. Spacings are clamped
 * to ≥1. Empty → one uniform region at `fallbackSpacing`. The UI calls this on every edit so the
 * stored list is always gap/overlap-free (spec §5.2).
 */
export function normalizeRegions(
  regions: TransverseRegion[],
  length: number,
  fallbackSpacing: number,
): TransverseRegion[] {
  const clean = regions
    .filter((r) => Number.isFinite(r.from) && Number.isFinite(r.to) && r.spacing > 0)
    .map((r) => ({ from: Math.max(0, Math.min(r.from, length)), to: Math.max(0, Math.min(r.to, length)), spacing: Math.max(1, r.spacing) }))
    .filter((r) => r.to > r.from)
    .sort((a, b) => a.from - b.from);
  if (clean.length === 0) return uniformRegions(length, Math.max(1, fallbackSpacing));
  const out: TransverseRegion[] = [];
  let cursor = 0;
  for (let i = 0; i < clean.length; i++) {
    const to = i === clean.length - 1 ? length : Math.max(cursor + 1, Math.min(clean[i]!.to, length));
    if (to <= cursor) continue;
    out.push({ from: cursor, to, spacing: clean[i]!.spacing });
    cursor = to;
  }
  if (out.length === 0) return uniformRegions(length, Math.max(1, fallbackSpacing));
  out[out.length - 1]!.to = length; // guarantee full coverage
  return out;
}

/**
 * Symmetric-ends quick-fill (the common case): dense end zones + a looser middle → three regions.
 * If the two ends would overlap (2·endZone ≥ L) it collapses to a single end-spacing region.
 */
export function symmetricEndsRegions(
  length: number,
  endZone: number,
  endSpacing: number,
  midSpacing: number,
): TransverseRegion[] {
  const ez = Math.max(0, Math.min(endZone, length / 2));
  if (ez <= 0 || 2 * ez >= length) return uniformRegions(length, Math.max(1, endSpacing));
  return [
    { from: 0, to: ez, spacing: Math.max(1, endSpacing) },
    { from: ez, to: length - ez, spacing: Math.max(1, midSpacing) },
    { from: length - ez, to: length, spacing: Math.max(1, endSpacing) },
  ];
}

/** The effective region list for display (the stored list, or the uniform default). */
export function effectiveRegions(
  regions: TransverseRegion[] | undefined,
  length: number,
  spacing: number,
): TransverseRegion[] {
  return regions && regions.length > 0 ? regions : uniformRegions(length, spacing);
}
