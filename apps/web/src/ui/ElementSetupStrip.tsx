/**
 * v1.0.6 N3 / Track U3 ([REF-UI-820], answers U6-IA) — the compact, ALWAYS-VISIBLE element-setup
 * strip. Element-level setup (code pack + the primary dimensions + cover) used to be a tab-flip away
 * (Géométrie / Projet). The strip surfaces the load-bearing few inline above the drawing so they are
 * never hidden behind the "Avancé" form. The full geometry/material/exposure/seismic controls remain
 * in the tabbed form (the advanced fallback) — this is a convenience surface, not a replacement.
 *
 * Which fields belong here vs the advanced form is an owner IA preference (spec §8) — this ships a
 * sensible default (code + b/h + H/L + cover) and is trivially re-scoped.
 */
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { NumberInput } from "./NumberInput";
import { isColumnDoc, isBeamDoc, type CodePackId } from "../engine/document";

export function ElementSetupStrip() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setGeometry = useStore((s) => s.setGeometry);
  const setBeamGeometry = useStore((s) => s.setBeamGeometry);
  const setCover = useStore((s) => s.setCover);
  const setCodePack = useStore((s) => s.setCodePack);
  const s = t(lang);

  const col = isColumnDoc(doc);
  const beam = isBeamDoc(doc);

  return (
    <div className="setup-strip" aria-label={s.setup.title}>
      <div className="setup-row">
        <span className="setup-element">{doc.element}</span>
        <label className="field setup-code">
          <span className="field-label">{s.code}</span>
          <select value={doc.codePack ?? "BAEL"} aria-label={s.codePack} onChange={(e) => setCodePack(e.target.value as CodePackId)}>
            <option value="BAEL">BAEL</option>
            <option value="EC2">EC2</option>
          </select>
        </label>
      </div>
      {(col || beam) && (
        <div className="setup-dims">
          <NumberInput label={s.section.b} value={doc.geometry.b} min={150} max={1200} step={10} onChange={(v) => (col ? setGeometry({ b: v }) : setBeamGeometry({ b: v }))} />
          <NumberInput label={s.section.h} value={doc.geometry.h} min={150} max={1500} step={10} onChange={(v) => (col ? setGeometry({ h: v }) : setBeamGeometry({ h: v }))} />
          {col ? (
            <NumberInput label={s.section.height} value={doc.geometry.H} min={500} max={8000} step={50} onChange={(v) => setGeometry({ H: v })} />
          ) : (
            <NumberInput label={s.beam.span} value={doc.geometry.L} min={1000} max={12000} step={100} onChange={(v) => setBeamGeometry({ L: v })} />
          )}
          <NumberInput label={s.cover} value={doc.cover} min={15} max={75} step={1} onChange={setCover} />
        </div>
      )}
    </div>
  );
}
