import { Slider as KobalteSlider } from "@kobalte/core/slider";
import type { Component, ComponentProps } from "solid-js";
import { createMemo, For, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type SliderProps = ComponentProps<typeof KobalteSlider> & {
  label?: string;
  class?: string;
};

export const Slider: Component<SliderProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "label", "defaultValue"]);

  // Stable indices — never key thumbs by live value (remount kills drag).
  const thumbIndexes = createMemo(() => {
    const source = (rest.value ?? local.defaultValue ?? [0]) as number[];
    return Array.from({ length: Math.max(1, source.length) }, (_, i) => i);
  });

  return (
    <KobalteSlider
      class={cn(
        "relative flex w-full touch-none select-none flex-col items-center gap-2",
        local.class,
      )}
      {...(local.defaultValue !== undefined
        ? { defaultValue: local.defaultValue }
        : {})}
      {...rest}
    >
      {local.label && (
        <div class="flex w-full justify-between">
          <KobalteSlider.Label class="text-sm font-medium leading-none">
            {local.label}
          </KobalteSlider.Label>
          <KobalteSlider.ValueLabel class="text-sm text-muted-foreground" />
        </div>
      )}
      <KobalteSlider.Track class="relative h-2 w-full grow rounded-full bg-secondary">
        <KobalteSlider.Fill class="absolute h-full rounded-full bg-primary" />
        <For each={thumbIndexes()}>
          {() => (
            <KobalteSlider.Thumb
              class={cn(
                "absolute top-1/2 block size-5 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow ring-offset-background",
                "cursor-grab active:cursor-grabbing",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <KobalteSlider.Input />
            </KobalteSlider.Thumb>
          )}
        </For>
      </KobalteSlider.Track>
    </KobalteSlider>
  );
};
