/**
 * v1.0.6 N6 / Track U5 ([REF-UI-811]) — the EDITABLE elevation dock. N4 built this as a read-only view
 * over the shared `buildElevationFiche(result)` (so screen == paper); N6 makes it a **canvas over the
 * v1.0.5 per-bar station model**: for the selected bar, drag its ends (curtailment) or drop laps; drag a
 * stirrup/tie zone boundary. Every gesture is a pointer position → a snapped member-axis STATION,
 * mapped by the pure `engine/elevation.ts` helpers and committed through the store's N6 actions — the
 * SAME actions the inspector's numeric twins + the `RegionEditor` table call, so drawing == number
 * (invariant §0.3.3). The pointer drag is owner-GPU-verified (`getScreenCTM` is null under jsdom, so it
 * no-ops in tests — the pure helpers, the store actions and the numeric twins are the headless gate).
 *
 * Layout state (open/size) is session-only — never in `.rcfg`.
 */
import { useMemo, useRef, useState } from "react";
import { buildElevationFiche, memberAttitude, orientPoint, type ElevationFiche, type MemberAttitude } from "@rebarconfig/exporters";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { fitElevation, screenToStation, selectedBarStations, memberRunLength, type ElevationTransform } from "../engine/elevation";
import { effectiveRegions } from "../engine/regions";
import { isColumnDoc, isBeamDoc } from "../engine/document";

const W = 640, H = 240, PAD = 26;

/** What a live pointer drag is currently editing (for the store dispatch + the readout). */
type DragTarget =
  | { kind: "curtail"; end: "start" | "end" }
  | { kind: "boundary"; index: number };

function EditableElevation({ fiche }: { fiche: ElevationFiche }) {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const curtailSelectedBar = useStore((s) => s.curtailSelectedBar);
  const moveStirrupRegionBoundary = useStore((s) => s.moveStirrupRegionBoundary);
  const se = t(lang).elevation;
  const svgRef = useRef<SVGSVGElement>(null);
  const [live, setLive] = useState<number | null>(null);

  const transform: ElevationTransform = useMemo(() => fitElevation(fiche, { W, H, pad: PAD }), [fiche]);
  const att: MemberAttitude = fiche.attitude;
  const L = memberRunLength(doc);

  // section half-depth (the height a station handle spans), matching buildElevationFiche's concrete box.
  const halfH = useMemo(() => {
    const ys = fiche.concrete.map((p) => (att === "VERTICAL" ? p.x : p.y));
    return (Math.max(...ys) - Math.min(...ys)) / 2 || 1;
  }, [fiche, att]);

  const toScreen = (station: number, height: number) => {
    const d = orientPoint(att, station, height);
    return { sx: transform.px(d.x), sy: transform.py(d.y) };
  };

  // map a pointer's client coords → snapped station (guarded; getScreenCTM is null under jsdom).
  const clientToStation = (clientX: number, clientY: number): number | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM?.();
    if (!svg || !ctm || typeof svg.createSVGPoint !== "function") return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const loc = pt.matrixTransform(ctm.inverse());
    return screenToStation(fiche, transform, loc.x, loc.y, L, 10);
  };

  const commit = (target: DragTarget, station: number) => {
    if (target.kind === "curtail") curtailSelectedBar(target.end, station);
    else moveStirrupRegionBoundary(target.index, station);
  };

  const startDrag = (target: DragTarget) => (e: React.PointerEvent<SVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      const st = clientToStation(ev.clientX, ev.clientY);
      if (st === null) return;
      setLive(st);
      commit(target, st);
    };
    const up = () => {
      setLive(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const concrete = fiche.concrete.map((p) => `${transform.px(p.x)},${transform.py(p.y)}`).join(" ");

  // the selected bar's curtailment ends (draggable) + its splice markers.
  const st = selectedBarStations(doc, selection);
  const lane = -halfH * 0.55; // a readable curtailment rail below the section centreline

  // the tie/stirrup spacing regions → interior boundaries (draggable). Column/beam only.
  const tset = isColumnDoc(doc) ? doc.tie : isBeamDoc(doc) ? doc.stirrup : null;
  const regions = tset ? effectiveRegions(tset.regions, L, tset.spacing) : [];
  const boundaries = regions.slice(0, -1).map((r, i) => ({ index: i, station: r.to }));

  return (
    <svg ref={svgRef} className="elevation-svg elevation-svg-edit" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={se.editHint}>
      <polygon points={concrete} fill="#1b2230" stroke="#9aa4b2" strokeWidth={1.2} />
      {fiche.bars.map((b, i) => (
        <polyline key={`b${i}`} points={b.points.map((p) => `${transform.px(p.x)},${transform.py(p.y)}`).join(" ")} fill="none" stroke="#d24b4b" strokeWidth={1.3} />
      ))}
      {fiche.marks.map((m, i) => (
        <text key={`m${i}`} x={transform.px(m.at.x) + 3} y={transform.py(m.at.y) - 3} fontSize={9} fill="#e6e9ee">{m.text}</text>
      ))}
      {fiche.tieCallouts.map((c, i) => (
        <text key={`t${i}`} x={transform.px(c.at.x)} y={transform.py(c.at.y) - 3} fontSize={8} fill="#9aa4b2" textAnchor="middle">{c.text}</text>
      ))}

      {/* editable stirrup/tie zone boundaries (drag → moveStirrupRegionBoundary == the RegionEditor table) */}
      {boundaries.map((bd) => {
        const a = toScreen(bd.station, -halfH);
        const b = toScreen(bd.station, halfH);
        return (
          <line
            key={`zb${bd.index}`}
            className="elev-boundary"
            x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy}
            stroke="#5aa0ff" strokeWidth={2} strokeDasharray="4 3"
            onPointerDown={startDrag({ kind: "boundary", index: bd.index })}
          />
        );
      })}

      {/* the selected bar's curtailment: a rail from start→end with two draggable end caps + splices */}
      {st && (
        <g className="elev-curtail">
          {(() => {
            const a = toScreen(st.start, lane);
            const b = toScreen(st.end, lane);
            return <line className="elev-rail" x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke="#6fd08c" strokeWidth={2} />;
          })()}
          {(["start", "end"] as const).map((end) => {
            const p = toScreen(end === "start" ? st.start : st.end, lane);
            return (
              <circle
                key={end}
                className="elev-handle"
                cx={p.sx} cy={p.sy} r={6}
                fill="#6fd08c"
                onPointerDown={startDrag({ kind: "curtail", end })}
              />
            );
          })}
          {st.splices.map((sp) => {
            const p = toScreen(sp.at, lane);
            return <rect key={`sp${sp.kind}${sp.at}`} className="elev-splice" x={p.sx - 3} y={p.sy - 7} width={6} height={14} fill={sp.kind === "lap" ? "#e0b64d" : "#c77dff"} />;
          })}
        </g>
      )}

      {live !== null && (
        <text className="elev-live" x={W / 2} y={16} fontSize={11} fill="#e6e9ee" textAnchor="middle">{se.live}: {live} mm</text>
      )}
    </svg>
  );
}

export function ElevationDock() {
  const lang = useStore((s) => s.lang);
  const dock = useStore((s) => s.docks.elevation);
  const toggleDock = useStore((s) => s.toggleDock);
  const resizeDock = useStore((s) => s.resizeDock);
  const result = useStore((s) => s.result);
  const s = t(lang).workspace;
  const se = t(lang).elevation;
  const fiche = useMemo(() => buildElevationFiche(result), [result]);

  if (!dock.open) {
    return (
      <button
        type="button"
        className="dock-reopen dock-reopen-h"
        aria-label={s.openDock}
        title={`${s.openDock} — ${s.elevationDock}`}
        onClick={() => toggleDock("elevation")}
      >
        ▤ {s.elevationDock}
      </button>
    );
  }

  // height-resize: the handle sits on the TOP edge (the dock is at the bottom), so dragging up grows it.
  const onResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = dock.size;
    const move = (ev: PointerEvent) => resizeDock("elevation", startH + (startY - ev.clientY));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <section className="dock elevation-dock" style={{ height: dock.size }} aria-label={s.elevationDock}>
      <div
        className="dock-resize dock-resize-h"
        role="separator"
        aria-orientation="horizontal"
        aria-label={s.resizeDock}
        onPointerDown={onResize}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") resizeDock("elevation", dock.size + 20);
          else if (e.key === "ArrowDown") resizeDock("elevation", dock.size - 20);
        }}
        tabIndex={0}
      />
      <div className="dock-inner">
        <div className="dock-head">
          <span className="dock-title">{s.elevationDock}</span>
          <span className="dock-note">{se.editHint}</span>
          <button type="button" className="dock-collapse" aria-label={s.collapseDock} title={s.collapseDock} onClick={() => toggleDock("elevation")}>
            ▾
          </button>
        </div>
        <div className="dock-body elevation-body">
          {fiche.bars.length === 0 ? (
            <p className="coupe-empty">{t(lang).coupes.noBars}</p>
          ) : (
            <EditableElevation fiche={fiche} />
          )}
        </div>
      </div>
    </section>
  );
}
