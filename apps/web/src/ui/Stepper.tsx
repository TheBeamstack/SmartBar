/**
 * v1.0.6 N1 / Track U6 ([REF-UI-widgets]) — an integer **stepper** (− N +) for COUNTS (bars per face,
 * row count, bundle n, seismic zone). A count is a small discrete integer: a slider makes no sense and
 * needlessly trips `dragMode` (Finding U4). The middle stays an editable number box — the numeric +
 * keyboard twin (invariant §0.3.3), so nothing becomes button-only. No `dragMode` (this is not a
 * geometry sweep against the live 3D).
 */
export function Stepper(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** mark the control invalid (aria-invalid + styling) — carried from NumberField for parity. */
  invalid?: boolean;
  onChange: (v: number) => void;
}) {
  const { label, value, min, max, step = 1, invalid, onChange } = props;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  return (
    <label className={`field${invalid ? " field-invalid" : ""}`}>
      <span className="field-label">{label}</span>
      <span className="field-row stepper">
        <button
          type="button"
          className="stepper-btn"
          aria-label={`${label} −`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          −
        </button>
        <input
          type="number"
          className="field-num stepper-num"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
        />
        <button
          type="button"
          className="stepper-btn"
          aria-label={`${label} +`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </button>
      </span>
    </label>
  );
}
