import { ColorArea } from "@kobalte/core/color-area";
import { ColorField } from "@kobalte/core/color-field";
import { ColorSlider } from "@kobalte/core/color-slider";
import { ColorSwatch } from "@kobalte/core/color-swatch";
import { parseColor, type Color } from "@kobalte/core/colors";
import { Popover } from "@kobalte/core/popover";
import { createEffect, createSignal, Show } from "solid-js";
import { t } from "~/i18n";

type ColorPickerFieldProps = {
  color: string;
  opacity: number;
  showOpacity?: boolean;
  showTransparencyGrid?: boolean;
  label?: string;
  onChange: (value: { color: string; opacity: number }) => void;
};

function normalizeHexColor(raw: string, fallback = "#000000") {
  const value = raw.trim();
  const withHash = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : fallback;
}

function normalizeOpacity(value: number, fallback = 100) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 0), 100);
}

function joinHexAlpha(color: string, opacity: number) {
  const alpha = Math.round((normalizeOpacity(opacity) / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${normalizeHexColor(color)}${alpha}`;
}

export function ColorPickerField(props: ColorPickerFieldProps) {
  const pickerValue = () =>
    parseColor(
      joinHexAlpha(
        props.color,
        props.showOpacity === false ? 100 : normalizeOpacity(props.opacity),
      ),
    );
  const [value, setValue] = createSignal(pickerValue());
  const [hex, setHex] = createSignal(normalizeHexColor(props.color));
  const opacity = () => Math.round(value().getChannelValue("alpha") * 100);
  const transparencyBackground =
    "linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a), linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a)";

  createEffect(() => {
    setValue(pickerValue());
    setHex(normalizeHexColor(props.color));
  });

  const updateValue = (next: Color) => {
    setValue(next);
    const color = next.toString("hex").toUpperCase();
    const nextOpacity = props.showOpacity === false ? props.opacity : opacityFromColor(next);
    setHex(color);
    props.onChange({ color, opacity: nextOpacity });
  };

  const updateHex = (next: string) => {
    setHex(next.toUpperCase());
    const color = normalizeHexColor(next, "");
    if (!color) return;
    updateValue(parseColor(color).withChannelValue("alpha", value().getChannelValue("alpha")));
  };

  return (
    <Popover gutter={8}>
      <div class="flex w-full items-center gap-2">
        <Popover.Trigger
          class="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background p-1.5 text-left text-sm transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${props.label ?? t("common.color")}: ${t("common.openPalette")}`}
        >
          <span
            class="relative size-7 shrink-0 overflow-hidden rounded-[5px] border border-white/10"
            style={
              props.showTransparencyGrid === false
                ? undefined
                : {
                    background: transparencyBackground,
                    "background-size": "8px 8px",
                    "background-position": "0 0, 4px 4px",
                  }
            }
          >
            <ColorSwatch value={value()} class="size-full" />
          </span>
          <span class="min-w-0 truncate font-mono text-sm uppercase text-foreground">{hex()}</span>
        </Popover.Trigger>
      </div>

      <Popover.Portal>
        <Popover.Content class="dark z-50 w-[min(19rem,calc(100vw-1rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl outline-none">
          <ColorArea
            value={value()}
            onChange={updateValue}
            colorSpace="hsb"
            xChannel="saturation"
            yChannel="brightness"
            class="w-full touch-none select-none"
          >
            <ColorArea.Label class="sr-only">{t("common.colorSelection")}</ColorArea.Label>
            <ColorArea.Background class="relative aspect-[1.45] w-full cursor-crosshair overflow-hidden rounded-lg">
              <ColorArea.Thumb class="absolute size-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ColorArea.HiddenInputX />
                <ColorArea.HiddenInputY />
              </ColorArea.Thumb>
            </ColorArea.Background>
          </ColorArea>

          <div class="mt-3 space-y-2.5">
            <ColorSlider
              value={value()}
              onChange={updateValue}
              channel="hue"
              colorSpace="hsb"
              class="w-full touch-none select-none"
            >
              <ColorSlider.Label class="sr-only">{t("common.hue")}</ColorSlider.Label>
              <ColorSlider.Track class="relative h-2.5 w-full cursor-pointer rounded-full">
                <ColorSlider.Thumb class="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <ColorSlider.Input />
                </ColorSlider.Thumb>
              </ColorSlider.Track>
            </ColorSlider>

            <Show when={props.showOpacity !== false}>
              <ColorSlider
                value={value()}
                onChange={updateValue}
                channel="alpha"
                colorSpace="hsb"
                class="w-full touch-none select-none"
              >
                <div class="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <ColorSlider.Label>{t("common.opacity")}</ColorSlider.Label>
                  <span>{opacity()}%</span>
                </div>
                <ColorSlider.Track
                  class="relative h-2.5 w-full cursor-pointer rounded-full"
                  style={{
                    background: transparencyBackground,
                    "background-size": "8px 8px",
                    "background-position": "0 0, 4px 4px",
                  }}
                >
                  <ColorSlider.Thumb class="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ColorSlider.Input />
                  </ColorSlider.Thumb>
                </ColorSlider.Track>
              </ColorSlider>
            </Show>
          </div>

          <ColorField value={hex()} onChange={updateHex} class="mt-3">
            <ColorField.Label class="sr-only">{t("common.hex")}</ColorField.Label>
            <ColorField.Input
              class="h-9 w-full rounded-md border border-input bg-muted/40 px-3 font-mono text-sm uppercase text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${props.label ?? t("common.color")}: HEX`}
            />
          </ColorField>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}

function opacityFromColor(color: Color) {
  return Math.round(color.getChannelValue("alpha") * 100);
}
