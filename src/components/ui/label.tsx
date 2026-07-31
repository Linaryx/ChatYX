import type { Component, JSX } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type LabelProps = JSX.LabelHTMLAttributes<HTMLLabelElement> & {
  class?: string;
};

export const Label: Component<LabelProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <label
      class={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </label>
  );
};
