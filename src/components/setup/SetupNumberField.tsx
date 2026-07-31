import { NumberField } from "@kobalte/core/number-field";
import { Slider } from "~/components/ui/slider";
import { cn } from "~/lib/utils";

type SetupNumberFieldProps = {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  label: string;
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

  return (
    <NumberField
      value={props.value}
      onChange={props.onChange}
      minValue={props.min}
      maxValue={props.max}
      step={props.step}
      format={false}
      changeOnWheel={false}
      class="w-full"
    >
      <div class="flex w-full flex-col gap-2.5">
        <NumberField.Input
          aria-label={props.label}
          placeholder={props.placeholder}
          class={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-sm",
            "ring-offset-background placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "appearance-textfield [-moz-appearance:textfield]",
            "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          )}
        />
        <Slider
          aria-label={`${props.label}: ползунок`}
          minValue={rangeMin()}
          maxValue={rangeMax()}
          step={rangeStep()}
          value={[rangeValue()]}
          onChange={(values) => {
            const next = values[0];
            if (next !== undefined) props.onChange(String(next));
          }}
          class="w-full px-1"
        />
      </div>
    </NumberField>
  );
}
