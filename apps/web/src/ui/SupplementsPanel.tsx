/**
 * Supplemental reinforcement panel (spec §5.5, §8; v1.0.2 F7 [REF-UI-555]). The user picks an add-on
 * type, then **clicks two bars on the section diagram** to bind it (the SVG dots + the keyboard list
 * are the two a11y-equal paths; both resolve to the same stable indices via the picker). A broken
 * binding (a referenced bar was deleted) surfaces as a WARN row with a rebind prompt that re-binds to
 * the two currently selected bars. Bindings store stable indices, never coordinates (D-P3-4).
 */
import { useState } from "react";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { schemeManifest, supplementManifest } from "../engine/manifests";

export function SupplementsPanel() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const result = useStore((s) => s.result);
  const removeSupplement = useStore((s) => s.removeSupplement);
  const rebindSupplement = useStore((s) => s.rebindSupplement);
  const sectionLink = useStore((s) => s.sectionLink);
  const beginLink = useStore((s) => s.beginLink);
  const cancelLink = useStore((s) => s.cancelLink);
  const s = t(lang);

  const catalog = schemeManifest(doc.scheme).supplementalCatalog ?? [];

  const selectedBars = useStore((s) => s.selectedBars);
  const [supId, setSupId] = useState(catalog[0] ?? "");

  const label = (id: string) => {
    const m = supplementManifest(id);
    return (lang === "fr" ? m.label_fr : m.label_en) ?? id;
  };
  const diaFor = (id: string) =>
    supplementManifest(id).params?.find((p) => p.key === "diameter")?.default ?? 8;

  // a supplement instance is broken when the engine emitted a supplement:<id> WARN for it
  const warnFor = (instanceId: string) =>
    result.validation.find((v) => v.rule === `supplement:${instanceId}`);

  // v1.0.6 N2 (U2): arming "link" routes the shared SectionCanvas here — two bar picks bind this
  // supplement type (the store owns instance-id + group; the panel supplies which type + its Ø).
  const linkArmed = sectionLink?.kind === "supplement";
  const armLink = (id: string) => beginLink({ kind: "supplement", supplementId: id, diameter: diaFor(id) });

  return (
    <div className="supplements">
      <h3>{s.supplements.title}</h3>

      {catalog.length === 0 ? (
        <p className="muted">{s.supplements.none}</p>
      ) : (
        <div className="supp-add">
          <label className="field">
            <span className="field-label">{s.supplements.title}</span>
            <select
              value={supId}
              onChange={(e) => { setSupId(e.target.value); if (linkArmed) armLink(e.target.value); }}
              aria-label={s.supplements.title}
            >
              {catalog.map((id) => (
                <option key={id} value={id}>
                  {label(id)}
                </option>
              ))}
            </select>
          </label>
          <p className="muted sp-hint">{s.supplements.pickHint}</p>
          <button
            type="button"
            className={`supp-link ${linkArmed ? "link-armed" : ""}`}
            aria-pressed={linkArmed}
            onClick={() => (linkArmed ? cancelLink() : armLink(supId))}
          >
            {s.supplements.linkOnSection}
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
                    disabled={selectedBars.length < 2}
                    onClick={() => rebindSupplement(sup.instanceId, selectedBars.slice(0, 2))}
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
