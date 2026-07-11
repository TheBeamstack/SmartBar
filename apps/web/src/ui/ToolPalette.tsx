/**
 * v1.0.6 N5 / Track U4 ([REF-UI-560]) — the tool palette + place-by-pointing. A **modal toolbar**
 * (Select · Add bar · Add row · Add layer · Add bundle · Link · Measure — each `aria-pressed`, with a
 * keyboard shortcut; `Esc` returns to Select) plus, for an `add-*` tool, a **palette** (a façonnage
 * shape + a Ø + a typable `(u,v)` coordinate twin + a Place button). Placing drops the shape as the
 * matching canonical `PlacedBar` in `doc.placed` (the v1.0.5 model — so it renders + schedules + is
 * validated on all 8 elements). "Add any bar" is now a visible tool, not a buried numeric sub-panel
 * (answers UI review U8). The typed coordinate is the a11y/precision twin of the on-canvas click
 * (invariant §0.3.3); the pointer drop on the section SVG is the GPU path.
 */
import { useEffect } from "react";
import { useStore, type SectionTool } from "../store/useStore";
import { t } from "../i18n/strings";
import { LONGITUDINAL_SHAPES } from "./FaconnageEditor";
import type { PlacedBarDoc } from "../engine/document";

const DIAMETERS = [6, 8, 10, 12, 14, 16, 20, 25, 32];

/** tool → single-key shortcut (lower-case). `Esc` → select is handled separately. */
const SHORTCUT: Record<string, SectionTool> = {
  v: "select",
  b: "add-single",
  r: "add-row",
  l: "add-layer",
  u: "add-bundle",
  k: "link",
  m: "measure",
};

const ADD_TOOLS = new Set<SectionTool>(["add-single", "add-row", "add-bundle", "add-layer"]);

export function ToolPalette() {
  const lang = useStore((s) => s.lang);
  const tool = useStore((s) => s.sectionTool);
  const setSectionTool = useStore((s) => s.setSectionTool);
  const beginLink = useStore((s) => s.beginLink);
  const paletteShape = useStore((s) => s.paletteShape);
  const paletteDiameter = useStore((s) => s.paletteDiameter);
  const placeCoord = useStore((s) => s.placeCoord);
  const setPaletteShape = useStore((s) => s.setPaletteShape);
  const setPaletteDiameter = useStore((s) => s.setPaletteDiameter);
  const setPlaceCoord = useStore((s) => s.setPlaceCoord);
  const placeInSection = useStore((s) => s.placeInSection);
  const s = t(lang).tools;

  // keyboard shortcuts (§0.3.3) — a tool key switches the mode; Esc returns to Select. Guarded so
  // typing a letter into a field never flips the tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === "Escape") {
        setSectionTool("select");
        return;
      }
      const next = SHORTCUT[e.key.toLowerCase()];
      if (!next) return;
      if (next === "link") beginLink({ kind: "crosstie" });
      else setSectionTool(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSectionTool, beginLink]);

  const pick = (next: SectionTool) => {
    if (next === "link") beginLink({ kind: "crosstie" });
    else setSectionTool(next);
  };

  const toolBtn = (id: SectionTool, label: string, key: string) => (
    <button
      type="button"
      className={`tool-btn ${tool === id ? "active" : ""}`}
      aria-pressed={tool === id}
      title={`${label} (${key.toUpperCase()})`}
      onClick={() => pick(id)}
    >
      {label}
    </button>
  );

  const isAdd = ADD_TOOLS.has(tool);

  return (
    <div className="tool-palette">
      <div className="toolbar" role="toolbar" aria-label={s.title}>
        {toolBtn("select", s.select, "v")}
        {toolBtn("add-single", s.addBar, "b")}
        {toolBtn("add-row", s.addRow, "r")}
        {toolBtn("add-layer", s.addLayer, "l")}
        {toolBtn("add-bundle", s.addBundle, "u")}
        {toolBtn("link", s.link, "k")}
        {toolBtn("measure", s.measure, "m")}
      </div>

      {(isAdd || tool === "measure") && (
        <div className="palette">
          {isAdd && (
            <>
              <p className="muted palette-hint">{s.hint}</p>
              <label className="field">
                <span className="field-label">{s.shape}</span>
                <select value={paletteShape} aria-label={s.shape} onChange={(e) => setPaletteShape(e.target.value)}>
                  {LONGITUDINAL_SHAPES.map((sh) => (
                    <option key={sh} value={sh}>{sh}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t(lang).diameter}</span>
                <select value={paletteDiameter} aria-label={t(lang).diameter} onChange={(e) => setPaletteDiameter(Number(e.target.value))}>
                  {DIAMETERS.map((d) => (
                    <option key={d} value={d}>Ø{d}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {/* the typable coordinate twin of the on-canvas click (a11y/precision backstop) */}
          <div className="palette-coord">
            <label className="field field-inline">
              <span className="field-label">u (mm)</span>
              <input type="number" step={5} value={placeCoord.u} aria-label="u" onChange={(e) => setPlaceCoord({ ...placeCoord, u: Number(e.target.value) })} />
            </label>
            <label className="field field-inline">
              <span className="field-label">v (mm)</span>
              <input type="number" step={5} value={placeCoord.v} aria-label="v" onChange={(e) => setPlaceCoord({ ...placeCoord, v: Number(e.target.value) })} />
            </label>
          </div>
          {isAdd && (
            <button type="button" className="palette-place" onClick={() => placeInSection(placeCoord.u, placeCoord.v)}>
              {s.place}
            </button>
          )}
          {tool === "measure" && <p className="muted">{s.measureHint}</p>}
        </div>
      )}

      <PlacedList />
    </div>
  );
}

/** The placed steel on the active doc (single/row/bundle/layer): a labelled list with count/n + remove. */
function PlacedList() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setPlaced = useStore((s) => s.setPlaced);
  const s = t(lang).tools;
  const placed = ((doc as { placed?: PlacedBarDoc[] }).placed ?? []);
  if (placed.length === 0) return null;

  const patch = (id: string, p: Partial<PlacedBarDoc>) =>
    setPlaced(placed.map((x) => ((x as { id: string }).id === id ? ({ ...x, ...p } as PlacedBarDoc) : x)));
  const remove = (id: string) => setPlaced(placed.filter((x) => (x as { id: string }).id !== id));

  const kindLabel = (p: PlacedBarDoc): string => {
    const k = (p as { kind?: string }).kind;
    if (k === "row") return s.addRow;
    if (k === "bundle") return s.addBundle;
    if (k === "layer") return s.addLayer;
    return s.addBar;
  };
  const countOf = (p: PlacedBarDoc): number | null => {
    const k = (p as { kind?: string }).kind;
    if (k === "row") return (p as { count?: number }).count ?? null;
    if (k === "layer") return (p as { count: number }).count;
    if (k === "bundle") return (p as { n: number }).n;
    return null;
  };
  const setCount = (p: PlacedBarDoc, n: number) => {
    const k = (p as { kind?: string }).kind;
    const id = (p as { id: string }).id;
    if (k === "bundle") patch(id, { n: Math.max(2, Math.min(4, n)) } as Partial<PlacedBarDoc>);
    else patch(id, { count: Math.max(1, n) } as Partial<PlacedBarDoc>);
  };

  return (
    <div className="placed-list">
      <h4>{s.placed}</h4>
      <ul aria-label={s.placed}>
        {placed.map((p) => {
          const id = (p as { id: string }).id;
          const c = countOf(p);
          return (
            <li key={id} className="placed-row">
              <span className="placed-desc">
                {kindLabel(p)} · {(p as { shapeId: string }).shapeId} Ø{(p as { diameter: number }).diameter}
              </span>
              {c !== null && (
                <span className="placed-count">
                  <button type="button" className="stepper-btn" aria-label={`${s.count} −`} onClick={() => setCount(p, c - 1)}>−</button>
                  <span aria-label={s.count}>{c}</span>
                  <button type="button" className="stepper-btn" aria-label={`${s.count} +`} onClick={() => setCount(p, c + 1)}>+</button>
                </span>
              )}
              <button type="button" className="placed-remove" aria-label={`${s.remove} ${id}`} onClick={() => remove(id)}>×</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
