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
  type SupplementEdit,
  type SupportZone,
  type ReleveZone,
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
  const supL = doc.supports.left, supR = doc.supports.right;
  const nChapeau = (supL.chapeau.enabled ? supL.chapeau.nTop : 0) + (supR.chapeau.enabled ? supR.chapeau.nTop : 0);
  const nTop = Math.max(2, nMontage + nChapeau);
  const phiL = Math.max(doc.span.diameter, supL.chapeau.enabled ? supL.chapeau.diameter : 0, supR.chapeau.enabled ? supR.chapeau.diameter : 0);
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

/** v1.0.3 G5: the legacy supplement that WAS an épingle (now unified into the cross-tie model). */
const EPINGLE_SUPPLEMENT_ID = "SUPP_EPINGLE_CROSSTIE";

const sameTie = (a: CrossTie, b: CrossTie) =>
  (a.barA === b.barA && a.barB === b.barB) || (a.barA === b.barB && a.barB === b.barA);

/**
 * v1.0.3 G5 ([REF-SYS-756b], §5): fold any legacy `SUPP_EPINGLE_CROSSTIE` *supplement* into the
 * one cross-tie model. Each épingle supplement bound a bar PAIR (`barIndices = [barA, barB]`) and
 * used to render centred; it now becomes a `CrossTie` on the tie/stirrup (anchored, hook visible).
 * Idempotent — runs only when an épingle supplement is present; de-dupes against existing ties and
 * drops the migrated entries from `supplements`. Bindings stay STABLE indices (D-P3-4).
 */
function foldEpingleSupplements(
  supplements: SupplementEdit[],
  existing: CrossTie[],
): { crossTies: CrossTie[]; supplements: SupplementEdit[] } {
  const epingles = supplements.filter((s) => s.supplementId === EPINGLE_SUPPLEMENT_ID);
  if (epingles.length === 0) return { crossTies: existing, supplements };
  const crossTies = [...existing];
  for (const s of epingles) {
    const [barA, barB] = s.barIndices;
    if (barA === undefined || barB === undefined) continue;
    const ct: CrossTie = { barA, barB, ...(s.diameter ? { diameter: s.diameter } : {}) };
    if (!crossTies.some((e) => sameTie(e, ct))) crossTies.push(ct);
  }
  return { crossTies, supplements: supplements.filter((s) => s.supplementId !== EPINGLE_SUPPLEMENT_ID) };
}

/** A legacy (v1.0.2) beam `chapeau` field, folded into `supports` by `migrateBeamSupports`. */
interface LegacyChapeau {
  enabled: boolean;
  shapeId?: string;
  diameter: number;
  nTop: number;
  asReq: number;
  supportZone: number;
}

/**
 * v1.0.3 G3 ([REF-SYS-260], spec §3.3): migrate a legacy single-`chapeau` beam to the two-support
 * model — a symmetric `left = right` SupportZone built from the old chapeau, with default anchorage +
 * width and no relevé. Idempotent (a doc already carrying `supports` passes through). Must run BEFORE
 * any code that reads `doc.supports` (e.g. `beamLayoutBars`).
 */
function migrateBeamSupports(doc: BeamDoc): BeamDoc {
  const legacy = doc as unknown as {
    chapeau?: LegacyChapeau;
    supports?: BeamDoc["supports"];
    chapeauShapeId?: string;
    releves?: ReleveZone[];
  };
  if (legacy.supports) {
    // already migrated — only backfill the shape id / releves if a partial doc lacks them.
    return {
      ...doc,
      chapeauShapeId: doc.chapeauShapeId ?? legacy.chapeau?.shapeId ?? "CHAPEAU",
      releves: doc.releves ?? [],
    };
  }
  const ch = legacy.chapeau;
  const sz = (): SupportZone => ({
    chapeau: {
      enabled: ch?.enabled ?? false,
      diameter: ch?.diameter ?? 16,
      nTop: ch?.nTop ?? 2,
      asReq: ch?.asReq ?? 0,
      length: ch?.supportZone ?? 1000,
    },
    anchorage: 400,
    width: 300,
  });
  const { chapeau: _drop, ...rest } = legacy;
  return {
    ...(rest as unknown as BeamDoc),
    supports: { left: sz(), right: sz() },
    chapeauShapeId: ch?.shapeId ?? "CHAPEAU",
    releves: legacy.releves ?? [],
  };
}

/**
 * Normalise a loaded ElementDoc to the current model. Three legacy migrations, all idempotent and
 * lossless (forward-compat, §0 invariant 3):
 *  - **v1.0.1 `nLegs`** (tie/stirrup with `nLegs`, no `crossTies`) → an equivalent cross-tie list +
 *    a default hook angle; the obsolete `nLegs` is dropped.
 *  - **v1.0.3 G5 supplement-épingles** (a `SUPP_EPINGLE_CROSSTIE` in `supplements`) → folded into
 *    the tie/stirrup `crossTies` (one cross-tie model), dropped from `supplements`.
 * A current doc (already `crossTies`, no épingle supplement) passes through untouched.
 */
export function migrateDoc(doc: ElementDoc): ElementDoc {
  if (isColumnDoc(doc)) {
    const legacy = doc.tie as LegacyTie;
    const baseTies = legacy.crossTies ?? legacyNLegsToCrossTies(legacy.nLegs ?? 2, columnLayoutBars(doc));
    const folded = foldEpingleSupplements(doc.supplements, baseTies);
    const { nLegs: _drop, ...rest } = legacy;
    return {
      ...doc,
      tie: { ...(rest as ColumnDoc["tie"]), crossTies: folded.crossTies, crossTieHookAngle: legacy.crossTieHookAngle ?? 135 },
      supplements: folded.supplements,
    };
  }
  if (isBeamDoc(doc)) {
    const beam = migrateBeamSupports(doc); // G3: legacy chapeau → two supports (before beamLayoutBars)
    const legacy = beam.stirrup as LegacyTie;
    const baseTies = legacy.crossTies ?? legacyNLegsToCrossTies(legacy.nLegs ?? 2, beamLayoutBars(beam));
    const folded = foldEpingleSupplements(beam.supplements, baseTies);
    const { nLegs: _drop, ...rest } = legacy;
    return {
      ...beam,
      stirrup: { ...(rest as BeamDoc["stirrup"]), crossTies: folded.crossTies, crossTieHookAngle: legacy.crossTieHookAngle ?? 135 },
      supplements: folded.supplements,
    };
  }
  return doc;
}
