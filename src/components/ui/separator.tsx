import { Separator as KobalteSeparator } from "@kobalte/core/separator";
import type { Component } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type SeparatorProps = {
  orientation?: "horizontal" | "vertical";
  class?: string;
};

export const Separator: Component<SeparatorProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "orientation"]);

  return (
    <KobalteSeparator
      orientation={local.orientation ?? "horizontal"}
      class={cn(
        "shrink-0 bg-border",
        local.orientation === "vertical" ? "h-full w-px" : "h-px w-full",
        local.class,
      )}
      {...rest}
    />
  );
};
