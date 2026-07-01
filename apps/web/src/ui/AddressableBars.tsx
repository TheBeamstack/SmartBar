/**
 * G2 ([REF-UI-530], spec §2) — bar-by-bar detailing. Pick ONE bar on the F7 section picker and give
 * it its own shape/hooks (via the façonnage editor), a unique length + axial position, a different Ø,
 * or remove it; and add INDEPENDENT extra bars at a chosen section level (`v`). All write the doc's
 * `barOverrides` / `extraBars`, which `solveDoc` threads into the engine's `longOverrides`/`extraBars`
 * so the choice flows to 3D/coupe/PDF/DXF + the schedule. Picker AND numeric (a11y parity).
 */
import { useStore } from "../store/useStore";
import { isColumnDoc, isBeamDoc, type BarOverrideEdit, type BarFaconnage } from "../engine/document";
import { barLabel } from "../engine/barLabels";
import { SectionPicker } from "./SectionPicker";
import { FaconnageEditor } from "./FaconnageEditor";
import { NumberField } from "./NumberField";

export function AddressableBars() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const result = useStore((s) => s.result);
  const selectedBars = useStore((s) => s.selectedBars);
  const setSelectedBars = useStore((s) => s.setSelectedBars);
  const setBarOverrides = useStore((s) => s.setBarOverrides);
  const setExtraBars = useStore((s) => s.setExtraBars);
  const tr = (fr: string, en: string) => (lang === "fr" ? fr : en);

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

  const addExtra = () =>
    setExtraBars([...extras, { id: `X${extras.length + 1}-${Math.floor(memberLen)}`, u: 0, v: 0, shapeId: "DROITE", diameter: group.diameter, length: memberLen }]);
  const patchExtra = (id: string, patch: Partial<(typeof extras)[number]>) =>
    setExtraBars(extras.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeExtra = (id: string) => setExtraBars(extras.filter((e) => e.id !== id));

  return (
    <div className="addressable">
      <h3>{tr("Détail barre par barre", "Bar-by-bar detailing")}</h3>
      <p className="muted sp-hint">{tr("Sélectionnez une barre à façonner", "Pick a bar to shape")}</p>
      <SectionPicker onPick={(i) => setSelectedBars([i])} />

      {target !== undefined && (
        <div className="addressable-bar">
          <div className="addressable-head">
            <strong>{tr("Barre", "Bar")} {barLabel(target, bars)}</strong>
            <label className="addressable-remove">
              <input type="checkbox" checked={cur?.removed ?? false} onChange={(e) => upsert(target, { removed: e.target.checked })} />
              {tr("Supprimer", "Remove")}
            </label>
          </div>
          {!cur?.removed && (
            <>
              <NumberField label={tr("Ø barre (mm)", "Bar Ø (mm)")} value={cur?.diameter ?? group.diameter} min={6} max={40} step={1} onChange={(v) => upsert(target, { diameter: v })} />
              <NumberField label={tr("Longueur (mm)", "Length (mm)")} value={cur?.length ?? memberLen} min={0} max={20000} step={10} onChange={(v) => upsert(target, { length: v })} />
              <NumberField label={tr("Position axiale (mm)", "Axial position (mm)")} value={cur?.axialPos ?? 0} min={0} max={20000} step={10} onChange={(v) => upsert(target, { axialPos: v })} />
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
              {tr("Réinitialiser la barre", "Reset bar")}
            </button>
          )}
        </div>
      )}

      {overrides.length > 0 && (
        <ul className="addressable-list" aria-label={tr("Barres modifiées", "Overridden bars")}>
          {overrides.map((o) => (
            <li key={o.index} className="addressable-row">
              <span>
                {barLabel(o.index, bars)} — {o.removed ? tr("supprimée", "removed") : `${o.shapeId ?? group.shapeId} Ø${o.diameter ?? group.diameter}${o.length ? ` ℓ=${o.length}` : ""}`}
              </span>
              <button type="button" onClick={() => removeOverride(o.index)} aria-label={tr("Retirer", "Remove override")}>×</button>
            </li>
          ))}
        </ul>
      )}

      <h4>{tr("Barres indépendantes / niveaux", "Independent bars / levels")}</h4>
      <button type="button" className="addressable-add-extra" onClick={addExtra}>
        {tr("+ Ajouter une barre", "+ Add a bar")}
      </button>
      <ul className="addressable-list" aria-label={tr("Barres indépendantes", "Independent bars")}>
        {extras.map((e) => (
          <li key={e.id} className="addressable-extra">
            <NumberField label="u (mm)" value={e.u} min={-2000} max={2000} step={5} onChange={(v) => patchExtra(e.id, { u: v })} />
            <NumberField label={tr("v / niveau (mm)", "v / level (mm)")} value={e.v} min={-2000} max={2000} step={5} onChange={(v) => patchExtra(e.id, { v })} />
            <NumberField label="Ø (mm)" value={e.diameter} min={6} max={40} step={1} onChange={(v) => patchExtra(e.id, { diameter: v })} />
            <button type="button" onClick={() => removeExtra(e.id)} aria-label={tr("Retirer", "Remove")}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
