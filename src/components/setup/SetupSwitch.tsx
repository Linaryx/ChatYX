import { Switch } from "~/components/ui/switch";

type SetupSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function SetupSwitch(props: SetupSwitchProps) {
  return (
    <Switch
      checked={props.checked}
      onChange={props.onChange}
      aria-label={props.label}
      class="shrink-0"
    />
  );
}
