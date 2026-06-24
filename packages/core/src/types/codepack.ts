/**
 * Contract #5 — the `code.*` function interface.
 * Spec: v1.0-Spec.md §7.11 ([REF-MATH-720]), §7 ([REF-MATH-700]).
 *
 * Archetypes, schemes, and the validator are PACK-AGNOSTIC: they call these named
 * functions. Selecting BAEL vs EC2 swaps the implementations behind the names — nothing
 * else changes. The seismic overlay (RPS, §7.10) composes on top as keyed overrides.
 *
 * M0 pins the INTERFACE only. BAEL-FR is implemented first in P1; EC2 in P4a.
 */

export type ValidationStatus = "PASS" | "WARN" | "FAIL";

/** Every validation rule returns this shape (§7). */
export interface RuleResult {
  status: ValidationStatus;
  value: number | string | null;
  limit: number | string | null;
  codeRef: string;
  message_fr: string;
  message_en: string;
  affectedGroupIds: string[];
}

export interface MaterialContext {
  /** BAEL concrete strength (MPa). */
  f_c28?: number;
  /** BAEL steel grade (MPa). */
  f_e?: number;
  /** EC2 characteristic concrete strength (MPa). */
  f_ck?: number;
  /** EC2 characteristic steel yield (MPa). */
  f_yk?: number;
  /** max aggregate size (mm). */
  d_g?: number;
  exposure?: string;
  fire?: string;
}

export interface AnchorageArgs {
  diameter: number;
  material: MaterialContext;
  /** true = good bond, false = poor bond — auto-classified from bar position (§7.7). */
  goodBond?: boolean;
  /** As,req / As,prov stress-reduction ratio (≤ 1), §7.7. */
  asReqOverProv?: number;
}

export interface LapArgs extends AnchorageArgs {
  /** fraction of bars lapped at the section (drives α6 ∈ [1.0, 1.5]). */
  fractionLapped?: number;
}

export interface AsLimitArgs {
  /** gross concrete area (mm²). */
  Ac: number;
  /** width (mm) — beams/slabs. */
  b?: number;
  /** computed effective depth (mm) — beams/slabs (§6.1). */
  d?: number;
  material: MaterialContext;
  /** axial design load (N) — columns, optional (§7.4). */
  NEd?: number;
  /** element family for the applicable min/max rule. */
  member: "COLUMN" | "BEAM" | "SLAB";
}

export interface TieSpacingArgs {
  /** smallest cross-section side (mm). */
  bMin: number;
  /** min longitudinal diameter (mm). */
  phiLMin: number;
  /** true inside a joint/lap/critical zone (tightened). */
  criticalZone?: boolean;
}

export interface CoverArgs {
  diameter: number;
  /** transverse diameter (mm). */
  phiT?: number;
  exposure: string;
  /** fire-resistance class (R30…R120) or undefined. */
  fire?: string;
  material: MaterialContext;
}

/**
 * The pack interface. All numeric returns are in SI (mm, mm², MPa).
 * Implementations live in /packages/codepacks/{BAEL-FR, EC2}/.
 */
export interface CodePack {
  id: string;
  /** allowed bar diameter set (mm), §14 item 3. */
  allowedDiameters: number[];

  /** min mandrel diameter (mm) incl. bend bearing-stress check inputs (§7.6). */
  mandrelMin(diameter: number): number;
  /** per-bend fabrication-length deduction (mm), §5.2.1e. */
  bendDeduction(angle: number, diameter: number): number;
  /** design anchorage length l_bd / l_s (mm), §7.7. */
  lbd(args: AnchorageArgs): number;
  /** lap length l_0 / l_r (mm), §7.7. */
  l0(args: LapArgs): number;
  /** minimum steel area (mm²), §7.4. */
  AsMin(args: AsLimitArgs): number;
  /** maximum steel area (mm²), §7.4. */
  AsMax(args: AsLimitArgs): number;
  /** max transverse spacing (mm), §7.5. */
  tieSpacingMax(args: TieSpacingArgs): number;
  /** nominal cover c_nom (mm) incl. durability + fire + cast-against-earth (§7.3). */
  cover(args: CoverArgs): number;
}
