/**
 * Cross-tie editor (spec §2.3, [REF-UI-756]). Replaces the v1.0.1 "Brins" (legs) number with a
 * picker-driven list of cross-ties (épingles) that engage real bar pairs: click two facing bars on
 * the section diagram to link them, or use a per-direction preset / "Auto (code)". A single hook
 * angle (90/135/180 or free) applies to every cross-tie of the element (owner decision, D-V102).
 * Works for the column tie AND the beam stirrup (same model — no element branching).
 */
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { isColumnDoc, isBeamDoc, type CrossTie } from "../engine/document";
import { autoCrossTies, presetCrossTies } from "../engine/crossTies";
import { barLabel } from "../engine/barLabels";
import { NumberInput } from "./NumberInput";

const HOOK_PRESETS = [90, 135, 180];

export function CrossTieEditor() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const result = useStore((s) => s.result);
  const setCrossTies = useStore((s) => s.setCrossTies);
  const setCrossTieHookAngle = useStore((s) => s.setCrossTieHookAngle);
  const sectionLink = useStore((s) => s.sectionLink);
  const beginLink = useStore((s) => s.beginLink);
  const cancelLink = useStore((s) => s.cancelLink);
  const s = t(lang).crossTies;

  const cfg = isColumnDoc(doc) ? doc.tie : isBeamDoc(doc) ? doc.stirrup : null;
  if (!cfg) return null;
  const crossTies = cfg.crossTies;
  const hookAngle = cfg.crossTieHookAngle;
  const bars = result.bars;

  const sameTie = (a: CrossTie, b: CrossTie) =>
    (a.barA === b.barA && a.barB === b.barB) || (a.barA === b.barB && a.barB === b.barA);
  const mergeTies = (extra: CrossTie[]) => {
    const out = [...crossTies];
    for (const ct of extra) if (!out.some((e) => sameTie(e, ct))) out.push(ct);
    setCrossTies(out);
  };

  // v1.0.6 N2 (U2): arming "link" routes the shared SectionCanvas here — two bar picks make a cross-tie.
  const linkArmed = sectionLink?.kind === "crosstie";

  const tieName = (ct: CrossTie) =>
    `${barLabel(ct.barA, bars)} ↔ ${barLabel(ct.barB, bars)}`;

  return (
    <div className="crosstie-editor">
      <h3>{s.title}</h3>
      <p className="muted sp-hint">{s.hint}</p>

      <button
        type="button"
        className={`crosstie-link ${linkArmed ? "link-armed" : ""}`}
        aria-pressed={linkArmed}
        onClick={() => (linkArmed ? cancelLink() : beginLink({ kind: "crosstie" }))}
      >
        {s.linkOnSection}
      </button>

      <div className="crosstie-actions">
        <button type="button" onClick={() => mergeTies(autoCrossTies(bars))}>{s.auto}</button>
        <button type="button" onClick={() => mergeTies(presetCrossTies(bars, "vertical"))}>{s.presetV}</button>
        <button type="button" onClick={() => mergeTies(presetCrossTies(bars, "horizontal"))}>{s.presetH}</button>
        {crossTies.length > 0 && (
          <button type="button" className="crosstie-clear" onClick={() => setCrossTies([])}>{s.clear}</button>
        )}
      </div>

      <div className="crosstie-hook">
        <span className="field-label">{s.hookAngle}</span>
        <div className="crosstie-hook-presets">
          {HOOK_PRESETS.map((a) => (
            <button
              type="button"
              key={a}
              className={`hook-preset ${hookAngle === a ? "hook-preset-on" : ""}`}
              aria-pressed={hookAngle === a}
              onClick={() => setCrossTieHookAngle(a)}
            >
              {a}°
            </button>
          ))}
        </div>
        <NumberInput label={s.hookAngleFree} value={hookAngle} min={45} max={180} step={5} onChange={(v) => setCrossTieHookAngle(v)} />
      </div>

      <ul className="crosstie-list">
        {crossTies.length === 0 ? (
          <li className="muted">{s.none}</li>
        ) : (
          crossTies.map((ct, i) => (
            <li key={`${ct.barA}-${ct.barB}-${i}`} className="crosstie-row">
              <span className="crosstie-name">{tieName(ct)}</span>
              <button type="button" className="crosstie-remove" onClick={() => setCrossTies(crossTies.filter((_, k) => k !== i))}>
                {t(lang).supplements.remove}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
