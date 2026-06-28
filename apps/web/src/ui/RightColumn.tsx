/**
 * F4 ([REF-UI-830]) — the right-hand workspace column: Verification (the checks), Project (the
 * multi-element manager + takeoff) and BBS (the schedule), each in a **collapsible, independently
 * scrollable** section. An expand toggle widens the whole column leftward over the 3D for focused
 * reading. Layout-only — no engine change; it just relocates the existing panels and adds the
 * open/collapse + expand flags (store `rightPanels` / `expandPanels`).
 */
import type { ReactNode } from "react";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { AlertsPanel } from "./AlertsPanel";
import { ProjectPanel } from "./ProjectPanel";
import { BbsPanel } from "./BbsPanel";

function RightSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`right-section ${open ? "open" : "collapsed"}`} aria-label={title}>
      <button type="button" className="right-section-head" aria-expanded={open} onClick={onToggle}>
        <span className="caret" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span>{title}</span>
      </button>
      {open && <div className="right-section-body">{children}</div>}
    </section>
  );
}

export function RightColumn() {
  const lang = useStore((s) => s.lang);
  const rightPanels = useStore((s) => s.rightPanels);
  const toggleRightPanel = useStore((s) => s.toggleRightPanel);
  const expandPanels = useStore((s) => s.expandPanels);
  const toggleExpandPanels = useStore((s) => s.toggleExpandPanels);
  const s = t(lang);

  return (
    <aside className={`right-column ${expandPanels ? "expanded" : ""}`} aria-label={s.alerts}>
      <div className="right-column-bar">
        <button
          type="button"
          className={`right-expand-btn ${expandPanels ? "active" : ""}`}
          aria-pressed={expandPanels}
          title={s.workspace.expandHint}
          onClick={toggleExpandPanels}
        >
          {expandPanels ? `⇥ ${s.workspace.collapse}` : `⇤ ${s.workspace.expand}`}
        </button>
      </div>
      <RightSection title={s.alerts} open={rightPanels.verification} onToggle={() => toggleRightPanel("verification")}>
        <AlertsPanel />
      </RightSection>
      <RightSection title={s.project.title} open={rightPanels.project} onToggle={() => toggleRightPanel("project")}>
        <ProjectPanel />
      </RightSection>
      <RightSection title="BBS" open={rightPanels.bbs} onToggle={() => toggleRightPanel("bbs")}>
        <BbsPanel />
      </RightSection>
    </aside>
  );
}
