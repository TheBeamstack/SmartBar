/**
 * Placement Rules & host-geometry references.
 * Spec: v1.0-Spec.md §5.4 ([REF-SHAPE-530]).
 *
 * Placement positions a bar group relative to the element AND to other bars — this is
 * what makes supplements parametric and self-updating. Bindings reference STABLE IDS
 * (group + barIndices, corners[i], faces[edge]) so a base change re-solves dependents
 * and a deleted reference flags the supplement WARN (§5.5, §10).
 */

/** Layout principle for cross-section longitudinal placement (§6.1). */
export type LayoutPrinciple = "SYMMETRIC" | "EQUAL_PERIMETER" | "LAYERED" | "FREE";

/** Rectangular per-face descriptor. Per-face counts are INCLUSIVE of their two shared corner bars. */
export interface RectLayout {
  principle: LayoutPrinciple;
  nTop?: number;
  nBottom?: number;
  nLeft?: number;
  nRight?: number;
  layers?: number;
}

/** Reference into the host geometry / resolved base layout. Kept permissive — rules are data-driven. */
export interface PlacementRule {
  /** e.g. SECTION_PERIMETER | ALONG_PATH | BOTTOM_LAYER | TOP_LEFT_SUPPORT | LINK_BAR_PAIR | EQUAL_PERIMETER. */
  rule: string;
  layout?: RectLayout;
  /** a curve along which transverse bars repeat (column height, beam length, spiral axis). */
  path?: { ref: string } | string;
  /** specific primary bars an add-on links (e.g. an épingle links bars i and j). */
  boundTo?: { group: string; barIndices: number[] };
  /** corner indices of the section (rect: 0–3). */
  corners?: number[];
  /** TOP|BOTTOM|LEFT|RIGHT (rect) or angular position (circular). */
  faces?: string[];
  /** explicit offset (advanced builder only). */
  coordinate?: { u: number; v: number };
  /** how the bound bars are chosen ("user" = click/index pick). */
  select?: "user" | string;
  /** uniform spacing shorthand / bound spacing expression. */
  spacing?: number | string;
  /** "param" sentinel meaning the count is a user parameter. */
  count?: number | "param";
}
