/**
 * Project panel (Phase 7, spec §3.2 + §9.1 [REF-SYS-915]): the multi-element manager + the steel
 * takeoff. Lists every element TYPE (mark · type · quantity), lets the user add / duplicate / select
 * / remove / rename / re-quantify, and shows the per-type unit mass + total mass + steel density and
 * the project grand totals. The active type is highlighted; clicking a row makes it active for editing.
 */
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { ELEMENTS } from "../engine/manifests";
import { projectTakeoff } from "../engine/projectTakeoff";
import type { ElementId } from "../engine/document";
import type { ElementInstance } from "../engine/project";

const STATUS_DOT = { PASS: "🟢", WARN: "🟠", FAIL: "🔴" } as const;

export function ProjectPanel() {
  const lang = useStore((s) => s.lang);
  const instances = useStore((s) => s.instances);
  const activeId = useStore((s) => s.activeInstanceId);
  const doc = useStore((s) => s.doc);
  const cuts = useStore((s) => s.cuts);
  const addInstance = useStore((s) => s.addInstance);
  const duplicate = useStore((s) => s.duplicateActiveInstance);
  const removeInstance = useStore((s) => s.removeInstance);
  const renameInstance = useStore((s) => s.renameInstance);
  const setQuantity = useStore((s) => s.setInstanceQuantity);
  const selectInstance = useStore((s) => s.selectInstance);
  const moveInstance = useStore((s) => s.moveInstance);
  const s = t(lang);

  // reconcile: the active instance's live (unsynced) doc/cuts drive its row + the takeoff.
  const reconciled: ElementInstance[] = instances.map((i) =>
    i.id === activeId ? { ...i, doc, cuts } : i,
  );
  const takeoff = projectTakeoff(reconciled);
  const byId = new Map(takeoff.types.map((tk) => [tk.id, tk]));
  const label = (id: string) => {
    const m = ELEMENTS[id] as { label_fr?: string; label_en?: string } | undefined;
    return (lang === "fr" ? m?.label_fr : m?.label_en) ?? id;
  };

  return (
    <div className="project-panel">
      <div className="project-toolbar">
        <strong>{s.project.title}</strong>
        <select
          aria-label={s.project.add}
          value=""
          onChange={(e) => {
            if (e.target.value) addInstance(e.target.value as ElementId);
          }}
        >
          <option value="">+ {s.project.add}</option>
          {Object.values(ELEMENTS).map((el) => (
            <option key={el.id} value={el.id}>
              {label(el.id)}
            </option>
          ))}
        </select>
        <button type="button" onClick={duplicate}>{s.project.duplicate}</button>
      </div>

      <table className="project-table">
        <thead>
          <tr>
            <th>{s.project.mark}</th>
            <th>{s.project.elementType}</th>
            <th>{s.project.quantity}</th>
            <th>{s.project.unitMass}</th>
            <th>{s.project.totalMass}</th>
            <th>{s.project.density}</th>
            <th />
            <th />
            <th />
          </tr>
        </thead>
        <tbody>
          {reconciled.map((inst, idx) => {
            const tk = byId.get(inst.id);
            const active = inst.id === activeId;
            return (
              <tr key={inst.id} className={active ? "active-row" : ""}>
                <td>
                  <input
                    className="mark-input"
                    value={inst.mark}
                    aria-label={`${s.project.mark} ${inst.mark}`}
                    onChange={(e) => renameInstance(inst.id, e.target.value)}
                  />
                </td>
                <td>
                  <button type="button" className="link-cell" onClick={() => selectInstance(inst.id)}>
                    {STATUS_DOT[tk?.status ?? "PASS"]} {label(inst.doc.element)}
                  </button>
                </td>
                <td>
                  <input
                    type="number"
                    className="qty-input"
                    min={1}
                    value={inst.quantity}
                    aria-label={`${s.project.quantity} ${inst.mark}`}
                    onChange={(e) => setQuantity(inst.id, Number(e.target.value))}
                  />
                </td>
                <td className="num">{(tk?.unitMass_kg ?? 0).toFixed(1)}</td>
                <td className="num">{(tk?.totalMass_kg ?? 0).toFixed(1)}</td>
                <td className="num">{(tk?.steelDensity_kg_m3 ?? 0).toFixed(0)}</td>
                <td>{!active && <button type="button" onClick={() => selectInstance(inst.id)}>✎</button>}</td>
                <td className="reorder-cell">
                  <button
                    type="button"
                    aria-label={`${s.project.moveUp} ${inst.mark}`}
                    disabled={idx === 0}
                    onClick={() => moveInstance(inst.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`${s.project.moveDown} ${inst.mark}`}
                    disabled={idx === reconciled.length - 1}
                    onClick={() => moveInstance(inst.id, 1)}
                  >
                    ↓
                  </button>
                </td>
                <td>
                  {reconciled.length > 1 && (
                    <button type="button" aria-label={`${s.project.remove} ${inst.mark}`} onClick={() => removeInstance(inst.id)}>
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="totals-row">
            <td colSpan={4}>{s.project.totals}</td>
            <td className="num">{takeoff.totalSteel_kg.toFixed(1)} kg</td>
            <td className="num" colSpan={4}>
              {takeoff.totalConcrete_m3.toFixed(2)} m³ · {takeoff.overallRatio_kg_m3.toFixed(0)} kg/m³
            </td>
          </tr>
        </tfoot>
      </table>
      {takeoff.anyFail && <p className="project-fail-hint">{s.project.failHint}</p>}
    </div>
  );
}
