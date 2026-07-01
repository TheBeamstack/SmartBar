/**
 * Lap splices / couplers (v1.0.3 G4, spec §4, [REF-SYS-770]).
 *
 * A long bar is fabricated in **spliced segments** (stock-length limited) or joined by **couplers**.
 * `spliceBar` cuts a bar's fabricated run at its splice points into segments, where a **lap** splice
 * adds the code overlap length `l_r = code.l0(...)` to the segment that laps forward, and a **coupler**
 * adds no length (a mechanical joint, counted separately). This is PURE + deterministic and preserves
 * the D-P1-1 cut-length accounting: `Σ segment cutLengths = run + (#laps)·l_r`.
 */
import type { LapArgs, MaterialContext } from "../types/codepack";

export type SpliceKind = "lap" | "coupler";

/** A splice point along a bar's run (mm from the bar start). */
export interface Splice {
  at: number;
  kind: SpliceKind;
}

/** One fabricated segment of a spliced bar. */
export interface BarSegment {
  /** fabrication length (mm) incl. the forward lap overlap when this segment laps into the next. */
  cutLength: number;
  /** this segment laps forward into the next (its cutLength carries the overlap). */
  lapForward: boolean;
  /** a coupler joins this segment to the next. */
  couplerAtEnd: boolean;
}

export interface SpliceResult {
  segments: BarSegment[];
  /** number of mechanical couplers along this bar. */
  couplerCount: number;
  /** the code lap overlap length `l_r` (mm). */
  lapLength: number;
  /** Σ segment cutLengths (mm) = run + (#laps)·l_r. */
  totalCutLength: number;
}

export interface SpliceArgs {
  diameter: number;
  material: MaterialContext;
  goodBond?: boolean;
  /** fraction of bars lapped at the section (drives α6 in `code.l0`). */
  fractionLapped?: number;
}

/**
 * Split a bar of fabricated length `run` at its `splices` into segments (spec §4.2). A lap splice
 * extends the segment before it by the code overlap `l_r`; a coupler adds no length but is counted.
 * Splices at/beyond the ends are ignored. Deterministic; the total-length invariant is preserved.
 */
export function spliceBar(
  run: number,
  splices: Splice[],
  code: { l0(args: LapArgs): number },
  args: SpliceArgs,
): SpliceResult {
  const lapLength = code.l0({
    diameter: args.diameter,
    material: args.material,
    ...(args.goodBond !== undefined ? { goodBond: args.goodBond } : {}),
    ...(args.fractionLapped !== undefined ? { fractionLapped: args.fractionLapped } : {}),
  });
  const pts = splices
    .filter((s) => s.at > 1e-6 && s.at < run - 1e-6)
    .slice()
    .sort((a, b) => a.at - b.at);
  if (pts.length === 0) {
    return { segments: [{ cutLength: run, lapForward: false, couplerAtEnd: false }], couplerCount: 0, lapLength, totalCutLength: run };
  }
  const segments: BarSegment[] = [];
  let couplerCount = 0;
  let prev = 0;
  for (const s of pts) {
    const isLap = s.kind === "lap";
    if (!isLap) couplerCount++;
    segments.push({ cutLength: s.at - prev + (isLap ? lapLength : 0), lapForward: isLap, couplerAtEnd: !isLap });
    prev = s.at;
  }
  segments.push({ cutLength: run - prev, lapForward: false, couplerAtEnd: false });
  const totalCutLength = segments.reduce((t, s) => t + s.cutLength, 0);
  return { segments, couplerCount, lapLength, totalCutLength };
}

/**
 * Auto-splice a run longer than the stock length into near-equal lap segments (spec §4.2, default
 * 12 m stock — the same the BBS `nestCuts` uses). Returns the interior splice points; an already
 * short-enough run yields none.
 */
export function autoSplices(run: number, stockLength = 12000, kind: SpliceKind = "lap"): Splice[] {
  if (run <= stockLength || stockLength <= 0) return [];
  const n = Math.ceil(run / stockLength) - 1;
  const step = run / (n + 1);
  const out: Splice[] = [];
  for (let k = 1; k <= n; k++) out.push({ at: step * k, kind });
  return out;
}
