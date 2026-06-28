/**
 * F6 ([REF-UI-520]) — the façonnage editor for one longitudinal bar group: pick a catalog shape,
 * edit its parameters (seeded from the geometry), set start/end anchorage hooks, and see a live 2D
 * sketch + the computed `cutLength`. The choice flows through the doc → `solveDoc` → 3D/coupe/BBS/DXF.
 *
 * The `cutLength` invariant (D-P1-1) is enforced by the generator: a geometrically impossible param
 * set throws, which we catch and surface — and we **never commit invalid params** to the store, so
 * the solve only ever sees a valid shape.
 */
import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { NumberField } from "./NumberField";
import { loadShape, SHAPES } from "../engine/manifests";
import { baelPack } from "../engine/solveDoc";
import type { BarFaconnage, HookChoice } from "../engine/document";
import { generateBarShape, type UserHook, type ShapeArchetype } from "@rebarconfig/core";

/** Open, polyline shapes a longitudinal bar may take (closed ties/spirals/mesh excluded). */
const LONGITUDINAL_SHAPES = ["DROITE", "CROCHET_L", "U_BAR", "BAIONNETTE", "RELEVE", "ATTENTE", "Z_BAR", "DOUBLE_CRANK", "STEPPED"];
const HOOK_CHOICES: HookChoice[] = ["none", 90, 135, 180];

function seedParams(shape: ShapeArchetype, memberLength: number): Record<string, number> {
  const out: Record<string, number> = {};
  shape.params.forEach((p, i) => {
    out[p.key] = p.default ?? (p.type === "length" ? (i === 0 ? memberLength : Math.round(memberLength / 6)) : 0);
  });
  return out;
}

function toUserHooks(h: { start: HookChoice; end: HookChoice }): { start?: UserHook; end?: UserHook } {
  const one = (c: HookChoice): UserHook => (c === "none" ? "none" : { angle: c });
  return { start: one(h.start), end: one(h.end) };
}

interface Props {
  shapeId: string;
  diameter: number;
  faconnage?: BarFaconnage;
  memberLength: number;
  onChange: (patch: { shapeId?: string; faconnage?: BarFaconnage }) => void;
}

export function FaconnageEditor({ shapeId, diameter, faconnage, memberLength, onChange }: Props) {
  const lang = useStore((s) => s.lang);
  const s = t(lang);
  const shape = loadShape(shapeId);
  const hooks = faconnage?.hooks ?? { start: "none" as HookChoice, end: "none" as HookChoice };

  // local editing buffer: lets a (temporarily) invalid value stay in the field while we refuse to
  // commit it to the store. Re-seeds whenever the chosen shape changes.
  const committed = faconnage?.shapeParams && Object.keys(faconnage.shapeParams).length > 0 ? faconnage.shapeParams : seedParams(shape, memberLength);
  const [params, setParams] = useState<Record<string, number>>(committed);
  useEffect(() => setParams(committed), [shapeId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Generate the shape or throw — also rejects a non-positive/non-finite cutLength (D-P1-1). */
  const tryGen = (p: Record<string, number>, h: { start: HookChoice; end: HookChoice }) => {
    const r = generateBarShape(shape, p, diameter, baelPack, { hooks: toUserHooks(h) });
    if (!Number.isFinite(r.cutLength) || r.cutLength <= 0) throw new Error("non-positive cutLength");
    return r;
  };

  let sketch: ReturnType<typeof generateBarShape> | null = null;
  let error: string | null = null;
  try {
    sketch = tryGen(params, hooks);
  } catch (e) {
    error = (e as Error).message;
  }

  const pickShape = (id: string) => {
    const seeded = seedParams(loadShape(id), memberLength);
    setParams(seeded);
    onChange({ shapeId: id, faconnage: { ...faconnage, shapeParams: seeded } });
  };

  const editParam = (key: string, v: number) => {
    const next = { ...params, [key]: v };
    setParams(next);
    try {
      tryGen(next, hooks);
      onChange({ faconnage: { ...faconnage, shapeParams: next } }); // commit only when valid
    } catch {
      /* invalid → keep in the buffer, show the error, do NOT reach the solver */
    }
  };

  const setHook = (end: "start" | "end", c: HookChoice) => {
    const nextHooks = { ...hooks, [end]: c };
    try {
      tryGen(params, nextHooks);
      onChange({ faconnage: { ...faconnage, shapeParams: params, hooks: nextHooks } });
    } catch {
      /* unreachable for hook-only changes, but guard anyway */
    }
  };

  const label = (m: { label_fr?: string; label_en?: string; id: string }) => (lang === "fr" ? m.label_fr : m.label_en) ?? m.id;

  return (
    <div className="faconnage">
      <h3>{s.faconnage.title}</h3>
      <label className="field">
        <span className="field-label">{s.faconnage.shape}</span>
        <select value={shapeId} aria-label={s.faconnage.shape} onChange={(e) => pickShape(e.target.value)}>
          {LONGITUDINAL_SHAPES.map((id) => (
            <option key={id} value={id}>
              {label(SHAPES[id] as { label_fr?: string; label_en?: string; id: string })}
            </option>
          ))}
        </select>
      </label>

      {shape.params.map((p) => (
        <NumberField
          key={p.key}
          label={(lang === "fr" ? p.label_fr : p.label_en) ?? p.key}
          value={params[p.key] ?? 0}
          min={p.min ?? 0}
          max={p.type === "angle" ? (p.max ?? 180) : 20000}
          step={p.type === "angle" ? 1 : 10}
          onChange={(v) => editParam(p.key, v)}
        />
      ))}

      <div className="faconnage-hooks">
        {(["start", "end"] as const).map((end) => (
          <label key={end} className="field">
            <span className="field-label">{end === "start" ? s.faconnage.hookStart : s.faconnage.hookEnd}</span>
            <select value={String(hooks[end])} aria-label={end === "start" ? s.faconnage.hookStart : s.faconnage.hookEnd} onChange={(e) => setHook(end, e.target.value === "none" ? "none" : (Number(e.target.value) as HookChoice))}>
              {HOOK_CHOICES.map((c) => (
                <option key={String(c)} value={String(c)}>
                  {c === "none" ? s.faconnage.hookNone : `${c}°`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {error ? (
        <p className="faconnage-error" role="alert">
          {s.faconnage.invalid}
        </p>
      ) : sketch ? (
        <FaconnageSketch sketch={sketch} cutLabel={s.faconnage.cutLength} />
      ) : null}
    </div>
  );
}

/** A tiny 2D sketch of the bar centreline + its computed cut length (mm). */
function FaconnageSketch({ sketch, cutLabel }: { sketch: ReturnType<typeof generateBarShape>; cutLabel: string }) {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < sketch.centerline3D.length; i += 3) pts.push([sketch.centerline3D[i]!, sketch.centerline3D[i + 1]!]);
  if (pts.length === 0) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 220, H = 96, pad = 10;
  const sx = (maxX - minX) || 1, sy = (maxY - minY) || 1;
  const sc = Math.min((W - 2 * pad) / sx, (H - 2 * pad) / sy);
  const map = (x: number, y: number): string => `${pad + (x - minX) * sc},${H - pad - (y - minY) * sc}`;
  const poly = pts.map(([x, y]) => map(x, y)).join(" ");
  return (
    <div className="faconnage-sketch">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="façonnage">
        <polyline points={poly} fill="none" stroke="var(--accent)" strokeWidth={2} />
      </svg>
      <div className="faconnage-cut">
        {cutLabel}: <strong>{Math.round(sketch.cutLength)} mm</strong>
      </div>
    </div>
  );
}
