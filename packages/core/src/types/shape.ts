/**
 * Contract #1 — Shape Archetype segment grammar.
 * Spec: v1.0-Spec.md §5.2, §5.2.1 ([REF-SHAPE-510], [REF-SHAPE-511]).
 *
 * A bar shape is DATA, not code: an ordered list of turtle/LOGO segment ops in a
 * local right-handed frame (u = run, v = lateral, w = out-of-plane), plus end hooks.
 * The generic generator (P1) consumes this; only SPIRALE_HELICE and TREILLIS_MESH
 * are bespoke generators (§5.2.1g).
 *
 * M0 pins the TYPE only — no generator body.
 */

export type Plane = "2D" | "3D";

export type ShapeParamType = "length" | "angle" | "diameter" | "count" | "number";

export interface ShapeParam {
  key: string;
  type: ShapeParamType;
  /** Bilingual labels (spec uses _fr/_en throughout; `label` accepted as shorthand). */
  label?: string;
  label_fr?: string;
  label_en?: string;
  min?: number;
  max?: number;
  /** v1.0.4 H16: UI increment for this param's control (falls back to a type default when unset). */
  step?: number;
  default?: number;
}

/**
 * Segment ops (§5.2.1b). Each op is an object keyed by the op name so a manifest reads
 * declaratively. Expressions (`line`, `turn`, `arc`/`radius`) are evaluated by mathjs
 * against the frozen scope in §5.2.1f at solve time (P1) — NOT here.
 */
export interface LineOp {
  /** length expression along current (or `dir`) heading. */
  line: string;
  /** `u+ | u- | v+ | v-` or an absolute heading in degrees. */
  dir?: string;
}
export interface TurnOp {
  /** rotation angle expression (deg). */
  turn: string | number;
  /** fixes the bend direction (resolves the turn-direction ambiguity). */
  hand: "left" | "right";
}
export interface ArcOp {
  /** swept angle expression (deg). */
  arc: string | number;
  /** arc radius expression. */
  radius: string;
  hand: "left" | "right";
}
export interface HookOp {
  /** reference into endHooks / a hook descriptor. */
  hook: string;
}
export type SegmentOp = LineOp | TurnOp | ArcOp | HookOp;

/** Hook descriptor (§5.2.1d). The seismic overlay (§7.10) can force angle:135 / ext>=10φ. */
export interface HookDescriptor {
  angle: 90 | 135 | 180;
  /** minimum extension expression, e.g. "max(10*diameter, 70)". */
  ext_expr: string;
  /** mandrel rule, e.g. "code.mandrelMin(diameter)". */
  mandrel: string;
}
export type HookSpec = HookDescriptor | "none";

export interface EndHooks {
  start: HookSpec;
  end: HookSpec;
}

export interface ShapeArchetype {
  id: string;
  plane: Plane;
  params: ShapeParam[];
  /** true welds last vertex to first (all closed ties: CADRE_RECT, CADRE_DIAMANT, hoop). */
  closed: boolean;
  segments: SegmentOp[];
  endHooks: EndHooks;
  /** e.g. "code.mandrelMin(diameter)" — resolved from the active code pack. */
  mandrelRule: string;
  /** fabrication-length expression (segment sum ± bend deductions + hook allowances). */
  totalLengthExpr: string;
  /**
   * H2 ([v1.0.4]): the "principal leg" a user-supplied unique length drives. Every open shape's
   * cutLength is `Σ legs + hookAllowances − bendDeductions` and this leg appears once with unit
   * coefficient, so the adapter can invert `totalLengthExpr` to make `cutLength == length` by
   * setting `params[totalLengthParam]`. Must name a real `params[].key`. Absent ⇒ the shape has no
   * length-driven leg (the length field is disabled for it).
   */
  totalLengthParam?: string;
  /** per-bend allowance rule from the active pack, e.g. "code.bendDeduction". */
  bendDeductionRule?: string;
  label_fr?: string;
  label_en?: string;
}
