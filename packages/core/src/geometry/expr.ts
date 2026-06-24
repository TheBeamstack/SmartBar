/**
 * Frozen expression scope evaluator (spec §5.2.1f [REF-SHAPE-511]).
 *
 * Archetype length/angle expressions (`len_expr`, `angle_expr`, `totalLengthExpr`,
 * `ext_expr`) are evaluated with mathjs against a deterministic, side-effect-free scope:
 *   { ...params, diameter, mandrelDiameter, hookExt, bendDeductions, hookAllowances,
 *     <math globals>, code.* }
 * The set of in-scope symbols is the SAME one the integrity gate enforces at manifest-load
 * time (packages/core/src/integrity/index.ts → MATH_GLOBALS ∪ ENGINE_GLOBALS ∪ params).
 *
 * Determinism (spec §6 invariant): mathjs arithmetic is pure; no Date.now()/Math.random().
 */
import { evaluate } from "mathjs";
import type { CodePack } from "../types/codepack";

/** Engine-supplied globals available to every archetype expression (§5.2.1f). */
export interface EngineScope {
  /** the bar's diameter (mm). */
  diameter: number;
  /** governing mandrel diameter (mm) = code.mandrelMin(diameter) or bearing-stress value. */
  mandrelDiameter?: number;
  /** representative per-hook extension allowance (mm) for totalLengthExpr. */
  hookExt?: number;
  /** total bend-deduction sum (mm) for totalLengthExpr. */
  bendDeductions?: number;
  /** total hook allowance sum (mm). */
  hookAllowances?: number;
}

export type ExprScope = EngineScope & {
  code: CodePack;
  /** archetype params + engine globals; `code` is the only non-number entry. */
  [symbol: string]: number | CodePack | undefined;
};

/**
 * Evaluate one expression to a finite number against `scope`. A non-numeric / non-finite
 * result is a manifest-authoring error (caught early, never silently NaN'd downstream).
 */
export function evalExpr(expr: string | number, scope: ExprScope): number {
  if (typeof expr === "number") return expr;
  let raw: unknown;
  try {
    raw = evaluate(expr, scope as unknown as Record<string, unknown>);
  } catch (e) {
    throw new Error(`expr eval failed for "${expr}": ${(e as Error).message}`);
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`expr "${expr}" did not evaluate to a finite number (got ${String(raw)})`);
  }
  return n;
}

/** Build the param+engine scope object for a bar group's shape evaluation. */
export function makeScope(
  params: Record<string, number>,
  diameter: number,
  code: CodePack,
  engine: Partial<EngineScope> = {},
): ExprScope {
  return { ...params, diameter, code, ...engine };
}
