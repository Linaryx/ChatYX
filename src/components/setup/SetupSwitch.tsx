type SetupSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function SetupSwitch(props: SetupSwitchProps) {
  return (
    <input
      type="checkbox"
      class="setup-switch"
      checked={props.checked}
      onInput={(event) => props.onChange(event.currentTarget.checked)}
    />
  );
}
