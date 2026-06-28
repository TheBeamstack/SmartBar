/**
 * Alerts panel (spec §8): every rule result (FR/EN), each row clickable to highlight the
 * affected bars in 3D (selectGroups). Status is conveyed by icon + text + colour class — never
 * colour alone (a11y, §8/P6). During an active drag the live list is deferred (§2.2): we keep
 * the last full result visible but mark it "à recalculer" so the user knows it is mid-edit.
 */
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { viewportDirectives } from "../viewport/rebarProps";
import type { ValidationItem } from "@rebarconfig/core";

const STATUS_ICON: Record<string, string> = { FAIL: "🔴", WARN: "🟠", PASS: "🟢" };

export function AlertsPanel() {
  const lang = useStore((s) => s.lang);
  const items = useStore((s) => s.result.validation);
  const selected = useStore((s) => s.selectedGroupIds);
  const selectGroups = useStore((s) => s.selectGroups);
  const dragMode = useStore((s) => s.dragMode);
  const s = t(lang);
  const deferred = viewportDirectives(dragMode).validation === "deferred";

  const message = (it: ValidationItem) => (lang === "fr" ? it.message_fr : it.message_en);
  const isActive = (it: ValidationItem) =>
    it.affectedGroupIds.length > 0 && it.affectedGroupIds.every((id) => selected.includes(id));

  const toggle = (it: ValidationItem) => {
    if (it.affectedGroupIds.length === 0) return;
    selectGroups(isActive(it) ? [] : it.affectedGroupIds);
  };

  return (
    <div className="alerts" aria-label={s.alerts}>
      {deferred && <p className="alerts-deferred">… recalcul</p>}
      {items.length === 0 ? (
        <p className="alerts-empty">{s.noAlerts}</p>
      ) : (
        <ul className={deferred ? "alerts-list deferred" : "alerts-list"}>
          {items.map((it) => (
            <li
              key={it.rule}
              className={`alert-row tier-${it.tier} ${isActive(it) ? "active" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={isActive(it)}
              onClick={() => toggle(it)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(it);
                }
              }}
            >
              <span className="alert-icon" aria-hidden>
                {STATUS_ICON[it.status] ?? "•"}
              </span>
              <span className="alert-text">
                <span className="alert-rule">{it.rule}</span>
                <span className="alert-msg">{message(it)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
