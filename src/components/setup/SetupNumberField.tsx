import { NumberField } from "@kobalte/core/number-field";

type SetupNumberFieldProps = {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

export function SetupNumberField(props: SetupNumberFieldProps) {
  const styles = {
    root: {
      width: "100%",
    },
    group: {
      display: "grid",
      "grid-template-columns": "36px minmax(0, 1fr) 36px",
      gap: "6px",
      width: "100%",
      "align-items": "stretch",
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
    trigger: {
      height: "34px",
      border: "1px solid #2a2a2a",
      "border-radius": "10px",
      background: "#111111",
      color: "#e5e7eb",
      cursor: "pointer",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "font-size": "16px",
      "font-weight": 700,
      "line-height": 1,
      transition: "background 0.2s ease, border-color 0.2s ease",
      padding: "0",
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
        <NumberField.DecrementTrigger style={styles.trigger}>
          -
        </NumberField.DecrementTrigger>
        <NumberField.Input placeholder={props.placeholder} style={styles.input} />
        <NumberField.IncrementTrigger style={styles.trigger}>
          +
        </NumberField.IncrementTrigger>
      </div>
    </NumberField>
  );
}
