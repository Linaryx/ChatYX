import { createUniqueId, Show } from "solid-js";

type SetupSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
};

export function SetupSwitch(props: SetupSwitchProps) {
  const hintId = `setup-switch-hint-${createUniqueId()}`;
  return (
    <label class="setup-switch-row">
      <span class="setup-switch-copy">
        <span class="setup-switch-label">{props.label}</span>
        <Show when={props.hint}>
          <span id={hintId} class="setup-switch-hint">{props.hint}</span>
        </Show>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={props.checked}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
        aria-describedby={props.hint ? hintId : undefined}
      />
      <span class="setup-switch-track" aria-hidden="true" />
    </label>
  );
}
