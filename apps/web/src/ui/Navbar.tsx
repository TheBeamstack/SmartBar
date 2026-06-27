/**
 * Top navbar (spec §8 ASCII): element ▼ (column | beam), scheme ▼ (the catalog for that element,
 * §5.3), code ▼ (BAEL only for v1.0), expert toggle (§5.6), FR/EN, the Coupes/BBS panel toggles,
 * and Import / Export.
 *
 * P5 wires the real export engines (`@rebarconfig/exporters`): the Export menu downloads the PDF
 * sheet, the DXF drawing, the BBS (JSON) and the `.rcfg` project. The drawing deliverables (PDF/DXF)
 * are disabled on a 🔴 FAIL (export-lock, §7.9); the schedule and the project file always save (a
 * failing project must still be inspectable + persistable). Import loads a `.rcfg` back into the store.
 */
import { useRef, type ChangeEvent } from "react";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { ELEMENTS, schemesForElement } from "../engine/manifests";
import type { ElementId } from "../engine/document";
import { projectToRcfg } from "../engine/projectRcfg";
import { solveDoc } from "../engine/solveDoc";
import {
  exportPdf,
  exportDxf,
  exportBbsJson,
  exportRcfg,
  exportProjectPdf,
  exportProjectDxf,
  exportProjectBbsJson,
  type ProjectExportType,
} from "../engine/exportActions";
import { parseRcfg } from "@rebarconfig/exporters";

export function Navbar() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const result = useStore((s) => s.result);
  const cuts = useStore((s) => s.cuts);
  const selectElement = useStore((s) => s.selectElement);
  const selectScheme = useStore((s) => s.selectScheme);
  const expert = useStore((s) => s.expert);
  const toggleExpert = useStore((s) => s.toggleExpert);
  const toggleLang = useStore((s) => s.toggleLang);
  const showSection = useStore((s) => s.showSection);
  const toggleSection = useStore((s) => s.toggleSection);
  const debugPerf = useStore((s) => s.debugPerf);
  const toggleDebugPerf = useStore((s) => s.toggleDebugPerf);
  const bottomPanel = useStore((s) => s.bottomPanel);
  const setBottomPanel = useStore((s) => s.setBottomPanel);
  const loadProject = useStore((s) => s.loadProject);
  const syncActiveInstance = useStore((s) => s.syncActiveInstance);
  const instances = useStore((s) => s.instances);
  const activeInstanceId = useStore((s) => s.activeInstanceId);
  const status = useStore((s) => s.result.status);
  const provisional = useStore((s) => s.result.provisional);
  const s = t(lang);

  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

  const exportLocked = status === "FAIL";
  // Combined project export set: the active type uses the live result/cuts; others are re-solved.
  const projectTypes: ProjectExportType[] = instances.map((i) =>
    i.id === activeInstanceId
      ? { result, mark: i.mark, quantity: i.quantity, cuts }
      : { result: solveDoc(i.doc), mark: i.mark, quantity: i.quantity, cuts: i.cuts },
  );
  const isProject = projectTypes.length > 1;
  const projectLocked = projectTypes.some((t) => t.result.status === "FAIL");
  const schemes = schemesForElement(doc.element);
  const label = (m: { label_fr?: string; label_en?: string; id: string }) =>
    (lang === "fr" ? m.label_fr : m.label_en) ?? m.id;

  const closeMenu = () => menuRef.current?.removeAttribute("open");

  const onExportPdf = () => {
    closeMenu();
    // export-lock: buildPdf throws on FAIL; the item is disabled, this guards the race anyway.
    void exportPdf(result, cuts).catch(() => undefined);
  };
  const onExportDxf = () => {
    closeMenu();
    exportDxf(result, cuts);
  };
  const onExportBbs = () => {
    closeMenu();
    exportBbsJson(result);
  };
  const onExportRcfg = () => {
    closeMenu();
    // save the WHOLE project (all element types), v1.1 envelope (§10 / D-P7-1).
    exportRcfg(projectToRcfg(syncActiveInstance()));
  };
  const onExportProjectPdf = () => {
    closeMenu();
    void exportProjectPdf(projectTypes).catch(() => undefined); // per-project lock throws on FAIL
  };
  const onExportProjectDxf = () => {
    closeMenu();
    exportProjectDxf(projectTypes);
  };
  const onExportProjectBbs = () => {
    closeMenu();
    exportProjectBbsJson(projectTypes);
  };

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      loadProject(parseRcfg(await file.text()));
    } catch {
      // a malformed file is ignored (a P6 toast will surface the parse error)
    }
  };

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
      <button
        type="button"
        className={bottomPanel === "coupes" ? "active" : ""}
        onClick={() => setBottomPanel("coupes")}
        aria-pressed={bottomPanel === "coupes"}
      >
        {s.coupes.title}
      </button>
      <button
        type="button"
        className={bottomPanel === "bbs" ? "active" : ""}
        onClick={() => setBottomPanel("bbs")}
        aria-pressed={bottomPanel === "bbs"}
      >
        BBS
      </button>
      <button
        type="button"
        className={bottomPanel === "project" ? "active" : ""}
        onClick={() => setBottomPanel("project")}
        aria-pressed={bottomPanel === "project"}
      >
        {s.project.title}
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

      <input
        ref={fileRef}
        type="file"
        accept=".rcfg,.json,application/json"
        style={{ display: "none" }}
        aria-label={s.importBtn}
        onChange={onImportFile}
      />
      <button type="button" onClick={() => fileRef.current?.click()}>
        {s.importBtn}
      </button>

      <details className="export-menu" ref={menuRef}>
        <summary>{s.exports.menu}</summary>
        <div className="export-menu-items" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={onExportPdf}
            disabled={exportLocked}
            title={exportLocked ? s.exportLocked : s.exports.pdf}
          >
            {s.exports.pdf}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onExportDxf}
            disabled={exportLocked}
            title={exportLocked ? s.exportLocked : s.exports.dxf}
          >
            {s.exports.dxf}
          </button>
          <button type="button" role="menuitem" onClick={onExportBbs}>
            {s.exports.bbs}
          </button>
          <button type="button" role="menuitem" onClick={onExportRcfg}>
            {s.exports.rcfg}
          </button>
          {isProject && (
            <>
              <div className="export-menu-group" role="separator">
                {s.exports.projectGroup}
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={onExportProjectPdf}
                disabled={projectLocked}
                title={projectLocked ? s.exports.projectLocked : s.exports.projectPdf}
              >
                {s.exports.projectPdf}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={onExportProjectDxf}
                disabled={projectLocked}
                title={projectLocked ? s.exports.projectLocked : s.exports.projectDxf}
              >
                {s.exports.projectDxf}
              </button>
              <button type="button" role="menuitem" onClick={onExportProjectBbs}>
                {s.exports.projectBbs}
              </button>
            </>
          )}
        </div>
      </details>
    </header>
  );
}
