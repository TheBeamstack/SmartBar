/**
 * On-screen bar-bending schedule (spec §9.1, plan P5 step 2). Renders the SAME `computeBBS(result)`
 * record that the PDF/JSON exports use — one row per distinct bar (merged by shape+Ø+dims), with the
 * steel-quantity summary (total weight, ratio kg/m³, concrete volume). A WARN element carries the
 * "À vérifier / Review required" stamp (§7.9/§7.12); a FAIL element still shows its schedule (only
 * the drawing deliverables are export-locked).
 */
import { useMemo } from "react";
import { computeBBS } from "@rebarconfig/exporters";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";

export function BbsPanel() {
  const result = useStore((s) => s.result);
  const lang = useStore((s) => s.lang);
  const s = t(lang);
  const bbs = useMemo(() => computeBBS(result), [result]);

  return (
    <section className="bbs-panel" aria-label={s.bbs.title}>
      <h3>{s.bbs.title}</h3>
      {bbs.reviewRequired && <p className="review-stamp">⚠ {s.bbs.reviewRequired}</p>}
      <table className="bbs-table">
        <thead>
          <tr>
            <th>{s.bbs.mark}</th>
            <th>{s.bbs.diameter}</th>
            <th>{s.bbs.shape}</th>
            <th className="num">{s.bbs.count}</th>
            <th className="num">{s.bbs.cutLength}</th>
            <th className="num">{s.bbs.totalLength}</th>
            <th className="num">{s.bbs.weight}</th>
          </tr>
        </thead>
        <tbody>
          {bbs.lines.length === 0 ? (
            <tr>
              <td colSpan={7}>{s.bbs.empty}</td>
            </tr>
          ) : (
            bbs.lines.map((l) => (
              <tr key={l.mark}>
                <td>{l.mark}</td>
                <td>Ø{l.diameter}</td>
                <td>{l.shapeArchetypeId}</td>
                <td className="num">{l.count}</td>
                <td className="num">{l.cutLength_mm.toFixed(0)}</td>
                <td className="num">{l.totalLength_m.toFixed(2)}</td>
                <td className="num">{l.weight_kg.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="bbs-summary">
        {s.bbs.totalWeight}: <strong>{bbs.summary.totalWeight_kg.toFixed(1)} kg</strong> · {s.bbs.ratio}:{" "}
        <strong>{bbs.summary.steelRatio_kg_m3.toFixed(1)} kg/m³</strong> · {s.bbs.concreteVolume}:{" "}
        <strong>{bbs.summary.concreteVolume_m3.toFixed(3)} m³</strong>
      </p>
    </section>
  );
}
