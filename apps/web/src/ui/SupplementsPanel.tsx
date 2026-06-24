/**
 * Supplemental reinforcement panel (spec §5.5, §8). Lists the active scheme's construction-valid
 * add-ons; the user adds one and binds it to base bars **by index** (the keyboard/a11y path — the
 * 3D click path produces the identical binding via nearestBarIndex, see binding_keyboard.spec).
 * A broken binding (a referenced bar was deleted) surfaces as a WARN row with a rebind prompt.
 *
 * Bindings store stable indices, never coordinates — so a base-param change re-solves the add-on.
 */
import { useState } from "react";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { schemeManifest, supplementManifest } from "../engine/manifests";
import { isColumnDoc } from "../engine/document";

let instanceCounter = 0;
const nextInstanceId = () => `S${++instanceCounter}`;

export function SupplementsPanel() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const result = useStore((s) => s.result);
  const addSupplement = useStore((s) => s.addSupplement);
  const removeSupplement = useStore((s) => s.removeSupplement);
  const rebindSupplement = useStore((s) => s.rebindSupplement);
  const s = t(lang);

  const catalog = schemeManifest(doc.scheme).supplementalCatalog ?? [];
  const baseGroupId = isColumnDoc(doc) ? doc.longitudinal.groupId : doc.span.groupId;
  const barCount = result.bars.length;

  const [supId, setSupId] = useState(catalog[0] ?? "");
  const [bar1, setBar1] = useState(0);
  const [bar2, setBar2] = useState(Math.min(2, Math.max(0, barCount - 1)));

  const label = (id: string) => {
    const m = supplementManifest(id);
    return (lang === "fr" ? m.label_fr : m.label_en) ?? id;
  };

  // a supplement instance is broken when the engine emitted a supplement:<id> WARN for it
  const warnFor = (instanceId: string) =>
    result.validation.find((v) => v.rule === `supplement:${instanceId}`);

  const onAdd = () => {
    if (!supId) return;
    const man = supplementManifest(supId);
    const defaultDia = man.params?.find((p) => p.key === "diameter")?.default ?? 8;
    addSupplement({
      instanceId: nextInstanceId(),
      supplementId: supId,
      group: baseGroupId,
      barIndices: [bar1, bar2],
      diameter: defaultDia,
    });
  };

  return (
    <div className="supplements">
      <h3>{s.supplements.title}</h3>

      {catalog.length === 0 ? (
        <p className="muted">{s.supplements.none}</p>
      ) : (
        <div className="supp-add">
          <label className="field">
            <span className="field-label">{s.supplements.title}</span>
            <select value={supId} onChange={(e) => setSupId(e.target.value)} aria-label={s.supplements.title}>
              {catalog.map((id) => (
                <option key={id} value={id}>
                  {label(id)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{s.supplements.bar1}</span>
            <input
              type="number"
              className="field-num"
              min={0}
              max={Math.max(0, barCount - 1)}
              value={bar1}
              aria-label={s.supplements.bar1}
              onChange={(e) => setBar1(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span className="field-label">{s.supplements.bar2}</span>
            <input
              type="number"
              className="field-num"
              min={0}
              max={Math.max(0, barCount - 1)}
              value={bar2}
              aria-label={s.supplements.bar2}
              onChange={(e) => setBar2(Number(e.target.value))}
            />
          </label>
          <button type="button" onClick={onAdd}>
            {s.supplements.add}
          </button>
        </div>
      )}

      <ul className="supp-list">
        {doc.supplements.map((sup) => {
          const warn = warnFor(sup.instanceId);
          return (
            <li key={sup.instanceId} className={`supp-row ${warn ? "tier-2" : "tier-3"}`}>
              <span className="supp-id">{label(sup.supplementId)}</span>
              <span className="supp-meta">
                {s.supplements.boundTo} {sup.barIndices.join(", ")}
              </span>
              {warn && (
                <span className="supp-warn">
                  🟠 {lang === "fr" ? warn.message_fr : warn.message_en}
                  <button
                    type="button"
                    onClick={() => rebindSupplement(sup.instanceId, [bar1, bar2])}
                  >
                    {s.supplements.rebind}
                  </button>
                </span>
              )}
              <button type="button" className="supp-remove" onClick={() => removeSupplement(sup.instanceId)}>
                {s.supplements.remove}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
