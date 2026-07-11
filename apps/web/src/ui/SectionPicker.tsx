/**
 * 2D section picker (spec §7, [REF-UI-555]). A live cross-section diagram: every longitudinal bar is
 * a labelled, face-coloured dot at its real `(u,v)`. Click a bar to select it (synced to the 3D
 * highlight via the store's `selectedBars`); the host decides what a pick means — link two bars into
 * a cross-tie (F2) or a supplement. A parallel labelled button list is the keyboard/a11y path (§7.2,
 * invariant a11y-parity). Pure presentation over the engine's `result.bars`; binding stays index-based.
 *
 * **v1.0.6-fix R5 (F-D)** — this now renders **all 8 elements**, not just column/beam:
 *   • the frame + the concrete outline + the mark size come from the ONE `sectionFrame(result, cover)`
 *     seam (the engine's own `result.member` descriptor), so a slab draws as its true wide-thin box and a
 *     pile/circular column as its disc — no element branching here, ever;
 *   • a slab/stair **DISTRIBUTION** bar runs ACROSS the width (C1) and every one of them sits at `u = 0`,
 *     so drawing them as dots stacked N-deep on the centreline would be a lie. They render as the LINE
 *     they physically are, one per distinct level, and stay pickable.
 */
import { useStore } from "../store/useStore";
import { labeledBars, type LabeledBar } from "../engine/barLabels";
import { sectionFrame } from "../engine/sectionFrame";

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
  onPlace,
}: {
  /**
   * Pick a NATIVE (mat/cage) bar by index. **Optional since R5:** a native bar is only *addressable* on
   * column/beam (`barOverrides` / cross-ties). A slab's mat is a per-metre zone — its bars are driven by
   * spacing, not individually editable — so on the other six elements the host passes no `onPick` and the
   * mat renders as inert context. Making it clickable there would select into a dead end, which is the
   * very defect class this fix plan exists to kill (invariant 8: no silent inert edit).
   */
  onPick?: (index: number) => void;
  /** H7 ([v1.0.4]): when provided, standalone extra bars are rendered + pickable by their stable id. */
  onPickExtra?: (id: string) => void;
  selectedExtraId?: string | null;
  height?: number;
  /** v1.0.6 N5 (U4): when set (an add-tool is active), a click on the section drops a bar at the mapped
   *  `(u,v)`. The GPU/pointer path; the typed-coordinate twin in the palette is the a11y equivalent. */
  onPlace?: (u: number, v: number) => void;
}) {
  const result = useStore((s) => s.result);
  const cover = useStore((s) => s.doc.cover);
  const selectedBars = useStore((s) => s.selectedBars);
  const all = labeledBars(result.bars);
  // H7: independent extra bars live in `result.longBars` (not the layout `bars`), so render them here
  // at their own `(u,v)` with a distinct square marker + id label. Only when the host handles picks.
  const extras = onPickExtra ? (result.longBars ?? []).filter((lb) => lb.standalone) : [];

  // R2: ONE selection test, shared by the SVG dots and the a11y button list — they must never disagree
  // (invariant §0.3.3). Matches on the placed PARENT id so a row/bundle/layer highlights as one object.
  const extraSelected = (groupId: string) =>
    selectedExtraId !== null && groupId.split("#")[0] === selectedExtraId;

  // R5: split the mat. A DISTRIBUTION bar spans the width at its level — one line per distinct level (the
  // first bar at that level carries the pick, so selecting the line selects a real, solved bar index).
  const dots = all.filter((b) => !b.across);
  const lines: LabeledBar[] = [];
  for (const b of all) {
    if (b.across && !lines.some((l) => l.v === b.v)) lines.push(b);
  }

  const frame = sectionFrame(result, cover);
  const { b, h, markRadius: dotR } = frame;

  // N5: map a pointer event on the SVG back to the section (u,v) frame (v flipped: cy = -v). Guarded —
  // `getScreenCTM` is null under jsdom, so the pointer drop no-ops in tests (the typed twin is tested).
  const handlePlace = (e: React.MouseEvent<SVGRectElement>) => {
    if (!onPlace) return;
    const svg = e.currentTarget.ownerSVGElement;
    const ctm = svg?.getScreenCTM?.();
    if (!svg || !ctm || typeof svg.createSVGPoint !== "function") return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(ctm.inverse());
    onPlace(loc.x, -loc.y);
  };

  const barGroup = (bar: LabeledBar) => {
    const sel = selectedBars.includes(bar.index);
    const stroke = sel ? "#22d3ee" : "#0b0d10";
    const pickable = onPick
      ? {
          role: "button",
          tabIndex: 0,
          "aria-pressed": sel,
          "aria-label": bar.label,
          onClick: () => onPick(bar.index),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPick(bar.index);
            }
          },
        }
      : {};
    return (
      <g
        key={bar.index}
        data-bar-index={bar.index}
        className={`sp-bar ${onPick ? "" : "sp-bar-inert"} ${bar.across ? "sp-bar-across" : ""} ${sel ? "sp-bar-selected" : ""}`}
        {...pickable}
      >
        {bar.across ? (
          // the distribution layer: a true line across the width at its level (C1), not a dot
          <line
            x1={-b / 2 + frame.cover}
            y1={-bar.v}
            x2={b / 2 - frame.cover}
            y2={-bar.v}
            stroke={stroke === "#0b0d10" ? (FACE_FILL[bar.faceTag as string] ?? "#64748b") : stroke}
            strokeWidth={sel ? dotR * 0.8 : dotR * 0.45}
            strokeLinecap="round"
          />
        ) : (
          <circle
            cx={bar.u}
            cy={-bar.v}
            r={dotR}
            fill={FACE_FILL[bar.faceTag as string] ?? "#64748b"}
            stroke={stroke}
            strokeWidth={sel ? dotR * 0.5 : dotR * 0.18}
          />
        )}
        {!bar.across && (
          <text x={bar.u} y={-bar.v} className="sp-label" dominantBaseline="central" textAnchor="middle" fontSize={dotR * 1.5}>
            {bar.label}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="section-picker">
      <svg className={`section-picker-svg ${onPlace ? "sp-placing" : ""}`} viewBox={frame.viewBox} style={{ height }} role="img" aria-label="Coupe — sélecteur de barres">
        {/* N5 placement hit area — behind the bars (bar clicks still win); only active in an add-tool */}
        {onPlace && (
          <rect x={frame.view.x} y={frame.view.y} width={frame.view.w} height={frame.view.h} fill="transparent" className="sp-place-area" onClick={handlePlace} />
        )}
        {frame.envelope === "CIRCULAR" ? (
          <circle cx={0} cy={0} r={(frame.D ?? b) / 2} className="sp-concrete" />
        ) : (
          <rect x={-b / 2} y={-h / 2} width={b} height={h} className="sp-concrete" />
        )}
        {lines.map(barGroup)}
        {dots.map(barGroup)}
        {extras.map((e) => {
          const sel = extraSelected(e.groupId);
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
        {onPick &&
          [...lines, ...dots].map((bar) => (
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
              className={`sp-list-btn sp-list-extra ${extraSelected(e.groupId) ? "sp-list-btn-sel" : ""}`}
              aria-pressed={extraSelected(e.groupId)}
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
