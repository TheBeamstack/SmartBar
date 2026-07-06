/**
 * Manifest-integrity gate (spec §11, "Manifest integrity (CI gate)").
 *
 * This is BUILD TOOLING, not engine/solver logic: it validates every manifest against
 * its JSON Schema and runs cross-reference checks so the "add JSON, no engine change"
 * guarantee stays safe (broken manifests fail CI, not users). M0 ships this gate.
 *
 * Pure Node (fs + ajv); no DOM/React. Safe to import from scripts and tests.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";

export type ManifestKind = "shape" | "element" | "scheme" | "supplement" | "rcfg";

const SCHEMA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../schemas");

const SCHEMA_FILE: Record<ManifestKind, string> = {
  shape: "shape.schema.json",
  element: "element.schema.json",
  scheme: "scheme.schema.json",
  supplement: "supplement.schema.json",
  rcfg: "rcfg.schema.json",
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators: Partial<Record<ManifestKind, ValidateFunction>> = {};

function validatorFor(kind: ManifestKind): ValidateFunction {
  let v = validators[kind];
  if (!v) {
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, SCHEMA_FILE[kind]), "utf8"));
    v = ajv.compile(schema);
    validators[kind] = v;
  }
  return v;
}

export interface ValidationOutcome {
  valid: boolean;
  errors: string[];
}

/** Validate a single parsed manifest object against its schema. */
export function validateManifest(kind: ManifestKind, obj: unknown): ValidationOutcome {
  const validate = validatorFor(kind);
  const valid = validate(obj) as boolean;
  const errors = (validate.errors ?? []).map(
    (e) => `${e.instancePath || "(root)"} ${e.message ?? "invalid"}`,
  );
  return { valid, errors };
}

// ---------------------------------------------------------------------------
// Expression-scope check (§5.2.1f): an archetype expression may only use in-scope
// symbols — its own param keys plus a fixed set of math/engine globals + the code.* ns.
// ---------------------------------------------------------------------------
const MATH_GLOBALS = new Set([
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
  "sqrt", "min", "max", "abs", "pow", "floor", "ceil", "round",
  "exp", "log", "PI", "pi", "e", "E",
]);
const ENGINE_GLOBALS = new Set([
  "diameter", "mandrelDiameter", "hookAllowances", "hookExt", "hookExtensions",
  "bendDeductions", "hookExtension", "code",
]);

function freeSymbols(expr: string): string[] {
  // drop member accesses ("code.mandrelMin" → keep only "code")
  const noMembers = expr.replace(/\.\s*[A-Za-z_$][\w$]*/g, "");
  return noMembers.match(/[A-Za-z_$][\w$]*/g) ?? [];
}

export function checkExprScope(expr: string | number | undefined, allowed: Set<string>): string[] {
  if (typeof expr !== "string") return [];
  const unknown: string[] = [];
  for (const sym of freeSymbols(expr)) {
    if (allowed.has(sym) || MATH_GLOBALS.has(sym) || ENGINE_GLOBALS.has(sym)) continue;
    unknown.push(sym);
  }
  return unknown;
}

function checkShapeExprs(shape: any): string[] {
  const errors: string[] = [];
  const allowed = new Set<string>((shape.params ?? []).map((p: any) => p.key));
  const flag = (where: string, expr: unknown) => {
    for (const sym of checkExprScope(expr as string, allowed)) {
      errors.push(`shape "${shape.id}": ${where} uses out-of-scope symbol "${sym}" (§5.2.1f)`);
    }
  };
  flag("totalLengthExpr", shape.totalLengthExpr);
  // H2 ([v1.0.4]): the principal-leg hint must name a real param (the adapter writes `params[tlp]`).
  if (shape.totalLengthParam !== undefined && !allowed.has(shape.totalLengthParam)) {
    errors.push(
      `shape "${shape.id}": totalLengthParam "${shape.totalLengthParam}" is not a declared param key`,
    );
  }
  for (const seg of shape.segments ?? []) {
    if (typeof seg.line === "string") flag("segment.line", seg.line);
    if (typeof seg.turn === "string") flag("segment.turn", seg.turn);
    if (typeof seg.arc === "string") flag("segment.arc", seg.arc);
    if (typeof seg.radius === "string") flag("segment.radius", seg.radius);
  }
  for (const side of ["start", "end"] as const) {
    const h = shape.endHooks?.[side];
    if (h && typeof h === "object") flag(`endHooks.${side}.ext_expr`, h.ext_expr);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Cross-reference check (§11): schemes may only reference declared zones, existing
// shape ids, and catalogued supplements; supplements reference existing shapes.
// ---------------------------------------------------------------------------
export interface ManifestSets {
  shapes: any[];
  elements: any[];
  schemes: any[];
  supplements: any[];
}

export function crossReferenceCheck(sets: ManifestSets): string[] {
  const errors: string[] = [];
  const shapeIds = new Set(sets.shapes.map((s) => s.id));
  const supplementIds = new Set(sets.supplements.map((s) => s.id));
  const elementZones = new Map<string, Set<string>>();
  for (const el of sets.elements) {
    elementZones.set(el.id, new Set((el.As_zones ?? []).map((z: any) => z.key)));
  }

  for (const shape of sets.shapes) errors.push(...checkShapeExprs(shape));

  for (const sup of sets.supplements) {
    if (sup.shape && !shapeIds.has(sup.shape)) {
      errors.push(`supplement "${sup.id}": references missing shape "${sup.shape}"`);
    }
  }

  for (const scheme of sets.schemes) {
    const zones = elementZones.get(scheme.elementType);
    if (!zones) {
      errors.push(`scheme "${scheme.id}": references missing elementType "${scheme.elementType}"`);
    }
    for (const g of scheme.baseGroups ?? []) {
      if (g.shape && !shapeIds.has(g.shape)) {
        errors.push(`scheme "${scheme.id}": baseGroup references missing shape "${g.shape}"`);
      }
      if (g.zone && zones && !zones.has(g.zone)) {
        errors.push(`scheme "${scheme.id}": baseGroup references missing zone "${g.zone}" on ${scheme.elementType}`);
      }
    }
    for (const sid of scheme.supplementalCatalog ?? []) {
      if (!supplementIds.has(sid)) {
        errors.push(`scheme "${scheme.id}": supplementalCatalog references missing supplement "${sid}"`);
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Directory walker — load + validate + cross-ref a manifests/ tree.
// ---------------------------------------------------------------------------
function readJsonFiles(dir: string): { file: string; obj: any }[] {
  if (!fs.existsSync(dir)) return [];
  const out: { file: string; obj: any }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".json")) {
      out.push({ file: full, obj: JSON.parse(fs.readFileSync(full, "utf8")) });
    }
  }
  return out;
}

export interface DirCheckResult {
  errors: string[];
  counts: Record<string, number>;
}

/** Validate every manifest under `manifestsDir` (shapes/ elements/ schemes/ supplements/). */
export function checkManifestDir(manifestsDir: string): DirCheckResult {
  const errors: string[] = [];
  const kinds: { kind: ManifestKind; sub: string }[] = [
    { kind: "shape", sub: "shapes" },
    { kind: "element", sub: "elements" },
    { kind: "scheme", sub: "schemes" },
    { kind: "supplement", sub: "supplements" },
  ];
  const sets: ManifestSets = { shapes: [], elements: [], schemes: [], supplements: [] };
  const counts: Record<string, number> = {};

  for (const { kind, sub } of kinds) {
    const files = readJsonFiles(path.join(manifestsDir, sub));
    counts[sub] = files.length;
    for (const { file, obj } of files) {
      const res = validateManifest(kind, obj);
      if (!res.valid) {
        for (const e of res.errors) errors.push(`${path.relative(manifestsDir, file)}: ${e}`);
      }
      (sets as any)[sub].push(obj);
    }
  }

  errors.push(...crossReferenceCheck(sets));
  return { errors, counts };
}
