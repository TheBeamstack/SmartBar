/**
 * Rectangular cross-section layout solver (spec §6.1 [REF-SYS-610], [REF-SYS-611]).
 *
 * Turns a layout descriptor into bar centroid positions in the section frame, with:
 *   - corner bars placed first and SHARED between the two faces they touch (counted once),
 *   - per-face intermediates = nFace−2 at equal centre-to-centre spacing on the core edge,
 *   - SYMMETRIC + LAYERED principles,
 *   - computed effective depth `d` / `d'` per flexural zone from the REAL bar centroid
 *     ([REF-SYS-611]) — never the 0.9h rule of thumb.
 *
 * Section frame: origin at section centre, u = horizontal (b), v = vertical (h),
 * v=+h/2 is the top fibre, v=−h/2 the bottom fibre. Pure + deterministic.
 */
import type {
  LayoutDescriptor,
  BarPosition,
  ZoneGeometry,
  FaceTag,
} from "../types/layout";
import type { RectLayout } from "../types/placement";

export interface RectLayoutResult {
  bars: BarPosition[];
  /** total provided longitudinal bars N = 4 + Σ(nFace−2). */
  count: number;
  /** cover-to-centroid inset from each face (mm): d' = c + φ_t + φ_ℓ/2. */
  inset: number;
  /** core rectangle dims (centreline of corner bars), mm. */
  core: { width: number; height: number };
  /** per-face requested counts (inclusive of corners). */
  faceCounts: { TOP: number; BOTTOM: number; LEFT: number; RIGHT: number };
  /** faces that are occupied (count>0) but have <2 bars → tier-1 hard-invalid (§6.1.2). */
  underfilledFaces: FaceTag[];
}

const EPS = 1e-9;

function faceCountsOf(rect: RectLayout): {
  TOP: number;
  BOTTOM: number;
  LEFT: number;
  RIGHT: number;
} {
  const symmetric = rect.principle === "SYMMETRIC";
  let nTop = rect.nTop ?? 2;
  let nBottom = rect.nBottom ?? 2;
  let nLeft = rect.nLeft ?? 2;
  let nRight = rect.nRight ?? 2;
  if (symmetric) {
    nTop = nBottom = Math.max(nTop, nBottom);
    nLeft = nRight = Math.max(nLeft, nRight);
  }
  return { TOP: nTop, BOTTOM: nBottom, LEFT: nLeft, RIGHT: nRight };
}

/** Equal centre-to-centre coordinates along [−half, +half] for `n` bars (inclusive ends). */
function spread(n: number, half: number): number[] {
  if (n <= 1) return n === 1 ? [0] : [];
  const out: number[] = [];
  const step = (2 * half) / (n - 1);
  for (let i = 0; i < n; i++) out.push(-half + i * step);
  return out;
}

export function solveRectLayout(d: LayoutDescriptor): RectLayoutResult {
  const rect = d.rect;
  if (!rect) throw new Error("solveRectLayout: descriptor.rect is required for RECT sections");
  const b = d.geometry["b"];
  const h = d.geometry["h"];
  if (b === undefined || h === undefined) {
    throw new Error("solveRectLayout: geometry needs b and h (mm)");
  }
  const inset = d.cover + d.phiT + d.phiL / 2; // d' (§6.1)
  const coreW = b - 2 * inset;
  const coreH = h - 2 * inset;
  const halfW = coreW / 2;
  const halfV = coreH / 2;

  const faceCounts = faceCountsOf(rect);
  const layers = Math.max(1, rect.layers ?? 1);

  const bars: BarPosition[] = [];
  const seen = new Set<string>();
  const underfilled: FaceTag[] = [];
  const key = (u: number, v: number) => `${u.toFixed(4)}:${v.toFixed(4)}`;

  const addBar = (u: number, v: number, faceTag: FaceTag, isCorner: boolean, layerIndex: number) => {
    const k = key(u, v);
    if (seen.has(k)) {
      // already placed as a corner of an adjacent face → keep the corner tag, count once
      return;
    }
    seen.add(k);
    bars.push({ position: { u, v }, faceTag, layerIndex, isCorner });
  };

  // outer layer (layerIndex 0); LAYERED inner rows shrink the core by φ_ℓ + gap per step.
  const gap = Math.max(d.phiL, 20); // provisional inter-layer clear gap (mm)
  for (let layer = 0; layer < layers; layer++) {
    const shrink = layer * (d.phiL + gap);
    const hw = halfW - shrink;
    const hv = halfV - shrink;
    if (hw <= EPS || hv <= EPS) break;

    const faces: { tag: FaceTag; n: number; coords: number[]; fixed: number; axis: "u" | "v" }[] = [
      { tag: "TOP", n: faceCounts.TOP, coords: spread(faceCounts.TOP, hw), fixed: hv, axis: "u" },
      { tag: "BOTTOM", n: faceCounts.BOTTOM, coords: spread(faceCounts.BOTTOM, hw), fixed: -hv, axis: "u" },
      { tag: "LEFT", n: faceCounts.LEFT, coords: spread(faceCounts.LEFT, hv), fixed: -hw, axis: "v" },
      { tag: "RIGHT", n: faceCounts.RIGHT, coords: spread(faceCounts.RIGHT, hv), fixed: hw, axis: "v" },
    ];

    for (const f of faces) {
      if (layer === 0 && f.n > 0 && f.n < 2) {
        if (!underfilled.includes(f.tag)) underfilled.push(f.tag);
      }
      for (let i = 0; i < f.coords.length; i++) {
        const c = f.coords[i]!;
        const isCorner = i === 0 || i === f.coords.length - 1;
        // only outer layer corners are true section corners
        const corner = layer === 0 && isCorner;
        if (f.axis === "u") addBar(c, f.fixed, f.tag, corner, layer);
        else addBar(f.fixed, c, f.tag, corner, layer);
      }
    }
  }

  const count =
    4 +
    Math.max(0, faceCounts.TOP - 2) +
    Math.max(0, faceCounts.BOTTOM - 2) +
    Math.max(0, faceCounts.LEFT - 2) +
    Math.max(0, faceCounts.RIGHT - 2);

  return {
    bars,
    count,
    inset,
    core: { width: coreW, height: coreH },
    faceCounts,
    underfilledFaces: underfilled,
  };
}

export type TensionFace = "TOP" | "BOTTOM" | "LEFT" | "RIGHT";

/** A placed bar for the weighted geometry: its section position, cross-area, and resolved face. */
export interface WeightedBar {
  position: { u: number; v: number };
  /** cross-section area (π/4·Ø²) — the weight in the area-weighted centroid. */
  area: number;
  faceTag: FaceTag;
}

/**
 * Computed effective depth `d` / `d'` for a flexural zone ([REF-SYS-611]) over an arbitrary placed
 * set, area-weighted by each bar's cross-section — exact for MIXED diameters and MIXED levels (owner
 * ruling 2026-07-05, `structural_data.md §1`; v1.0.4 A2). `d = D_F − ȳ_t`, ȳ_t = area-weighted
 * centroid of the tension bars measured from the compression fibre opposite the tension face.
 * `computeZoneGeometry` (uniform-Ø) delegates here, so the grouped path stays byte-identical.
 */
export function computeZoneGeometryWeighted(
  zone: string,
  bars: WeightedBar[],
  section: { b: number; h: number },
  tensionFace: TensionFace,
): ZoneGeometry {
  const tensionBars = bars.filter((bp) => bp.faceTag === tensionFace);
  // depth axis: BOTTOM/TOP → vertical (v); LEFT/RIGHT → horizontal (u)
  const vertical = tensionFace === "TOP" || tensionFace === "BOTTOM";
  const D = vertical ? section.h : section.b; // section depth in the bending direction
  const half = D / 2;
  // distance of a bar from the compression fibre (opposite the tension face)
  const distFromCompFibre = (bp: WeightedBar): number => {
    const c = vertical ? bp.position.v : bp.position.u;
    switch (tensionFace) {
      case "BOTTOM":
        return half - c; // comp fibre at +h/2 (top)
      case "TOP":
        return half + c; // comp fibre at −h/2 (bottom)
      case "LEFT":
        return half + c;
      case "RIGHT":
        return half - c;
    }
  };
  let sumA = 0;
  let sumAd = 0;
  let sumAu = 0;
  let sumAv = 0;
  for (const bp of tensionBars) {
    sumA += bp.area;
    sumAd += bp.area * distFromCompFibre(bp);
    sumAu += bp.area * bp.position.u;
    sumAv += bp.area * bp.position.v;
  }
  const d = sumA > 0 ? sumAd / sumA : 0;
  // tension centroid back in the section frame (area-weighted; uniform-Ø → plain mean)
  const yt = vertical && sumA > 0 ? sumAv / sumA : 0;
  const ut = !vertical && sumA > 0 ? sumAu / sumA : 0;
  // compression-side inset d' = depth of the nearest opposite-face bars from their fibre
  const oppFace: TensionFace =
    tensionFace === "BOTTOM" ? "TOP" : tensionFace === "TOP" ? "BOTTOM" : tensionFace === "LEFT" ? "RIGHT" : "LEFT";
  const compBars = bars.filter((bp) => bp.faceTag === oppFace);
  const dPrime =
    compBars.length > 0
      ? half - Math.abs(vertical ? compBars[0]!.position.v : compBars[0]!.position.u)
      : 0;

  return { zone, d, dPrime, tensionCentroid: { u: ut, v: yt } };
}

/**
 * Computed effective depth `d` / `d'` for a flexural zone ([REF-SYS-611]).
 * Uniform-ø convenience over the layout bars; delegates to `computeZoneGeometryWeighted`.
 */
export function computeZoneGeometry(
  zone: string,
  bars: BarPosition[],
  section: { b: number; h: number },
  tensionFace: TensionFace,
  barArea: number,
): ZoneGeometry {
  return computeZoneGeometryWeighted(
    zone,
    bars.map((bp) => ({ position: bp.position, area: barArea, faceTag: bp.faceTag })),
    section,
    tensionFace,
  );
}
