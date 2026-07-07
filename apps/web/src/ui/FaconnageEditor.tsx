/**
 * F6 ([REF-UI-520]) — the façonnage editor for one longitudinal bar group: pick a catalog shape,
 * edit its parameters (seeded from the geometry), set start/end anchorage hooks, and see a live 2D
 * sketch + the computed `cutLength`. The choice flows through the doc → `solveDoc` → 3D/coupe/BBS/DXF.
 *
 * The `cutLength` invariant (D-P1-1) is enforced by the generator: a geometrically impossible param
 * set throws, which we catch and surface — and we **never commit invalid params** to the store, so
 * the solve only ever sees a valid shape.
 */
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { NumberField } from "./NumberField";
import { loadShape, SHAPES } from "../engine/manifests";
import { packFor, defaultParams } from "../engine/solveDoc";
import type { BarFaconnage, HookChoice, CodePackId } from "../engine/document";
import { generateBarShape, type UserHook } from "@rebarconfig/core";

/** Open, polyline shapes a longitudinal bar may take (closed ties/spirals/mesh excluded). */
const LONGITUDINAL_SHAPES = ["DROITE", "CROCHET_L", "U_BAR", "BAIONNETTE", "RELEVE", "ATTENTE", "Z_BAR", "DOUBLE_CRANK", "STEPPED"];
const HOOK_CHOICES: HookChoice[] = ["none", 90, 135, 180];

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
  // H13 ([v1.0.4]): the editor preview uses the SAME active code pack as the solve, so the sketch's
  // cutLength/bend deductions match what the pipeline computes (BAEL vs EC2 mandrels differ).
  const codePack = useStore((s) => (s.doc as { codePack?: CodePackId }).codePack);
  const pack = packFor(codePack);
  const s = t(lang);
  const shape = loadShape(shapeId);
  const hooks = faconnage?.hooks ?? { start: "none" as HookChoice, end: "none" as HookChoice };

  // local editing buffer: lets a (temporarily) invalid value stay in the field while we refuse to
  // commit it to the store.
  const committed = faconnage?.shapeParams && Object.keys(faconnage.shapeParams).length > 0 ? faconnage.shapeParams : defaultParams(shape, memberLength);
  const [params, setParams] = useState<Record<string, number>>(committed);
  // H17 ([v1.0.4]): the param whose last edit broke the shape (drives aria-invalid on that field) +
  // the last VALID sketch, so an invalid in-progress edit shows the real reason without blanking the
  // preview (the user keeps the last good shape on screen while they fix the number).
  const [invalidKey, setInvalidKey] = useState<string | null>(null);
  const lastSketchRef = useRef<ReturnType<typeof generateBarShape> | null>(null);
  // H4 ([v1.0.4]): resync the buffer to the committed params whenever the shape, the member length,
  // or the committed params themselves change externally (import / geometry edit / undo) — keyed by a
  // stable serialization + a last-committed ref so a self-triggered commit (or an unrelated re-render)
  // never clobbers an in-progress invalid edit. Pre-H4 the buffer only re-seeded on `shapeId`, so an
  // import or a geometry change left it stale (geometry↔façonnage desync).
  const committedKey = JSON.stringify(committed);
  const lastCommittedRef = useRef(committedKey);
  useEffect(() => {
    if (lastCommittedRef.current === committedKey) return;
    lastCommittedRef.current = committedKey;
    setParams(committed);
  }, [shapeId, memberLength, committedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Generate the shape or throw. The non-positive/non-finite cutLength guard now lives in the core
   *  generator (H3, D-P1-1) so every consumer is protected; here we just surface its throw. */
  const tryGen = (p: Record<string, number>, h: { start: HookChoice; end: HookChoice }) =>
    generateBarShape(shape, p, diameter, pack, { hooks: toUserHooks(h) });

  let sketch: ReturnType<typeof generateBarShape> | null = null;
  let error: string | null = null;
  try {
    sketch = tryGen(params, hooks);
    lastSketchRef.current = sketch; // H17: remember the last VALID shape for the fallback preview
  } catch (e) {
    error = (e as Error).message;
  }

  const pickShape = (id: string) => {
    const nextShape = loadShape(id);
    const seeded = defaultParams(nextShape, memberLength);
    // H9 ([v1.0.4]): validate the seed through the generator BEFORE committing — never switch the store
    // to a shape whose default sketch is invalid. H11 keeps every manifest default valid, so this is a
    // guard against a future bad default rather than an expected path.
    try {
      generateBarShape(nextShape, seeded, diameter, pack, { hooks: toUserHooks(hooks) });
    } catch {
      return;
    }
    setInvalidKey(null); // H17: a fresh valid shape clears any stale invalid marker
    setParams(seeded);
    onChange({ shapeId: id, faconnage: { ...faconnage, shapeParams: seeded } });
  };

  const editParam = (key: string, v: number) => {
    const next = { ...params, [key]: v };
    setParams(next);
    try {
      tryGen(next, hooks);
      setInvalidKey(null); // H17: valid → clear the invalid marker
      onChange({ faconnage: { ...faconnage, shapeParams: next } }); // commit only when valid
    } catch {
      setInvalidKey(key); // H17: mark this field invalid; keep the buffer + last-valid preview
      /* invalid → keep in the buffer, show the reason, do NOT reach the solver */
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

      {shape.params.map((p) => {
        const isAngle = p.type === "angle";
        return (
          <NumberField
            key={p.key}
            label={(lang === "fr" ? p.label_fr : p.label_en) ?? p.key}
            value={params[p.key] ?? 0}
            // H19: a straight leg must be > 0 — floor a length param at 1 mm (angles keep their min).
            min={p.type === "length" ? Math.max(p.min ?? 0, 1) : p.min ?? 0}
            // H16: honour the manifest max/step; fall back to a type default when unset.
            max={p.max ?? (isAngle ? 180 : 20000)}
            step={p.step ?? (isAngle ? 1 : 10)}
            invalid={invalidKey === p.key}
            onChange={(v) => editParam(p.key, v)}
          />
        );
      })}

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
        <div className="faconnage-invalid">
          {/* H17: the generic cue + the REAL reason (the generator's own message), and — crucially —
              the last valid sketch stays on screen so the edit is never "dropped" visually. */}
          <p className="faconnage-error" role="alert">{s.faconnage.invalid}</p>
          <p className="faconnage-error-detail">{error}</p>
          {lastSketchRef.current && (
            <>
              <p className="faconnage-lastvalid muted">{s.faconnage.lastValid}</p>
              <FaconnageSketch sketch={lastSketchRef.current} cutLabel={s.faconnage.cutLength} />
            </>
          )}
        </div>
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
