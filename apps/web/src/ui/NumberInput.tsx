/**
 * v1.0.6 N1 / Track U6 ([REF-UI-widgets]) — a **plain number box** (no slider, no `dragMode`) for
 * DESIGN INPUTS and non-geometry precision values: `As,req` / `Asw,req` / provided areas (analysis
 * results the user types in, never swept against the 3D), plus spacing, anchorage, chapeau length,
 * support width, splice station, material grades and angles (Finding U4: a slider "makes no sense" for
 * these and trips `dragMode` needlessly). The slider+`dragMode` NumberField is kept ONLY where a value
 * is genuinely tuned against the live 3D (b, h, L, cover — see GeometryTab).
 */
export function NumberInput(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** unit suffix rendered after the box (e.g. "mm²", "mm²/m") — display only. */
  unit?: string;
  /** mark the control invalid (aria-invalid + styling). */
  invalid?: boolean;
  onChange: (v: number) => void;
}) {
  const { label, value, min, max, step = 1, unit, invalid, onChange } = props;

  return (
    <label className={`field${invalid ? " field-invalid" : ""}`}>
      <span className="field-label">{label}</span>
      <span className="field-row">
        <input
          type="number"
          className="field-num field-num-wide"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit ? <span className="field-unit">{unit}</span> : null}
      </span>
    </label>
  );
}
