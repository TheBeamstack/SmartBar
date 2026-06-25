/**
 * Coupe manager (spec §9.5, plan P5 step 1 UI). Lists the user-placed cross-section cuts (seeded
 * with the auto-managed default representative coupe at index 0), lets you add / name / remove cuts
 * and set each one's station along the member axis + look-behind depth — by numeric field AND
 * keyboard (full a11y parity; the 3D drag handle is a P6 visual follow-up). The selected cut drives
 * a live 2D SVG preview rendered from the SAME pure `sectionAt(result, cut) → CoupeView` that feeds
 * the DXF/PDF coupe views (geometry written once in core).
 *
 * v1.0 UI scope: cuts are perpendicular to the axis at a chosen station (origin.y), normal +Y.
 * Oblique/free orientation is supported by the engine + persisted in `.rcfg`; exposing the
 * orientation control is a P6 item (see current_state.md handoff).
 */
import { useMemo } from "react";
import { sectionAt, type SectionCut, type CoupeView } from "@rebarconfig/core";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";

/** Map a CoupeView's plane-frame primitives into an SVG-coordinate preview (t flipped to y-down). */
function CoupeSvg({ view, emptyLabel }: { view: CoupeView; emptyLabel: string }) {
  const pts = [
    ...view.concrete.outline,
    ...view.circles.map((c) => c.center),
    ...view.lines.flatMap((l) => [l.a, l.b]),
  ];
  if (pts.length === 0) return <p className="coupe-empty">{emptyLabel}</p>;
  const ss = pts.map((p) => p.s);
  const ts = pts.map((p) => p.t);
  const minS = Math.min(...ss), maxS = Math.max(...ss);
  const minT = Math.min(...ts), maxT = Math.max(...ts);
  const pad = 16;
  const W = 260, H = 220;
  const span = Math.max(maxS - minS, maxT - minT, 1);
  const scale = (Math.min(W, H) - 2 * pad) / span;
  // centre the content; flip t so +t draws upward
  const cx = (minS + maxS) / 2, cy = (minT + maxT) / 2;
  const px = (s: number) => W / 2 + (s - cx) * scale;
  const py = (tt: number) => H / 2 - (tt - cy) * scale;

  const outline = view.concrete.outline.map((p) => `${px(p.s)},${py(p.t)}`).join(" ");
  return (
    <svg className="coupe-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={view.label}>
      <polygon points={outline} fill="#1b2230" stroke="#9aa4b2" strokeWidth={1.2} />
      {view.lines.map((l, i) => (
        <line
          key={`l${i}`}
          x1={px(l.a.s)} y1={py(l.a.t)} x2={px(l.b.s)} y2={py(l.b.t)}
          stroke="#d24b4b" strokeWidth={1.4}
        />
      ))}
      {view.circles.map((c, i) => (
        <circle
          key={`c${i}`}
          cx={px(c.center.s)} cy={py(c.center.t)} r={Math.max(2, (c.diameter / 2) * scale)}
          fill="#d24b4b" fillOpacity={0.85}
        />
      ))}
      {view.annotations.map((a, i) => (
        <text key={`a${i}`} x={px(a.at.s) + 4} y={py(a.at.t) - 4} fontSize={9} fill="#e6e9ee">
          {a.count} Ø {a.diameter}
        </text>
      ))}
    </svg>
  );
}

export function CoupePanel() {
  const result = useStore((s) => s.result);
  const cuts = useStore((s) => s.cuts);
  const activeCutId = useStore((s) => s.activeCutId);
  const addCut = useStore((s) => s.addCut);
  const removeCut = useStore((s) => s.removeCut);
  const updateCut = useStore((s) => s.updateCut);
  const selectCut = useStore((s) => s.selectCut);
  const lang = useStore((s) => s.lang);
  const s = t(lang);

  const length = result.member.length;
  const active = cuts.find((c) => c.id === activeCutId) ?? cuts[0]!;
  const view = useMemo<CoupeView>(() => sectionAt(result, active), [result, active]);

  const onAdd = () => {
    const tag = String.fromCharCode(65 + cuts.length); // A is the default; next is B, C, …
    const cut: SectionCut = {
      id: tag,
      label_fr: `Coupe ${tag}-${tag}`,
      origin: { x: 0, y: Math.round(length / 2), z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      isDefault: false,
    };
    addCut(cut);
  };

  const station = (c: SectionCut) => (c.origin as { y: number }).y;

  return (
    <section className="coupe-panel" aria-label={s.coupes.title}>
      <div className="coupe-list">
        <div className="coupe-list-head">
          <h3>{s.coupes.title}</h3>
          <button type="button" onClick={onAdd}>{s.coupes.add}</button>
        </div>
        <ul role="listbox" aria-label={s.coupes.title}>
          {cuts.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={c.id === activeCutId}
                className={c.id === activeCutId ? "active" : ""}
                onClick={() => selectCut(c.id)}
              >
                {c.label_fr ?? c.id}
                {c.isDefault && <span className="muted"> ({s.coupes.defaultTag})</span>}
              </button>
              {!c.isDefault && (
                <button
                  type="button"
                  className="coupe-remove"
                  aria-label={`${s.coupes.remove} ${c.label_fr ?? c.id}`}
                  onClick={() => removeCut(c.id)}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="coupe-edit">
        {active.isDefault ? (
          <p className="muted">{s.coupes.panelHint}</p>
        ) : (
          <>
            <label className="coupe-field">
              {s.coupes.label}
              <input
                type="text"
                value={active.label_fr ?? active.id}
                onChange={(e) => updateCut(active.id, { label_fr: e.target.value })}
              />
            </label>
            <label className="coupe-field">
              {s.coupes.station}
              <input
                type="number"
                min={0}
                max={length}
                value={station(active)}
                onChange={(e) =>
                  updateCut(active.id, {
                    origin: { x: 0, y: Number(e.target.value), z: 0 },
                  })
                }
              />
            </label>
            <label className="coupe-field">
              {s.coupes.lookBehind}
              <input
                type="number"
                min={0}
                value={active.lookBehind_mm ?? view.lookBehind_mm}
                onChange={(e) => updateCut(active.id, { lookBehind_mm: Number(e.target.value) })}
              />
            </label>
          </>
        )}
      </div>

      <div className="coupe-preview">
        <h4>{s.coupes.preview} — {view.label}</h4>
        <CoupeSvg view={view} emptyLabel={s.coupes.noBars} />
      </div>
    </section>
  );
}
