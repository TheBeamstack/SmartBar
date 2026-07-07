/**
 * Labeled numeric control = range slider + number box. While the slider is dragged it flips the
 * store's dragMode (viewport degrades to centrelines, validation list defers — §2.2); releasing
 * restores full fidelity. The number box commits without drag-mode (a discrete edit).
 */
import { useStore } from "../store/useStore";

export function NumberField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** v1.0.4 H17: mark the control invalid (aria-invalid + styling) when its value breaks the shape. */
  invalid?: boolean;
  onChange: (v: number) => void;
}) {
  const { label, value, min, max, step = 1, invalid, onChange } = props;
  const setDragMode = useStore((s) => s.setDragMode);

  return (
    <label className={`field${invalid ? " field-invalid" : ""}`}>
      <span className="field-label">{label}</span>
      <span className="field-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-invalid={invalid || undefined}
          onPointerDown={() => setDragMode(true)}
          onPointerUp={() => setDragMode(false)}
          onPointerCancel={() => setDragMode(false)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          type="number"
          className="field-num"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </span>
    </label>
  );
}
