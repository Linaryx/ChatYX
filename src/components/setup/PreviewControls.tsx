import { createEffect, createSignal, onCleanup, onMount, Show, type JSX, type Setter } from "solid-js";
import LiveStreaming02Icon from "@hugeicons/core-free-icons/LiveStreaming02Icon";
import MessageSquareMoreIcon from "@hugeicons/core-free-icons/MessageSquareMoreIcon";
import PauseIcon from "@hugeicons/core-free-icons/PauseIcon";
import PlayIcon from "@hugeicons/core-free-icons/PlayIcon";
import RubberDuckIcon from "@hugeicons/core-free-icons/RubberDuckIcon";
import TestTube01Icon from "@hugeicons/core-free-icons/TestTube01Icon";
import { t } from "~/i18n";
import { cn } from "~/lib/utils";
import { Icon } from "~/components/ui/icon";
import { Slider } from "~/components/ui/slider";
import {
  MAX_MESSAGE_SPEED,
  MESSAGE_SPEED_STEP,
  MIN_MESSAGE_SPEED,
} from "~/config/chatAnimation";
import type { PreviewDemoKind } from "~/services/chat/preview/messages";
import { ColorPickerField } from "./ColorPickerField";

type StageBackdrop = "dark" | "light" | "checker" | "custom";
type PreviewMode = "live" | "demo";

export type PreviewControlsProps = {
  stageBackdrop: () => StageBackdrop;
  setStageBackdrop: (value: StageBackdrop) => void;
  stageColor: () => string;
  setStageColor: (value: string) => void;
  previewMode: () => PreviewMode;
  setPreviewMode: (value: PreviewMode) => void;
  previewDemoKind: () => PreviewDemoKind;
  setPreviewDemoKind: (value: PreviewDemoKind) => void;
  demoPaused: () => boolean;
  setDemoPaused: Setter<boolean>;
  messageSpeedValue: () => number;
  messageSpeedLabel: () => string;
  setMessageSpeed: (value: string) => void;
  hasPreviewChannel: () => boolean;
  /** True when only an external platform is configured, which hides the demo controls. */
  isExternalOnly: () => boolean;
};

/**
 * The preview pane's controls: the backdrop swatches, the chat-mode and
 * demo-scenario selectors, and the demo playback controls.
 *
 * It owns its own selection thumbs, including the refs and the resize observer
 * that measure them, because the measurement is the only reason those refs exist
 * and splitting them across a prop boundary would spread the coordination
 * instead of reducing it.
 */
export function PreviewControls(props: PreviewControlsProps): JSX.Element {
  const {
    stageBackdrop,
    setStageBackdrop,
    stageColor,
    setStageColor,
    previewMode,
    setPreviewMode,
    previewDemoKind,
    setPreviewDemoKind,
    demoPaused,
    setDemoPaused,
    messageSpeedValue,
    messageSpeedLabel,
    setMessageSpeed,
    hasPreviewChannel,
    isExternalOnly,
  } = props;

  // eslint-disable-next-line no-unassigned-vars -- assigned by SolidJS ref={}
  let previewControlsRef: HTMLDivElement | undefined;
  // eslint-disable-next-line no-unassigned-vars -- assigned by SolidJS ref={}
  let previewModeSelectorRef: HTMLDivElement | undefined;
  // eslint-disable-next-line no-unassigned-vars -- assigned by SolidJS ref={}
  let previewLiveOptionRef: HTMLButtonElement | undefined;
  // eslint-disable-next-line no-unassigned-vars -- assigned by SolidJS ref={}
  let previewDemoOptionRef: HTMLButtonElement | undefined;
  // eslint-disable-next-line no-unassigned-vars -- assigned by SolidJS ref={}
  let previewDemoSelectorRef: HTMLDivElement | undefined;
  // eslint-disable-next-line no-unassigned-vars -- assigned by SolidJS ref={}
  let previewPastaOptionRef: HTMLButtonElement | undefined;
  // eslint-disable-next-line no-unassigned-vars -- assigned by SolidJS ref={}
  let previewEmoteOptionRef: HTMLButtonElement | undefined;

  const [previewModeThumbStyle, setPreviewModeThumbStyle] = createSignal<JSX.CSSProperties>({
    opacity: "0",
  });
  const [previewDemoThumbStyle, setPreviewDemoThumbStyle] = createSignal<JSX.CSSProperties>({
    opacity: "0",
  });

  const getPreviewSelectorThumbStyle = (
    selector: HTMLDivElement | undefined,
    option: HTMLButtonElement | undefined,
  ): JSX.CSSProperties => {
    if (!selector || !option) return { opacity: "0" };

    const selectorRect = selector.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    return {
      height: `${optionRect.height}px`,
      opacity: "1",
      transform: `translateY(${optionRect.top - selectorRect.top}px)`,
    };
  };

  const updatePreviewSelectorThumbs = () => {
    setPreviewModeThumbStyle(
      getPreviewSelectorThumbStyle(
        previewModeSelectorRef,
        previewMode() === "live" ? previewLiveOptionRef : previewDemoOptionRef,
      ),
    );
    setPreviewDemoThumbStyle(
      isExternalOnly()
        ? { opacity: "0" }
        : getPreviewSelectorThumbStyle(
            previewDemoSelectorRef,
            previewDemoKind() === "pasta"
              ? previewPastaOptionRef
              : previewEmoteOptionRef,
          ),
    );
  };

  createEffect(updatePreviewSelectorThumbs);
  onMount(() => {
    const observer = new ResizeObserver(updatePreviewSelectorThumbs);
    if (previewControlsRef) observer.observe(previewControlsRef);
    onCleanup(() => observer.disconnect());
  });

  return (
    <div class="setup-preview-options">
      <div class="setup-preview-controls" ref={(element) => (previewControlsRef = element)}>
        <div class="setup-preview-control-panel">
           <div class="setup-preview-control-title">{t("setup.demoBackgroundColor")}</div>
          <div
            class="setup-stage-switcher"
            role="group"
             aria-label={t("setup.previewBackground")}
          >
            <button
              type="button"
              class={cn("setup-stage-option", stageBackdrop() === "dark" && "setup-stage-option--active")}
              aria-pressed={stageBackdrop() === "dark"}
               aria-label={t("setup.blackBackground")}
              onClick={() => setStageBackdrop("dark")}
            >
              <span class="setup-stage-swatch setup-stage-swatch--dark" aria-hidden="true" />
            </button>
            <button
              type="button"
              class={cn("setup-stage-option", stageBackdrop() === "light" && "setup-stage-option--active")}
              aria-pressed={stageBackdrop() === "light"}
               aria-label={t("setup.whiteBackground")}
              onClick={() => setStageBackdrop("light")}
            >
              <span class="setup-stage-swatch setup-stage-swatch--light" aria-hidden="true" />
            </button>
            <button
              type="button"
              class={cn("setup-stage-option", stageBackdrop() === "checker" && "setup-stage-option--active")}
              aria-pressed={stageBackdrop() === "checker"}
               aria-label={t("setup.checkerBackground")}
              onClick={() => setStageBackdrop("checker")}
            >
              <span class="setup-stage-swatch setup-stage-swatch--checker" aria-hidden="true" />
            </button>
            <button
              type="button"
              class={cn("setup-stage-option", stageBackdrop() === "custom" && "setup-stage-option--active")}
              aria-pressed={stageBackdrop() === "custom"}
               aria-label={t("setup.customBackgroundColor")}
              onClick={() => setStageBackdrop("custom")}
            >
              <span class="setup-stage-swatch" style={`background-color: ${stageColor()}`} aria-hidden="true" />
            </button>
          </div>
          <Show when={stageBackdrop() === "custom"}>
            <div class="setup-stage-color">
              <ColorPickerField
                color={stageColor()}
                opacity={100}
                showOpacity={false}
                showTransparencyGrid={false}
                 label={t("setup.backgroundColor")}
                onChange={(value) => setStageColor(value.color)}
              />
            </div>
          </Show>
        </div>
        <div class="setup-preview-control-panel">
           <div class="setup-preview-control-title">{t("setup.previewSettings")}</div>
          <div class="setup-preview-setting-grid">
            <div class="setup-preview-setting">
               <div class="setup-preview-setting-title">{t("setup.chatMode")}</div>
              <div
                class="setup-preview-selector"
                ref={(element) => (previewModeSelectorRef = element)}
                role="radiogroup"
                 aria-label={t("setup.previewChatMode")}
              >
                <div
                  class="setup-selection-thumb"
                  aria-hidden="true"
                  style={previewModeThumbStyle()}
                />
                <button
                  type="button"
                  role="radio"
                  ref={(element) => (previewLiveOptionRef = element)}
                  disabled={!hasPreviewChannel()}
                  aria-checked={previewMode() === "live"}
                  class={cn("setup-preview-selector-option", previewMode() === "live" && "setup-preview-selector-option--selected")}
                  onClick={() => setPreviewMode("live")}
                >
                  <Icon icon={LiveStreaming02Icon} class="setup-preview-selector-icon" aria-hidden="true" />
                   <span>{t("setup.channelChat")}</span>
                </button>
                <Show when={!isExternalOnly()}>
                  <button
                    type="button"
                    role="radio"
                    ref={(element) => (previewDemoOptionRef = element)}
                    aria-checked={previewMode() === "demo"}
                    class={cn("setup-preview-selector-option", previewMode() === "demo" && "setup-preview-selector-option--selected")}
                    onClick={() => setPreviewMode("demo")}
                  >
                    <Icon icon={TestTube01Icon} class="setup-preview-selector-icon" aria-hidden="true" />
                     <span>{t("setup.demo")}</span>
                  </button>
                </Show>
              </div>
            </div>
            <Show when={!isExternalOnly()}>
              <div class="setup-preview-setting">
                 <div class="setup-preview-setting-title">{t("setup.demoScenario")}</div>
                <div
                  class={cn(
                    "setup-preview-selector",
                    previewMode() !== "demo" && "setup-preview-selector--disabled",
                  )}
                  ref={(element) => (previewDemoSelectorRef = element)}
                  role="radiogroup"
                 aria-label={t("setup.demoScenario")}
                >
                  <div
                    class="setup-selection-thumb"
                    aria-hidden="true"
                    style={previewDemoThumbStyle()}
                  />
                  <button
                    type="button"
                    role="radio"
                    ref={(element) => (previewPastaOptionRef = element)}
                    disabled={previewMode() !== "demo"}
                    aria-checked={previewDemoKind() === "pasta"}
                    class={cn("setup-preview-selector-option", previewDemoKind() === "pasta" && "setup-preview-selector-option--selected")}
                    onClick={() => setPreviewDemoKind("pasta")}
                  >
                    <Icon icon={MessageSquareMoreIcon} class="setup-preview-selector-icon" aria-hidden="true" />
                     <span>{t("setup.messages")}</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    ref={(element) => (previewEmoteOptionRef = element)}
                    disabled={previewMode() !== "demo"}
                    aria-checked={previewDemoKind() === "emote"}
                    class={cn("setup-preview-selector-option", previewDemoKind() === "emote" && "setup-preview-selector-option--selected")}
                    onClick={() => setPreviewDemoKind("emote")}
                  >
                    <Icon icon={RubberDuckIcon} class="setup-preview-selector-icon" aria-hidden="true" />
                     <span>{t("setup.emotes")}</span>
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>

      <Show when={previewMode() === "demo"}>
        <div class="setup-preview-playback">
          <div class="setup-preview-speed">
            <span class="text-xs font-medium sm:text-sm">
               {t("setup.speed")}
            </span>
            <Slider
               aria-label={t("setup.messageSpeed")}
              minValue={MIN_MESSAGE_SPEED}
              maxValue={MAX_MESSAGE_SPEED}
               step={MESSAGE_SPEED_STEP}
              value={[messageSpeedValue()]}
              onChange={(values) => {
                const next = values[0];
                if (next !== undefined)
                  setMessageSpeed(String(next));
              }}
              class="min-w-0 flex-1 px-1"
            />
            <div class="whitespace-nowrap text-[11px] font-semibold tabular-nums text-muted-foreground sm:text-xs">
              {messageSpeedLabel()}
            </div>
          </div>
          <button
            type="button"
            class={cn(
              "setup-pause-button",
              demoPaused() && "setup-pause-button--paused",
            )}
            onClick={() => setDemoPaused((value) => !value)}
            aria-pressed={demoPaused()}
          >
            <Show when={demoPaused()} fallback={<Icon icon={PauseIcon} size={14} aria-hidden="true" />}>
              <Icon icon={PlayIcon} size={14} aria-hidden="true" />
            </Show>
             {demoPaused() ? t("setup.resume") : t("setup.pause")}
          </button>
        </div>
      </Show>
    </div>
  );
}
