/**
 * v1.0.6 N2 / Track U2 ([REF-UI-555]) — the ONE persistent section canvas. Before N2 the section
 * diagram (`SectionPicker`) was embedded THREE times (bar-by-bar / cross-tie / supplement), each with
 * its own pending-pick state and a different meaning for a click. N2 collapses them into this single
 * canvas whose behaviour is governed by the store's **active tool**:
 *   • `select` → pick one bar (drives the addressable-bar override target + the 3D highlight);
 *   • `link`   → pick two bars → a cross-tie, or bind the armed supplement (the driving panel sets what).
 * `SectionPicker` stays the pure SVG renderer (+ its keyboard/a11y button list, invariant §0.3.3); this
 * is the smart container that binds it to the store router. Session-only state — nothing enters `.rcfg`.
 */
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { SectionPicker } from "./SectionPicker";

export function SectionCanvas() {
  const lang = useStore((s) => s.lang);
  const tool = useStore((s) => s.sectionTool);
  const pickSectionBar = useStore((s) => s.pickSectionBar);
  const pickSectionExtra = useStore((s) => s.pickSectionExtra);
  const cancelLink = useStore((s) => s.cancelLink);
  const s = t(lang).sectionCanvas;
  const linking = tool === "link";

  return (
    <div
      className="section-canvas"
      role="group"
      aria-label={s.title}
      onKeyDown={(e) => {
        if (e.key === "Escape" && linking) {
          e.preventDefault();
          cancelLink();
        }
      }}
    >
      <div className={`section-canvas-status ${linking ? "linking" : ""}`} role="status" aria-live="polite">
        <span>{linking ? s.linkHint : s.selectHint}</span>
        {linking && (
          <button type="button" className="btn-mini" onClick={cancelLink}>
            {s.cancel}
          </button>
        )}
      </div>
      <SectionPicker onPick={pickSectionBar} onPickExtra={pickSectionExtra} />
    </div>
  );
}
