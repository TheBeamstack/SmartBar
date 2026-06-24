/**
 * Top navbar (spec §8 ASCII): element ▼ (column | beam), scheme ▼ (the catalog for that
 * element, §5.3), code ▼ (BAEL only for v1.0), expert toggle (§5.6), FR/EN, import/export
 * (export disabled on a 🔴 FAIL per §7.9 export-lock — exporters themselves are P5), plus the
 * section-cut + perf-debug toggles.
 */
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { ELEMENTS, schemesForElement } from "../engine/manifests";
import type { ElementId } from "../engine/document";

export function Navbar() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const selectElement = useStore((s) => s.selectElement);
  const selectScheme = useStore((s) => s.selectScheme);
  const expert = useStore((s) => s.expert);
  const toggleExpert = useStore((s) => s.toggleExpert);
  const toggleLang = useStore((s) => s.toggleLang);
  const showSection = useStore((s) => s.showSection);
  const toggleSection = useStore((s) => s.toggleSection);
  const debugPerf = useStore((s) => s.debugPerf);
  const toggleDebugPerf = useStore((s) => s.toggleDebugPerf);
  const status = useStore((s) => s.result.status);
  const provisional = useStore((s) => s.result.provisional);
  const s = t(lang);

  const exportLocked = status === "FAIL";
  const schemes = schemesForElement(doc.element);
  const label = (m: { label_fr?: string; label_en?: string; id: string }) =>
    (lang === "fr" ? m.label_fr : m.label_en) ?? m.id;

  return (
    <header className="navbar">
      <div className="navbar-brand">RebarConfig</div>

      <label className="nav-field">
        {s.element}
        <select
          value={doc.element}
          aria-label={s.element}
          onChange={(e) => selectElement(e.target.value as ElementId)}
        >
          {Object.values(ELEMENTS).map((el) => (
            <option key={el.id} value={el.id}>
              {el.id} — {label(el as { label_fr?: string; label_en?: string; id: string })}
            </option>
          ))}
        </select>
      </label>

      <label className="nav-field">
        {s.scheme}
        <select value={doc.scheme} aria-label={s.scheme} onChange={(e) => selectScheme(e.target.value)}>
          {schemes.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {label(sc as { label_fr?: string; label_en?: string; id: string })}
            </option>
          ))}
        </select>
      </label>

      <label className="nav-field">
        {s.code}
        <select value="BAEL" disabled>
          <option value="BAEL">BAEL-FR</option>
        </select>
      </label>

      <div className="navbar-spacer" />

      {provisional && <span className="provisional-pill" title={s.provisionalWarning}>⚠ provisoire</span>}

      <button
        type="button"
        className={expert ? "active" : ""}
        onClick={toggleExpert}
        aria-pressed={expert}
      >
        {s.expert}
      </button>
      <button type="button" className={showSection ? "active" : ""} onClick={toggleSection}>
        {s.sectionCut}
      </button>
      <button type="button" className={debugPerf ? "active" : ""} onClick={toggleDebugPerf}>
        perf
      </button>
      <button type="button" onClick={toggleLang} aria-label={s.language}>
        {lang === "fr" ? "FR" : "EN"}
      </button>

      <button type="button" disabled>{s.importBtn}</button>
      <button
        type="button"
        disabled={exportLocked}
        title={exportLocked ? s.exportLocked : s.exportBtn}
      >
        {s.exportBtn}
      </button>
    </header>
  );
}
