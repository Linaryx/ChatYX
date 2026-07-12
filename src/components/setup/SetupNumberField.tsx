import { NumberField } from "@kobalte/core/number-field";
import type { JSX } from "solid-js";
import "./SetupNumberField.css";

type SetupNumberFieldProps = {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function SetupNumberField(props: SetupNumberFieldProps) {
  const rangeMin = () => props.min ?? 0;
  const rangeStep = () => props.step ?? 1;
  const rangeMax = () => {
    if (props.max !== undefined) return props.max;

    const min = rangeMin();
    const current = parseNumber(props.value, min);
    return Math.max(min + 100, current, 300);
  };
  const rangeValue = () =>
    clamp(parseNumber(props.value, rangeMin()), rangeMin(), rangeMax());
  const rangeFill = () => {
    const min = rangeMin();
    const max = rangeMax();
    if (max <= min) return "0%";

    return `${((rangeValue() - min) / (max - min)) * 100}%`;
  };
  const styles = {
    root: {
      width: "100%",
    },
    group: {
      display: "flex",
      "flex-direction": "column",
      gap: "9px",
      width: "100%",
    },
    input: {
      padding: "7px 10px",
      height: "34px",
      border: "1px solid #2a2a2a",
      "border-radius": "10px",
      "font-size": "14px",
      background: "#111111",
      color: "#e5e7eb",
      "font-family": "inherit",
      "box-sizing": "border-box",
      width: "100%",
      appearance: "textfield",
      "-moz-appearance": "textfield",
      "text-align": "center",
    },
  } as const;

  return (
    <NumberField
      value={props.value}
      onChange={props.onChange}
      minValue={props.min}
      maxValue={props.max}
      step={props.step}
      format={false}
      changeOnWheel={false}
      style={styles.root}
    >
      <div style={styles.group}>
        <NumberField.Input placeholder={props.placeholder} style={styles.input} />
        <input
          class="setup-number-slider"
          type="range"
          min={rangeMin()}
          max={rangeMax()}
          step={rangeStep()}
          value={rangeValue()}
          onInput={(event) => props.onChange(event.currentTarget.value)}
          style={
            {
              "--setup-number-slider-fill": rangeFill(),
            } as JSX.CSSProperties
          }
          aria-label={props.placeholder || "Настройка значения"}
        />
      </div>
    </NumberField>
  );
}
