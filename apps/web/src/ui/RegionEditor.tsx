/**
 * F5 ([REF-UI-757]) — the transverse spacing-region editor for a column tie / beam stirrup. A region
 * table (contiguous over 0..L, auto-chained) lets ends be denser than the middle, plus a
 * "symmetric ends" quick-fill (seeded from the seismic critical-zone length l_c when a regime is set)
 * and a "uniform" reset. Numeric entry is the a11y baseline (boundary drag on the elevation is a
 * later GPU addition). Column/beam only; the engine already supports regions on any transverse set.
 */
import { useState } from "react";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { NumberInput } from "./NumberInput";
import { isColumnDoc, isBeamDoc, type TransverseRegion } from "../engine/document";
import { memberAxisLength, effectiveRegions, normalizeRegions, symmetricEndsRegions } from "../engine/regions";

export function RegionEditor() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setTie = useStore((s) => s.setTie);
  const setStirrup = useStore((s) => s.setStirrup);
  const l_c = useStore((s) => s.result.seismic?.l_c);
  const s = t(lang);

  if (!isColumnDoc(doc) && !isBeamDoc(doc)) return null;
  const tset = isColumnDoc(doc) ? doc.tie : doc.stirrup;
  const length = memberAxisLength(doc);
  const spacing = tset.spacing;
  const rows = effectiveRegions(tset.regions, length, spacing);
  const multi = rows.length > 1;

  const setRegions = (regions: TransverseRegion[] | undefined) => {
    const patch = { regions };
    if (isColumnDoc(doc)) setTie(patch);
    else setStirrup(patch);
  };
  const commit = (next: TransverseRegion[]) => setRegions(normalizeRegions(next, length, spacing));

  const editBoundary = (i: number, to: number) => {
    const next = rows.map((r) => ({ ...r }));
    next[i]!.to = to;
    commit(next);
  };
  const editSpacing = (i: number, sp: number) => {
    const next = rows.map((r) => ({ ...r }));
    next[i]!.spacing = sp;
    commit(next);
  };
  const removeRow = (i: number) => commit(rows.filter((_, k) => k !== i));
  const addRow = () => {
    // split the last region in half so contiguity holds
    const last = rows[rows.length - 1]!;
    const mid = Math.round((last.from + last.to) / 2);
    const next = [...rows.slice(0, -1), { from: last.from, to: mid, spacing: last.spacing }, { from: mid, to: last.to, spacing: last.spacing }];
    commit(next);
  };

  // symmetric-ends quick-fill state (seeded from l_c when seismic, else a quarter-length end zone)
  const [endZone, setEndZone] = useState(() => Math.round(l_c ?? length / 4));
  const [endSp, setEndSp] = useState(() => Math.max(50, Math.round(spacing / 2)));
  const [midSp, setMidSp] = useState(spacing);

  return (
    <div className="region-editor">
      <h3>{s.regions.title}</h3>
      <p className="field-hint">{s.regions.hint}</p>

      <table className="region-table">
        <thead>
          <tr>
            <th>{s.regions.from}</th>
            <th>{s.regions.to}</th>
            <th>{s.regions.spacing}</th>
            <th aria-label={s.regions.remove} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="region-from">{Math.round(r.from)}</td>
              <td>
                <input
                  type="number"
                  className="region-num"
                  value={Math.round(r.to)}
                  min={Math.round(r.from) + 1}
                  max={Math.round(length)}
                  disabled={i === rows.length - 1}
                  aria-label={`${s.regions.to} ${i + 1}`}
                  onChange={(e) => editBoundary(i, Number(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="number"
                  className="region-num"
                  value={Math.round(r.spacing)}
                  min={10}
                  max={600}
                  step={5}
                  aria-label={`${s.regions.spacing} ${i + 1}`}
                  onChange={(e) => editSpacing(i, Number(e.target.value))}
                />
              </td>
              <td>
                <button type="button" className="region-del" disabled={!multi} aria-label={s.regions.remove} onClick={() => removeRow(i)}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="region-actions">
        <button type="button" onClick={addRow}>
          {s.regions.add}
        </button>
        <button type="button" disabled={!multi} onClick={() => setRegions(undefined)}>
          {s.regions.uniform}
        </button>
      </div>

      <details className="region-symmetric">
        <summary>{s.regions.symmetric}</summary>
        <NumberInput label={s.regions.endZone} value={endZone} min={0} max={Math.round(length / 2)} step={50} onChange={setEndZone} />
        <NumberInput label={s.regions.endSpacing} value={endSp} min={10} max={600} step={5} onChange={setEndSp} />
        <NumberInput label={s.regions.midSpacing} value={midSp} min={10} max={600} step={5} onChange={setMidSp} />
        <button type="button" onClick={() => commit(symmetricEndsRegions(length, endZone, endSp, midSp))}>
          {s.regions.apply}
        </button>
      </details>
    </div>
  );
}
