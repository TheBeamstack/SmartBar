/**
 * G2 ([REF-UI-530], spec §2) — bar-by-bar detailing. Pick ONE bar on the F7 section picker and give
 * it its own shape/hooks (via the façonnage editor), a unique length + axial position, a different Ø,
 * or remove it; and add INDEPENDENT extra bars at a chosen section level (`v`). All write the doc's
 * `barOverrides` / `extraBars`, which `solveDoc` threads into the engine's `longOverrides`/`extraBars`
 * so the choice flows to 3D/coupe/PDF/DXF + the schedule. Picker AND numeric (a11y parity).
 *
 * H18 ([v1.0.4]): all copy comes from the shared i18n bundle (`t(lang).addressable`), not inline `tr()`.
 */
import { useStore } from "../store/useStore";
import { t, type Strings } from "../i18n/strings";
import { isColumnDoc, isBeamDoc, type BarOverrideEdit, type BarFaconnage } from "../engine/document";
import { barLabel } from "../engine/barLabels";
import { FaconnageEditor } from "./FaconnageEditor";
import { NumberInput } from "./NumberInput";

export function AddressableBars() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const result = useStore((s) => s.result);
  const selectedBars = useStore((s) => s.selectedBars);
  const selectedExtraId = useStore((s) => s.selectedExtraId);
  const setBarOverrides = useStore((s) => s.setBarOverrides);
  const setExtraBars = useStore((s) => s.setExtraBars);
  const s = t(lang).addressable;

  const col = isColumnDoc(doc);
  const beam = isBeamDoc(doc);
  if (!col && !beam) return null;
  const group = col ? doc.longitudinal : doc.span;
  const overrides = group.barOverrides ?? [];
  const extras = doc.extraBars ?? [];
  const memberLen = col ? doc.geometry.H : doc.geometry.L;
  const bars = result.bars;

  const target = selectedBars[0];
  const cur = target !== undefined ? overrides.find((o) => o.index === target) : undefined;

  const upsert = (index: number, patch: Partial<BarOverrideEdit>) =>
    setBarOverrides(
      overrides.some((o) => o.index === index)
        ? overrides.map((o) => (o.index === index ? { ...o, ...patch } : o))
        : [...overrides, { index, ...patch }],
    );
  const removeOverride = (index: number) => setBarOverrides(overrides.filter((o) => o.index !== index));
  const onFaconnage = (patch: { shapeId?: string; faconnage?: BarFaconnage }) => {
    if (target !== undefined) upsert(target, patch);
  };

  // H15 ([v1.0.4]): a stable, collision-free id — the first free `x{n}`. The old `X${length+1}` reused
  // an id after a middle bar was removed (two bars → same React key / same schedule id).
  const freshExtraId = (existing: typeof extras): string => {
    const used = new Set(existing.map((e) => e.id));
    let n = 1;
    while (used.has(`x${n}`)) n++;
    return `x${n}`;
  };
  const addExtra = () =>
    setExtraBars([...extras, { id: freshExtraId(extras), u: 0, v: 0, shapeId: "DROITE", diameter: group.diameter, length: memberLen }]);
  const patchExtra = (id: string, patch: Partial<(typeof extras)[number]>) =>
    setExtraBars(extras.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeExtra = (id: string) => setExtraBars(extras.filter((e) => e.id !== id));

  return (
    <div className="addressable">
      <h3>{s.title}</h3>
      {/* v1.0.6 N2 (U2): the section picker is no longer embedded here — pick a bar on the ONE shared
          SectionCanvas (top of the scheme controls, in select mode) and this editor targets it. */}
      <p className="muted sp-hint">{s.hint}</p>

      {target !== undefined && (
        <div className="addressable-bar">
          <div className="addressable-head">
            <strong>{s.bar} {barLabel(target, bars)}</strong>
            <label className="addressable-remove">
              <input type="checkbox" checked={cur?.removed ?? false} onChange={(e) => upsert(target, { removed: e.target.checked })} />
              {s.remove}
            </label>
          </div>
          {!cur?.removed && (
            <>
              <NumberInput label={s.diameter} value={cur?.diameter ?? group.diameter} min={6} max={40} step={1} onChange={(v) => upsert(target, { diameter: v })} />
              <CoupledLength s={s} shapeId={cur?.shapeId ?? group.shapeId} length={cur?.length} memberLen={memberLen} onChange={(v) => upsert(target, { length: v })} />
              <NumberInput label={s.axialPos} value={cur?.axialPos ?? 0} min={0} max={20000} step={10} onChange={(v) => upsert(target, { axialPos: v })} />
              <label className="addressable-autosplit">
                <input type="checkbox" checked={cur?.autoSplice ?? false} onChange={(e) => upsert(target, { autoSplice: e.target.checked })} />
                {s.autoSplit}
              </label>
              <FaconnageEditor
                key={`ov-${target}`}
                shapeId={cur?.shapeId ?? group.shapeId}
                diameter={cur?.diameter ?? group.diameter}
                faconnage={cur?.faconnage}
                memberLength={cur?.length ?? memberLen}
                onChange={onFaconnage}
              />
            </>
          )}
          {cur && (
            <button type="button" className="addressable-reset" onClick={() => removeOverride(target)}>
              {s.reset}
            </button>
          )}
        </div>
      )}

      {overrides.length > 0 && (
        <ul className="addressable-list" aria-label={s.overridden}>
          {overrides.map((o) => (
            <li key={o.index} className="addressable-row">
              <span>
                {barLabel(o.index, bars)} — {o.removed ? s.removed : `${o.shapeId ?? group.shapeId} Ø${o.diameter ?? group.diameter}${o.length ? ` ℓ=${o.length}` : ""}`}
              </span>
              <button type="button" onClick={() => removeOverride(o.index)} aria-label={s.removeOverride}>×</button>
            </li>
          ))}
        </ul>
      )}

      <h4>{s.independent}</h4>
      <button type="button" className="addressable-add-extra" onClick={addExtra}>
        {s.addBar}
      </button>
      <ul className="addressable-list" aria-label={s.independentList}>
        {extras.map((e) => (
          <li key={e.id} className={`addressable-extra ${e.id === selectedExtraId ? "addressable-extra-selected" : ""}`} aria-current={e.id === selectedExtraId || undefined}>
            {/* H6 ([v1.0.4]): expose the FULL model an independent bar already carries (shape/façonnage/
                length/axial pos), not just u/v/Ø — the adapter (buildExtraBars) threads all of it.
                H7: the section-picker selects an extra by id → highlight its editor here. */}
            <div className="addressable-head">
              <strong>{s.bar} {e.id}</strong>
              <button type="button" onClick={() => removeExtra(e.id)} aria-label={`${s.removeBar} ${e.id}`}>×</button>
            </div>
            <div className="addressable-extra-pos">
              <NumberInput label={s.u} value={e.u} min={-2000} max={2000} step={5} onChange={(v) => patchExtra(e.id, { u: v })} />
              <NumberInput label={s.level} value={e.v} min={-2000} max={2000} step={5} onChange={(v) => patchExtra(e.id, { v })} />
              <NumberInput label="Ø (mm)" value={e.diameter} min={6} max={40} step={1} onChange={(v) => patchExtra(e.id, { diameter: v })} />
            </div>
            <CoupledLength s={s} shapeId={e.shapeId} length={e.length} memberLen={memberLen} onChange={(v) => patchExtra(e.id, { length: v })} />
            <NumberInput label={s.axialPos} value={e.axialPos ?? 0} min={0} max={20000} step={10} onChange={(v) => patchExtra(e.id, { axialPos: v })} />
            <label className="addressable-autosplit">
              <input type="checkbox" checked={e.autoSplice ?? false} onChange={(ev) => patchExtra(e.id, { autoSplice: ev.target.checked })} />
              {s.autoSplit}
            </label>
            <FaconnageEditor
              key={`extra-${e.id}`}
              shapeId={e.shapeId}
              diameter={e.diameter}
              faconnage={e.faconnage}
              memberLength={e.length ?? memberLen}
              onChange={(patch) => patchExtra(e.id, patch)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * H12 ([v1.0.4], owner A-7): a DROITE bar's length is coupled to the member by default (read-only),
 * with an explicit toggle to enter a custom length (`length` undefined ⇒ coupled = memberLen). A
 * non-DROITE bar drives its length via the façonnage params, so it keeps the editable field. H19: the
 * custom length floors at 1 mm.
 */
function CoupledLength({
  s,
  shapeId,
  length,
  memberLen,
  onChange,
}: {
  s: Strings["addressable"];
  shapeId: string;
  length?: number;
  memberLen: number;
  onChange: (v: number | undefined) => void;
}) {
  if (shapeId !== "DROITE") {
    return <NumberInput label={s.length} value={length ?? memberLen} min={1} max={20000} step={10} onChange={onChange} />;
  }
  const custom = length !== undefined;
  return (
    <div className="addressable-length">
      <label className="addressable-couple">
        <input type="checkbox" checked={custom} onChange={(e) => onChange(e.target.checked ? memberLen : undefined)} />
        {s.customLength}
      </label>
      {custom ? (
        <NumberInput label={s.length} value={length ?? memberLen} min={1} max={20000} step={10} onChange={onChange} />
      ) : (
        <output className="addressable-coupled" aria-label={s.length}>{s.lengthCoupled}: {memberLen} mm</output>
      )}
    </div>
  );
}
