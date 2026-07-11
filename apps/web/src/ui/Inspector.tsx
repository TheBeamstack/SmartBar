/**
 * v1.0.6 N3 / Track U3 ([REF-UI-820]) — the CONTEXTUAL INSPECTOR. Before N3 the only way to edit a
 * specific bar was to hunt for it in the long tabbed form (`AddressableBars`). N3 makes editing
 * **selection-driven**: pick a bar/extra/cross-tie on the shared `SectionCanvas`, in the 3D, or via
 * an alert row (all feed the ONE unified `selection`, store §0.3.4) and this panel shows **only that
 * object's** properties. It writes the SAME store (`setBarOverrides`/`setExtraBars`/`setCrossTies`),
 * so it and the advanced form are two consistent paths onto one document — neither is authoritative.
 *
 * Scope (per spec §7 ordering): the object types reachable TODAY are a longitudinal bar (an override),
 * an independent extra bar, and a cross-tie; row/bundle/layer inspection lands with the N5 placement
 * palette that first makes them creatable on the canvas. The tabbed form stays the "Avancé" fallback.
 */
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import {
  isColumnDoc,
  isBeamDoc,
  type BarOverrideEdit,
  type BarFaconnage,
  type AddressableBar,
  type PlacedBarDoc,
  type PlacedDocBody,
} from "../engine/document";
import { barLabel } from "../engine/barLabels";
import { selectedBarStations, memberRunLength } from "../engine/elevation";
import { FaconnageEditor } from "./FaconnageEditor";
import { NumberInput } from "./NumberInput";
import { Stepper } from "./Stepper";
import { CoupledLength } from "./AddressableBars";

/**
 * v1.0.6 N6 (U5, [REF-UI-811]) — the NUMERIC TWIN of the editable elevation, for the selected bar:
 * curtailment start/end station, per-end anchorage, and lap/coupler splices. The elevation drag and
 * these controls both commit through the SAME store actions (`curtailSelectedBar` / `setSelectedBarAnchorage`
 * / add·removeSelectedBarSplice), so the drawing gesture and the typed value agree by construction
 * (invariant §0.3.3: every gesture keeps a number + keyboard path). Rendered inside the inspector for
 * whichever single bar (group override or independent extra) is selected.
 */
function StationEditor() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const curtailSelectedBar = useStore((s) => s.curtailSelectedBar);
  const setSelectedBarAnchorage = useStore((s) => s.setSelectedBarAnchorage);
  const addSelectedBarSplice = useStore((s) => s.addSelectedBarSplice);
  const removeSelectedBarSplice = useStore((s) => s.removeSelectedBarSplice);
  const se = t(lang).elevation;

  const st = selectedBarStations(doc, selection);
  if (!st) return null;
  const { start, end, memberLen, anchorage, splices } = st;
  const midStation = Math.round(memberLen / 2 / 10) * 10;

  return (
    <fieldset className="inspector-stations">
      <legend>{se.live}</legend>
      {/* start = 0 / end = memberLen mean "uncurtailed" → pass undefined to clear the field. */}
      <NumberInput label={se.curtailStart} value={start} min={0} max={memberLen} step={10} unit="mm" onChange={(v) => curtailSelectedBar("start", v <= 0 ? undefined : v)} />
      <NumberInput label={se.curtailEnd} value={end} min={0} max={memberLen} step={10} unit="mm" onChange={(v) => curtailSelectedBar("end", v >= memberLen ? undefined : v)} />
      <label className="field">
        <span className="field-label">{se.anchorage}</span>
        <select className="field-select" value={anchorage ?? ""} onChange={(e) => setSelectedBarAnchorage(e.target.value === "" ? undefined : (e.target.value as "none" | "straight" | "hook"))}>
          <option value="">{se.runsThrough}</option>
          <option value="none">{se.anchNone}</option>
          <option value="straight">{se.anchStraight}</option>
          <option value="hook">{se.anchHook}</option>
        </select>
      </label>
      <div className="inspector-splices">
        <span className="field-label">{se.splices}</span>
        <div className="inspector-splice-add">
          <button type="button" className="btn-mini" onClick={() => addSelectedBarSplice(midStation, "lap")}>{se.addLap}</button>
          <button type="button" className="btn-mini" onClick={() => addSelectedBarSplice(midStation, "coupler")}>{se.addCoupler}</button>
        </div>
        {splices.length > 0 && (
          <ul className="inspector-splice-list" aria-label={se.splices}>
            {splices.map((sp) => (
              <li key={`${sp.kind}-${sp.at}`}>
                <span>{sp.kind === "lap" ? se.addLap.replace("+ ", "") : se.addCoupler.replace("+ ", "")} — {sp.at} mm</span>
                <button type="button" onClick={() => removeSelectedBarSplice(sp.at)} aria-label={`${se.removeSplice} ${sp.at}`}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  );
}

export function Inspector() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const result = useStore((s) => s.result);
  const selection = useStore((s) => s.selection);
  const setBarOverrides = useStore((s) => s.setBarOverrides);
  const setExtraBars = useStore((s) => s.setExtraBars);
  const setCrossTies = useStore((s) => s.setCrossTies);
  const setPlaced = useStore((s) => s.setPlaced);
  const select = useStore((s) => s.select);
  const s = t(lang);
  const sa = s.addressable;

  const col = isColumnDoc(doc);
  const beam = isBeamDoc(doc);
  const rect = col || beam;

  // v1.0.6-fix R2: the inspector no longer bails out on a non-RECT doc. The legacy channels (a group
  // bar OVERRIDE, an independent EXTRA, a CROSS-TIE) genuinely only exist on column/beam and stay gated
  // below — but `doc.placed` (the v1.0.5 canonical model) exists on ALL 8 elements, and it is what N5's
  // palette writes to. Returning null here meant a slab/pile user had no inspector at all, so the bar
  // they had just placed could never be edited. (The section CANVAS is still column/beam-only until R5;
  // the palette's placed-list is the selection surface on the other six in the meantime.)
  const group = col ? doc.longitudinal : beam ? doc.span : null;
  const memberLen = memberRunLength(doc); // works on every doc type (column H / beam L / generic)
  const bars = result.bars;
  const placed = ((doc as { placed?: PlacedBarDoc[] }).placed ?? []);

  const body = () => {
    if (!selection) return <p className="inspector-empty muted">{s.inspector.empty}</p>;

    if (selection.kind === "bar" && group) {
      const idx = selection.index;
      const overrides = group.barOverrides ?? [];
      const cur = overrides.find((o) => o.index === idx);
      const upsert = (patch: Partial<BarOverrideEdit>) =>
        setBarOverrides(
          overrides.some((o) => o.index === idx)
            ? overrides.map((o) => (o.index === idx ? { ...o, ...patch } : o))
            : [...overrides, { index: idx, ...patch }],
        );
      const onFaconnage = (patch: { shapeId?: string; faconnage?: BarFaconnage }) => upsert(patch);
      return (
        <div className="inspector-body inspector-bar">
          <div className="addressable-head">
            <strong>{s.inspector.bar} {barLabel(idx, bars)}</strong>
            <label className="addressable-remove">
              <input type="checkbox" checked={cur?.removed ?? false} onChange={(e) => upsert({ removed: e.target.checked })} />
              {sa.remove}
            </label>
          </div>
          {!cur?.removed && (
            <>
              <NumberInput label={sa.diameter} value={cur?.diameter ?? group.diameter} min={6} max={40} step={1} onChange={(v) => upsert({ diameter: v })} />
              <CoupledLength s={sa} shapeId={cur?.shapeId ?? group.shapeId} length={cur?.length} memberLen={memberLen} onChange={(v) => upsert({ length: v })} />
              <NumberInput label={sa.axialPos} value={cur?.axialPos ?? 0} min={0} max={20000} step={10} onChange={(v) => upsert({ axialPos: v })} />
              <FaconnageEditor
                key={`insp-ov-${idx}`}
                shapeId={cur?.shapeId ?? group.shapeId}
                diameter={cur?.diameter ?? group.diameter}
                faconnage={cur?.faconnage}
                memberLength={cur?.length ?? memberLen}
                onChange={onFaconnage}
              />
              <StationEditor />
            </>
          )}
          {cur && (
            <button type="button" className="addressable-reset" onClick={() => setBarOverrides(overrides.filter((o) => o.index !== idx))}>
              {sa.reset}
            </button>
          )}
        </div>
      );
    }

    if (selection.kind === "extra" && rect) {
      const extras = (doc as { extraBars?: AddressableBar[] }).extraBars ?? [];
      const e = extras.find((x) => x.id === selection.id);
      if (!e) return <p className="inspector-empty muted">{s.inspector.empty}</p>;
      const patch = (p: Partial<AddressableBar>) => setExtraBars(extras.map((x) => (x.id === e.id ? { ...x, ...p } : x)));
      const remove = () => {
        setExtraBars(extras.filter((x) => x.id !== e.id));
        select(null);
      };
      return (
        <div className="inspector-body inspector-extra">
          <div className="addressable-head">
            <strong>{s.inspector.extra} {e.id}</strong>
            <button type="button" className="btn-mini" onClick={remove}>{s.inspector.remove}</button>
          </div>
          <div className="addressable-extra-pos">
            <NumberInput label={sa.u} value={e.u} min={-2000} max={2000} step={5} onChange={(v) => patch({ u: v })} />
            <NumberInput label={sa.level} value={e.v} min={-2000} max={2000} step={5} onChange={(v) => patch({ v })} />
            <NumberInput label="Ø (mm)" value={e.diameter} min={6} max={40} step={1} onChange={(v) => patch({ diameter: v })} />
          </div>
          <CoupledLength s={sa} shapeId={e.shapeId} length={e.length} memberLen={memberLen} onChange={(v) => patch({ length: v })} />
          <NumberInput label={sa.axialPos} value={e.axialPos ?? 0} min={0} max={20000} step={10} onChange={(v) => patch({ axialPos: v })} />
          <FaconnageEditor
            key={`insp-extra-${e.id}`}
            shapeId={e.shapeId}
            diameter={e.diameter}
            faconnage={e.faconnage}
            memberLength={e.length ?? memberLen}
            onChange={(p) => patch(p)}
          />
          <StationEditor />
        </div>
      );
    }

    // v1.0.6-fix R2 (F-C) — the PLACED branch: the steel N5's tool palette creates (`doc.placed`).
    // Before R2 a placed bar was drawn, clickable, and routed here as an `extra` — where the lookup in
    // `doc.extraBars` missed and the panel said "nothing selected". Now the object the user created (the
    // PARENT single/row/bundle/layer, even when they clicked one member of it) is fully editable, and the
    // shared `<StationEditor/>` gives it curtailment / anchorage / splices — which is what finally lets
    // N6's editable elevation reach N5's bars.
    if (selection.kind === "placed") {
      const p = placed.find((x) => (x as { id: string }).id === selection.id);
      if (!p) return <p className="inspector-empty muted">{s.inspector.empty}</p>;
      const kind = (p as { kind?: string }).kind ?? "single";
      const patch = (q: Record<string, unknown>) =>
        setPlaced(placed.map((x) => ((x as { id: string }).id === selection.id ? ({ ...x, ...q } as PlacedBarDoc) : x)));
      const remove = () => {
        setPlaced(placed.filter((x) => (x as { id: string }).id !== selection.id));
        select(null);
      };
      const si = s.inspector;
      const title =
        kind === "row" ? si.placedRow : kind === "bundle" ? si.placedBundle : kind === "layer" ? si.placedLayer : si.placedSingle;
      // one read view over the union — the kind-specific fields are guarded by the `kind` checks below.
      const body = p as unknown as PlacedDocBody & Record<string, number | string | boolean | undefined>;

      return (
        <div className="inspector-body inspector-placed">
          <div className="addressable-head">
            <strong>{title} {selection.id}</strong>
            <button type="button" className="btn-mini" onClick={remove}>{si.remove}</button>
          </div>

          {/* --- kind-specific geometry --- */}
          {kind === "single" && (
            <div className="addressable-extra-pos">
              <NumberInput label={sa.u} value={Number(body.u)} min={-2000} max={2000} step={5} onChange={(v) => patch({ u: v })} />
              <NumberInput label={sa.level} value={Number(body.v)} min={-2000} max={2000} step={5} onChange={(v) => patch({ v })} />
            </div>
          )}
          {kind === "bundle" && (
            <>
              <div className="addressable-extra-pos">
                <NumberInput label={sa.u} value={Number(body.u)} min={-2000} max={2000} step={5} onChange={(v) => patch({ u: v })} />
                <NumberInput label={sa.level} value={Number(body.v)} min={-2000} max={2000} step={5} onChange={(v) => patch({ v })} />
              </div>
              {/* 2–4 is the physical limit; >4 (or >3 at a lap) is a 🔴 Track-V rule, so floor it here. */}
              <Stepper label={si.bundleN} value={Number(body.n)} min={2} max={4} onChange={(n) => patch({ n })} />
            </>
          )}
          {kind === "row" && (
            <>
              <Stepper label={si.count} value={Number(body.count ?? 3)} min={1} max={40} onChange={(n) => patch({ count: n, spacing: undefined })} />
              <NumberInput label={si.extent} value={Number(body.extent)} min={0} max={20000} step={10} unit="mm" onChange={(v) => patch({ extent: v })} />
              <label className="field">
                <span className="field-label">{si.direction}</span>
                <select className="field-select" value={String(body.direction)} onChange={(e) => patch({ direction: e.target.value })}>
                  <option value="u">{si.dirU}</option>
                  <option value="v">{si.dirV}</option>
                </select>
              </label>
              <label className="addressable-remove">
                <input type="checkbox" checked={Boolean(body.skin)} onChange={(e) => patch({ skin: e.target.checked })} />
                {si.skin}
              </label>
            </>
          )}
          {kind === "layer" && (
            <>
              <Stepper label={si.count} value={Number(body.count)} min={1} max={40} onChange={(n) => patch({ count: n })} />
              <label className="field">
                <span className="field-label">{si.face}</span>
                <select className="field-select" value={String(body.face)} onChange={(e) => patch({ face: e.target.value })}>
                  {["TOP", "BOTTOM", "LEFT", "RIGHT"].map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </label>
              <Stepper label={si.layerIndex} value={Number(body.layerIndex)} min={1} max={5} onChange={(n) => patch({ layerIndex: n })} />
              <NumberInput label={si.inset} value={Number(body.inset)} min={0} max={500} step={5} unit="mm" onChange={(v) => patch({ inset: v })} />
              <NumberInput label={si.span} value={Number(body.span)} min={0} max={20000} step={10} unit="mm" onChange={(v) => patch({ span: v })} />
            </>
          )}

          {/* --- shared body: every placed kind has ONE shape/Ø/curtailment (that is what makes it one object) --- */}
          <NumberInput label={sa.diameter} value={body.diameter as number} min={6} max={40} step={1} onChange={(v) => patch({ diameter: v })} />
          <FaconnageEditor
            key={`insp-placed-${selection.id}`}
            shapeId={body.shapeId as string}
            diameter={body.diameter as number}
            faconnage={(p as PlacedDocBody).faconnage}
            memberLength={(body.length as number) ?? memberLen}
            onChange={(q) => patch(q as Record<string, unknown>)}
          />
          <StationEditor />
        </div>
      );
    }

    if (selection.kind === "crosstie" && rect) {
      const cfg = col ? doc.tie : (doc as { stirrup: { crossTies: { barA: number; barB: number }[] } }).stirrup;
      const ct = cfg.crossTies[selection.index];
      if (!ct) return <p className="inspector-empty muted">{s.inspector.empty}</p>;
      const remove = () => {
        setCrossTies(cfg.crossTies.filter((_, i) => i !== selection.index));
        select(null);
      };
      return (
        <div className="inspector-body inspector-crosstie">
          <div className="addressable-head">
            <strong>{s.inspector.crossTie}</strong>
            <button type="button" className="btn-mini" onClick={remove}>{s.inspector.remove}</button>
          </div>
          <p className="muted">{barLabel(ct.barA, bars)} ↔ {barLabel(ct.barB, bars)}</p>
        </div>
      );
    }

    // alert: read-only — the row highlighted these bars/groups in 3D; show what it points at.
    if (selection.kind === "alert") {
      return (
        <div className="inspector-body inspector-alert">
          <strong>{s.inspector.alert}</strong>
          <p className="muted">{s.inspector.highlighted}: {selection.groupIds.join(", ")}</p>
        </div>
      );
    }

    // R2: an explicit fallthrough. The RECT-only kinds (bar / extra / cross-tie) reach here when the doc
    // is a slab/pile — the selection is real but has no editable target on this element. Say nothing is
    // selected rather than crash on the alert branch's fields (which is what an implicit fallthrough did).
    return <p className="inspector-empty muted">{s.inspector.empty}</p>;
  };

  return (
    <section className="inspector" aria-label={s.inspector.title}>
      <h3 className="inspector-title">{s.inspector.title}</h3>
      {body()}
    </section>
  );
}
