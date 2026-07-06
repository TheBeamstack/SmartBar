/**
 * 2D section picker (spec §7, [REF-UI-555]). A live cross-section diagram: every longitudinal bar is
 * a labelled, face-coloured dot at its real `(u,v)`. Click a bar to select it (synced to the 3D
 * highlight via the store's `selectedBars`); the host decides what a pick means — link two bars into
 * a cross-tie (F2) or a supplement. A parallel labelled button list is the keyboard/a11y path (§7.2,
 * invariant a11y-parity). Pure presentation over the engine's `result.bars`; binding stays index-based.
 */
import { useStore } from "../store/useStore";
import { labeledBars } from "../engine/barLabels";

const FACE_FILL: Record<string, string> = {
  TOP: "#3b82f6",
  BOTTOM: "#22c55e",
  LEFT: "#f59e0b",
  RIGHT: "#a855f7",
  CIRC: "#64748b",
};

export function SectionPicker({
  onPick,
  onPickExtra,
  selectedExtraId = null,
  height = 220,
}: {
  onPick: (index: number) => void;
  /** H7 ([v1.0.4]): when provided, standalone extra bars are rendered + pickable by their stable id. */
  onPickExtra?: (id: string) => void;
  selectedExtraId?: string | null;
  height?: number;
}) {
  const result = useStore((s) => s.result);
  const selectedBars = useStore((s) => s.selectedBars);
  const bars = labeledBars(result.bars);
  // H7: independent extra bars live in `result.longBars` (not the layout `bars`), so render them here
  // at their own `(u,v)` with a distinct square marker + id label. Only when the host handles picks.
  const extras = onPickExtra ? (result.longBars ?? []).filter((lb) => lb.standalone) : [];

  const m = result.member;
  const b = m.b ?? m.D ?? 400;
  const h = m.h ?? m.D ?? 400;
  const pad = Math.max(b, h) * 0.16 + 20;
  const dotR = Math.max(b, h) * 0.028 + 6;
  const vb = `${-b / 2 - pad} ${-h / 2 - pad} ${b + 2 * pad} ${h + 2 * pad}`;

  return (
    <div className="section-picker">
      <svg className="section-picker-svg" viewBox={vb} style={{ height }} role="img" aria-label="Coupe — sélecteur de barres">
        {m.envelope === "CIRCULAR" ? (
          <circle cx={0} cy={0} r={(m.D ?? 400) / 2} className="sp-concrete" />
        ) : (
          <rect x={-b / 2} y={-h / 2} width={b} height={h} className="sp-concrete" />
        )}
        {bars.map((bar) => {
          const sel = selectedBars.includes(bar.index);
          return (
            <g
              key={bar.index}
              role="button"
              tabIndex={0}
              aria-pressed={sel}
              aria-label={bar.label}
              data-bar-index={bar.index}
              className={`sp-bar ${sel ? "sp-bar-selected" : ""}`}
              onClick={() => onPick(bar.index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(bar.index);
                }
              }}
            >
              <circle cx={bar.u} cy={-bar.v} r={dotR} fill={FACE_FILL[bar.faceTag as string] ?? "#64748b"} stroke={sel ? "#22d3ee" : "#0b0d10"} strokeWidth={sel ? dotR * 0.5 : dotR * 0.18} />
              <text x={bar.u} y={-bar.v} className="sp-label" dominantBaseline="central" textAnchor="middle" fontSize={dotR * 1.5}>
                {bar.label}
              </text>
            </g>
          );
        })}
        {extras.map((e) => {
          const sel = e.groupId === selectedExtraId;
          return (
            <g
              key={e.groupId}
              role="button"
              tabIndex={0}
              aria-pressed={sel}
              aria-label={e.groupId}
              data-extra-id={e.groupId}
              className={`sp-bar sp-extra ${sel ? "sp-bar-selected" : ""}`}
              onClick={() => onPickExtra!(e.groupId)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  onPickExtra!(e.groupId);
                }
              }}
            >
              <rect x={e.position.u - dotR} y={-e.position.v - dotR} width={dotR * 2} height={dotR * 2} fill="#e11d48" stroke={sel ? "#22d3ee" : "#0b0d10"} strokeWidth={sel ? dotR * 0.5 : dotR * 0.18} />
              <text x={e.position.u} y={-e.position.v} className="sp-label" dominantBaseline="central" textAnchor="middle" fontSize={dotR * 1.2}>
                {e.groupId}
              </text>
            </g>
          );
        })}
      </svg>
      {/* keyboard / a11y fallback: the same bars as a labelled button row (identical onPick) */}
      <ul className="sp-list" aria-label="Barres (liste)">
        {bars.map((bar) => (
          <li key={bar.index}>
            <button
              type="button"
              className={`sp-list-btn ${selectedBars.includes(bar.index) ? "sp-list-btn-sel" : ""}`}
              aria-pressed={selectedBars.includes(bar.index)}
              onClick={() => onPick(bar.index)}
            >
              {bar.label}
            </button>
          </li>
        ))}
        {extras.map((e) => (
          <li key={e.groupId}>
            <button
              type="button"
              className={`sp-list-btn sp-list-extra ${e.groupId === selectedExtraId ? "sp-list-btn-sel" : ""}`}
              aria-pressed={e.groupId === selectedExtraId}
              onClick={() => onPickExtra!(e.groupId)}
            >
              {e.groupId}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
