/**
 * Cross-tie (épingle) helpers for v1.0.2 F2 ([REF-SYS-756]/[REF-DATA-756]).
 *
 * A column tie / beam stirrup carries a **perimeter cadre** plus a list of `CrossTie`s, each
 * engaging two longitudinal bars on opposite faces (bound by STABLE indices — D-P3-4). These pure
 * helpers compute the auto-engagement set (owner default: **every intermediate bar**) from solved
 * bar positions, and migrate a legacy `nLegs` count into an equivalent cross-tie set without data
 * loss (forward-compat, v1.0.2 §0 invariant 3). No React/DOM here — headless-testable.
 */
import { solveRectLayout, type BarPosition, type FaceTag } from "@rebarconfig/core";
import {
  type ElementDoc,
  type ColumnDoc,
  type BeamDoc,
  type CrossTie,
  isColumnDoc,
  isBeamDoc,
} from "./document";

const FACE_AXIS: Record<string, "u" | "v"> = { TOP: "u", BOTTOM: "u", LEFT: "v", RIGHT: "v" };

/**
 * Auto-engagement (owner decision, D-V102): engage **every intermediate** (non-corner) longitudinal
 * bar with the facing bar on the opposite face — TOP↔BOTTOM matched by nearest `u`, LEFT↔RIGHT by
 * nearest `v`. Corners are already restrained by the perimeter cadre. Deterministic + de-duplicated.
 */
export function autoCrossTies(bars: BarPosition[]): CrossTie[] {
  const seen = new Set<string>();
  const out: CrossTie[] = [];
  const add = (a: number, b: number) => {
    if (a < 0 || b < 0 || a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ barA: a, barB: b });
  };
  const onFace = (face: FaceTag) =>
    bars.map((b, i) => ({ b, i })).filter((x) => x.b.faceTag === face);
  const link = (fromFace: FaceTag, toFace: FaceTag) => {
    const axis = FACE_AXIS[fromFace as string] ?? "u";
    const targets = onFace(toFace);
    for (const { b, i } of onFace(fromFace)) {
      if (b.isCorner) continue; // corners are engaged by the cadre already
      let best = -1;
      let bestD = Infinity;
      for (const t of targets) {
        const d = Math.abs(t.b.position[axis] - b.position[axis]);
        if (d < bestD) {
          bestD = d;
          best = t.i;
        }
      }
      add(i, best);
    }
  };
  link("TOP", "BOTTOM");
  link("BOTTOM", "TOP");
  link("LEFT", "RIGHT");
  link("RIGHT", "LEFT");
  return out;
}

/** Engage only the intermediate bars of one direction (the F2 per-direction presets). */
export function presetCrossTies(bars: BarPosition[], direction: "vertical" | "horizontal"): CrossTie[] {
  const all = autoCrossTies(bars);
  return all.filter((ct) => {
    const a = bars[ct.barA];
    const b = bars[ct.barB];
    if (!a || !b) return false;
    const vertical = Math.abs(b.position.v - a.position.v) >= Math.abs(b.position.u - a.position.u);
    return direction === "vertical" ? vertical : !vertical;
  });
}

/** Solve just the rectangular layout to get bar positions for auto/preset/migration (no full solve). */
export function columnLayoutBars(doc: ColumnDoc): BarPosition[] {
  const L = doc.longitudinal;
  return solveRectLayout({
    section: "RECT",
    geometry: { b: doc.geometry.b, h: doc.geometry.h },
    cover: doc.cover,
    phiT: doc.tie.diameter,
    phiL: L.diameter,
    rect: { principle: L.principle, nTop: L.nTop, nBottom: L.nBottom, nLeft: L.nLeft, nRight: L.nRight },
  }).bars;
}

/** Beam top face physically carries montage + chapeau bars (8b); a min of 2 keeps the cadre closed. */
export function beamLayoutBars(doc: BeamDoc): BarPosition[] {
  const nMontage = doc.topBars.enabled ? doc.topBars.nTop : 0;
  const nChapeau = doc.chapeau.enabled ? doc.chapeau.nTop : 0;
  const nTop = Math.max(2, nMontage + nChapeau);
  const phiL = Math.max(doc.span.diameter, doc.chapeau.enabled ? doc.chapeau.diameter : 0);
  return solveRectLayout({
    section: "RECT",
    geometry: { b: doc.geometry.b, h: doc.geometry.h },
    cover: doc.cover,
    phiT: doc.stirrup.diameter,
    phiL,
    rect: { principle: "FREE", nTop, nBottom: doc.span.nBottom, nLeft: 2, nRight: 2 },
  }).bars;
}

/**
 * Migrate a legacy v1.0.1 `nLegs` count to an equivalent cross-tie set (no data loss). A legacy
 * multi-leg tie was physically the perimeter cadre + `(nLegs−2)/2` interior épingles; we bind that
 * many auto-engaged bar pairs. `nLegs≤2` → perimeter-only (empty list).
 */
function legacyNLegsToCrossTies(nLegs: number, layoutBars: BarPosition[]): CrossTie[] {
  const wanted = Math.floor((nLegs - 2) / 2);
  if (wanted <= 0) return [];
  return autoCrossTies(layoutBars).slice(0, wanted);
}

interface LegacyTie {
  crossTies?: CrossTie[];
  crossTieHookAngle?: number;
  nLegs?: number;
}

/**
 * Normalise a loaded ElementDoc: a v1.0.1 file (tie/stirrup with `nLegs`, no `crossTies`) gains an
 * equivalent cross-tie list + default hook angle; the obsolete `nLegs` is dropped. Idempotent — a
 * v1.0.2 doc (already has `crossTies`) passes through untouched. Forward-compat (§0 invariant 3).
 */
export function migrateDoc(doc: ElementDoc): ElementDoc {
  if (isColumnDoc(doc)) {
    const legacy = doc.tie as LegacyTie;
    if (legacy.crossTies !== undefined) return doc;
    const crossTies = legacyNLegsToCrossTies(legacy.nLegs ?? 2, columnLayoutBars(doc));
    const { nLegs: _drop, ...rest } = legacy;
    return { ...doc, tie: { ...(rest as ColumnDoc["tie"]), crossTies, crossTieHookAngle: legacy.crossTieHookAngle ?? 135 } };
  }
  if (isBeamDoc(doc)) {
    const legacy = doc.stirrup as LegacyTie;
    if (legacy.crossTies !== undefined) return doc;
    const crossTies = legacyNLegsToCrossTies(legacy.nLegs ?? 2, beamLayoutBars(doc));
    const { nLegs: _drop, ...rest } = legacy;
    return { ...doc, stirrup: { ...(rest as BeamDoc["stirrup"]), crossTies, crossTieHookAngle: legacy.crossTieHookAngle ?? 135 } };
  }
  return doc;
}
