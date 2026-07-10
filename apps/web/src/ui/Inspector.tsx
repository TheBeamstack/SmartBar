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
import { isColumnDoc, isBeamDoc, type BarOverrideEdit, type BarFaconnage, type AddressableBar } from "../engine/document";
import { barLabel } from "../engine/barLabels";
import { FaconnageEditor } from "./FaconnageEditor";
import { NumberInput } from "./NumberInput";
import { CoupledLength } from "./AddressableBars";

export function Inspector() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const result = useStore((s) => s.result);
  const selection = useStore((s) => s.selection);
  const setBarOverrides = useStore((s) => s.setBarOverrides);
  const setExtraBars = useStore((s) => s.setExtraBars);
  const setCrossTies = useStore((s) => s.setCrossTies);
  const select = useStore((s) => s.select);
  const s = t(lang);
  const sa = s.addressable;

  const col = isColumnDoc(doc);
  const beam = isBeamDoc(doc);
  // The inspector edits the addressable long-steel + ties, which live on column/beam docs.
  if (!col && !beam) return null;

  const group = col ? doc.longitudinal : doc.span;
  const memberLen = col ? doc.geometry.H : doc.geometry.L;
  const bars = result.bars;

  const body = () => {
    if (!selection) return <p className="inspector-empty muted">{s.inspector.empty}</p>;

    if (selection.kind === "bar") {
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

    if (selection.kind === "extra") {
      const extras = doc.extraBars ?? [];
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
        </div>
      );
    }

    if (selection.kind === "crosstie") {
      const cfg = col ? doc.tie : doc.stirrup;
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
    return (
      <div className="inspector-body inspector-alert">
        <strong>{s.inspector.alert}</strong>
        <p className="muted">{s.inspector.highlighted}: {selection.groupIds.join(", ")}</p>
      </div>
    );
  };

  return (
    <section className="inspector" aria-label={s.inspector.title}>
      <h3 className="inspector-title">{s.inspector.title}</h3>
      {body()}
    </section>
  );
}
