import type { Component, JSX } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type SetupSelectProps = JSX.SelectHTMLAttributes<HTMLSelectElement> & {
  class?: string;
};

export const SetupSelect: Component<SetupSelectProps> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <select
      class={cn(
        "setup-select flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "ring-offset-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
      )}
      {...rest}
    />
  );
};
