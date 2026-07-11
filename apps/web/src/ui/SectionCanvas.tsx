/**
 * v1.0.6 N2 / Track U2 ([REF-UI-555]) — the ONE persistent section canvas. Before N2 the section
 * diagram (`SectionPicker`) was embedded THREE times (bar-by-bar / cross-tie / supplement), each with
 * its own pending-pick state and a different meaning for a click. N2 collapses them into this single
 * canvas whose behaviour is governed by the store's **active tool**:
 *   • `select` → pick one bar (drives the addressable-bar override target + the 3D highlight);
 *   • `link`   → pick two bars → a cross-tie, or bind the armed supplement (the driving panel sets what);
 *   • `add-*`  → **N5 (U4)**: a click drops the palette shape as the matching `PlacedBar` at the mapped `(u,v)`.
 * `SectionPicker` stays the pure SVG renderer (+ its keyboard/a11y button list, invariant §0.3.3); this
 * is the smart container that binds it to the store router. Session-only state — nothing enters `.rcfg`.
 */
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { SectionPicker } from "./SectionPicker";

const ADD_TOOLS = new Set(["add-single", "add-row", "add-bundle", "add-layer"]);

export function SectionCanvas() {
  const lang = useStore((s) => s.lang);
  const tool = useStore((s) => s.sectionTool);
  const pickSectionBar = useStore((s) => s.pickSectionBar);
  const pickSectionExtra = useStore((s) => s.pickSectionExtra);
  const placeInSection = useStore((s) => s.placeInSection);
  const cancelLink = useStore((s) => s.cancelLink);
  const s = t(lang).sectionCanvas;
  const tl = t(lang).tools;
  const linking = tool === "link";
  const placing = ADD_TOOLS.has(tool);

  const hint = linking ? s.linkHint : placing ? tl.placeHint : s.selectHint;

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
      <div className={`section-canvas-status ${linking ? "linking" : ""} ${placing ? "placing" : ""}`} role="status" aria-live="polite">
        <span>{hint}</span>
        {linking && (
          <button type="button" className="btn-mini" onClick={cancelLink}>
            {s.cancel}
          </button>
        )}
      </div>
      <SectionPicker
        onPick={pickSectionBar}
        onPickExtra={pickSectionExtra}
        onPlace={placing ? placeInSection : undefined}
      />
    </div>
  );
}
