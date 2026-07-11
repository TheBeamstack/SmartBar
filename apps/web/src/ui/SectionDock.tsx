/**
 * v1.0.6 N4 / Track U1 ([REF-UI-830]) — the SECTION dock. A first-class, resizable/collapsible 2D
 * panel docked to the RIGHT of the always-on 3D. It hosts the ONE unified section canvas (the N2 pick
 * surface that drives the inspector + cross-tie/supplement links) and the coupe preview/manager — so
 * it **subsumes the old F4 Coupes bottom dock** ("the coupe IS the editable section", spec §Track U1).
 *
 * The section canvas is the interactive pick surface for the RECT elements (column/beam); every element
 * still gets the coupe preview (which works for all 8). Layout state (open/size) is session-only — it
 * never enters `.rcfg`. Resize + collapse have keyboard/pointer twins (a11y invariant §0.3.3).
 */
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { SectionCanvas } from "./SectionCanvas";
import { ToolPalette } from "./ToolPalette";
import { CoupePanel } from "./CoupePanel";

export function SectionDock() {
  const lang = useStore((s) => s.lang);
  const dock = useStore((s) => s.docks.section);
  const toggleDock = useStore((s) => s.toggleDock);
  const resizeDock = useStore((s) => s.resizeDock);
  const s = t(lang).workspace;

  if (!dock.open) {
    return (
      <button
        type="button"
        className="dock-reopen dock-reopen-v"
        aria-label={s.openDock}
        title={`${s.openDock} — ${s.sectionDock}`}
        onClick={() => toggleDock("section")}
      >
        ◧ {s.sectionDock}
      </button>
    );
  }

  // width-resize: the handle sits on the LEFT edge (the dock is on the right), so dragging left widens.
  const onResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = dock.size;
    const move = (ev: PointerEvent) => resizeDock("section", startW + (startX - ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <section className="dock section-dock" style={{ width: dock.size }} aria-label={s.sectionDock}>
      <div
        className="dock-resize dock-resize-v"
        role="separator"
        aria-orientation="vertical"
        aria-label={s.resizeDock}
        onPointerDown={onResize}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") resizeDock("section", dock.size + 20);
          else if (e.key === "ArrowRight") resizeDock("section", dock.size - 20);
        }}
        tabIndex={0}
      />
      <div className="dock-inner">
        <div className="dock-head">
          <span className="dock-title">{s.sectionDock}</span>
          <button type="button" className="dock-collapse" aria-label={s.collapseDock} title={s.collapseDock} onClick={() => toggleDock("section")}>
            ▸
          </button>
        </div>
        <div className="dock-body">
          {/* N5 (U4): the modal tool palette + placed-bar list — the drawing-first "add any bar" surface */}
          <ToolPalette />
          {/* R5 (F-D): the canvas is no longer gated on column/beam. It draws whatever section the ENGINE
              reports (`result.member` → `sectionFrame`), so all 8 elements get a drawing-board — a slab is
              a wide thin box with its mat as dots, a pile is a disc with its cage on the pitch circle. */}
          <SectionCanvas />
          <CoupePanel />
        </div>
      </div>
    </section>
  );
}
