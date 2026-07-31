import { Collapsible as KobalteCollapsible } from "@kobalte/core/collapsible";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

const Collapsible = KobalteCollapsible;
const CollapsibleTrigger = KobalteCollapsible.Trigger;

const CollapsibleContent: Component<ComponentProps<typeof KobalteCollapsible.Content>> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <KobalteCollapsible.Content
      class={cn(
        "data-[closed]:overflow-hidden data-[expanded]:overflow-visible",
        local.class,
      )}
      {...rest}
    />
  );
};

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
