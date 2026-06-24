/**
 * Top navbar (spec §8 ASCII): element ▼, code ▼ (BAEL only for P2), FR/EN, import/export
 * (stubbed in P2 — real I/O is P5; export stays disabled on a 🔴 FAIL per §7.9 export-lock),
 * plus the section-cut + perf-debug toggles.
 */
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";

export function Navbar() {
  const lang = useStore((s) => s.lang);
  const toggleLang = useStore((s) => s.toggleLang);
  const showSection = useStore((s) => s.showSection);
  const toggleSection = useStore((s) => s.toggleSection);
  const debugPerf = useStore((s) => s.debugPerf);
  const toggleDebugPerf = useStore((s) => s.toggleDebugPerf);
  const status = useStore((s) => s.result.status);
  const provisional = useStore((s) => s.result.provisional);
  const s = t(lang);

  const exportLocked = status === "FAIL";

  return (
    <header className="navbar">
      <div className="navbar-brand">RebarConfig</div>

      <label className="nav-field">
        {s.element}
        <select value="E-COL-01" disabled>
          <option value="E-COL-01">E-COL-01 — Poteau rectangulaire</option>
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
