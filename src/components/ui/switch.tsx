import { Switch as KobalteSwitch } from "@kobalte/core/switch";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type SwitchProps = ComponentProps<typeof KobalteSwitch> & {
  label?: string;
  class?: string;
};

export const Switch: Component<SwitchProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "label"]);

  return (
    <KobalteSwitch class={cn("flex items-center gap-2", local.class)} {...rest}>
      <KobalteSwitch.Input class="sr-only" />
      <KobalteSwitch.Control
        class={cn(
          "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "bg-input data-[checked]:bg-primary",
        )}
      >
        <KobalteSwitch.Thumb
          class={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
            "translate-x-0 data-[checked]:translate-x-5",
          )}
        />
      </KobalteSwitch.Control>
      {local.label && (
        <KobalteSwitch.Label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {local.label}
        </KobalteSwitch.Label>
      )}
    </KobalteSwitch>
  );
};
