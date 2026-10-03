import { For, Show } from "solid-js";
import { t } from "~/i18n";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { LocalFontOption } from "~/services/setup/localFonts";
import { SetupNumberField } from "../SetupNumberField";
import { SetupSelect } from "../SetupSelect";
import type { ControlRow } from "../SetupLayout";

/** Form state and callbacks the appearance rows read. */
export type AppearanceRowsSource = {
  size: () => string;
  setSize: (value: string) => void;
  font: () => string;
  setFont: (value: string) => void;
  fontCustom: () => string;
  setFontCustom: (value: string) => void;
  localFontBrowser: () => string;
  localFonts: () => LocalFontOption[];
  localFontStatusText: () => string;
  isLoadingLocalFonts: () => boolean;
  loadLocalFonts: () => void;
  lineHeight: () => string;
  setLineHeight: (value: string) => void;
  fontWeight: () => string;
  setFontWeight: (value: string) => void;
  nickFontWeight: () => string;
  setNickFontWeight: (value: string) => void;
  emoteScale: () => string;
  setEmoteScale: (value: string) => void;
  gifScale: () => string;
  setGifScale: (value: string) => void;
  gigantifiedEmoteScale: () => string;
  setGigantifiedEmoteScale: (value: string) => void;
};

/**
 * The appearance section's rows: message size and font, the local-font picker,
 * and the weight and emote scales.
 *
 * The source is destructured up front rather than threaded through each row, so
 * the row bodies are exactly what the route declared before the extraction.
 */
export function createAppearanceRows(source: AppearanceRowsSource): ControlRow[] {
  const {
    size,
    setSize,
    font,
    setFont,
    fontCustom,
    setFontCustom,
    localFontBrowser,
    localFonts,
    localFontStatusText,
    isLoadingLocalFonts,
    loadLocalFonts,
    lineHeight,
    setLineHeight,
    fontWeight,
    setFontWeight,
    nickFontWeight,
    setNickFontWeight,
    emoteScale,
    setEmoteScale,
    gifScale,
    setGifScale,
    gigantifiedEmoteScale,
    setGigantifiedEmoteScale,
  } = source;

  return [
    {
      label: () => t("setup.messageSize"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={size()}
          onChange={(e) => setSize(e.currentTarget.value)}
        >
          <option value="1">{t("setup.small")}</option>
          <option value="2">{t("setup.medium")}</option>
          <option value="3">{t("setup.large")}</option>
        </SetupSelect>
      ),
    },
    {
      label: () => t("setup.font"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={font()}
          onChange={(e) => setFont(e.currentTarget.value)}
        >
          <option value="0">{t("setup.customFont")}</option>
          <option value="1">Baloo Tammudu</option>
          <option value="2">Segoe UI (Chatterino)</option>
          <option value="3">Roboto</option>
          <option value="4">Lato</option>
          <option value="5">Noto Sans</option>
          <option value="6">Source Code Pro</option>
          <option value="7">Impact</option>
          <option value="8">Comfortaa</option>
          <option value="9">Dancing Script</option>
          <option value="10">Indie Flower</option>
          <option value="11">Open Sans</option>
          <option value="12">Alsina (Vsauce)</option>
          <option value="13">BF Mono</option>
        </SetupSelect>
      ),
    },
    {
      label: () => t("setup.customFontName"),
      hint: () => t("setup.customFontHint"),
      control: (labelId) => (
        <div class="flex flex-col gap-2">
          <Input
            aria-labelledby={labelId}
            type="text"
            value={fontCustom()}
            onInput={(e) => setFontCustom(e.currentTarget.value)}
            placeholder={t("setup.customFontPlaceholder")}
            disabled={font() !== "0"}
            class={cn(font() !== "0" && "opacity-50")}
          />
          <Show when={localFontBrowser()}>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadLocalFonts}
                disabled={font() !== "0" || isLoadingLocalFonts()}
                class="h-10"
              >
                {isLoadingLocalFonts() ? t("setup.loading") : t("setup.local")}
              </Button>
              <SetupSelect
                aria-label={t("setup.selectLocalFont")}
                value=""
                onChange={(e) => {
                  const selectedFont = e.currentTarget.value;
                  if (selectedFont) setFontCustom(selectedFont);
                }}
                disabled={font() !== "0" || localFonts().length === 0}
                class={cn(
                  !(font() === "0" && localFonts().length > 0) && "opacity-50",
                )}
              >
                <option value="">
                  {localFonts().length > 0
                     ? t("setup.selectLocalFont")
                     : t("setup.loadLocalFontsFirst")}
                </option>
                <For each={localFonts()}>
                  {(localFont) => (
                    <option value={localFont.family}>
                      {localFont.family}
                      {localFont.styles.length > 0
                        ? ` (${localFont.styles.join(", ")})`
                        : ""}
                    </option>
                  )}
                </For>
              </SetupSelect>
            </div>
          </Show>
          <div class="text-xs text-muted-foreground">{localFontStatusText()}</div>
        </div>
      ),
    },
    {
      label: () => t("setup.lineHeight"),
      hint: () => t("setup.lineHeightHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.lineHeight")}
          value={lineHeight()}
          onChange={setLineHeight}
          min={80}
          max={200}
          step={1}
        />
      ),
    },
    {
      label: () => t("setup.textWeight"),
      hint: () => t("setup.textWeightHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.textWeight")}
          value={fontWeight()}
          onChange={setFontWeight}
          min={100}
          max={1000}
          step={100}
        />
      ),
    },
    {
      label: () => t("setup.nicknameWeight"),
      hint: () => t("setup.nicknameWeightHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.nicknameWeight")}
          value={nickFontWeight()}
          onChange={setNickFontWeight}
          min={100}
          max={1000}
          step={100}
        />
      ),
    },
    {
      label: () => t("setup.emoteSize"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.emoteSize")}
          value={emoteScale()}
          onChange={setEmoteScale}
          min={0}
          max={3}
          step={0.1}
        />
      ),
    },
    {
      label: () => t("setup.gifSize"),
      hint: () => t("setup.gifSizeHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.gifSize")}
          value={gifScale()}
          onChange={setGifScale}
          min={0.25}
          max={3}
          step={0.1}
        />
      ),
    },
    {
      label: () => t("setup.gigantifiedEmoteSize"),
      hint: () => t("setup.gigantifiedEmoteSizeHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.gigantifiedEmoteSize")}
          value={gigantifiedEmoteScale()}
          onChange={setGigantifiedEmoteScale}
          min={0.25}
          max={3}
          step={0.1}
        />
      ),
    },
  ];
}
