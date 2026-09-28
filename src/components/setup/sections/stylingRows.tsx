import { t } from "~/i18n";
import { DEFAULT_CHAT_CONFIG } from "~/config/chatUrlParams";
import { toInt } from "~/config/formValues";
import { ColorPickerField } from "../ColorPickerField";
import { SetupNumberField } from "../SetupNumberField";
import { SetupSelect } from "../SetupSelect";
import type { ControlRow } from "../SetupLayout";

/** Form state and callbacks the styling rows read. */
export type StylingRowsSource = {
  shadow: () => string;
  setShadow: (value: string) => void;
  stroke: () => string;
  setStroke: (value: string) => void;
  fade: () => string;
  setFade: (value: string) => void;
  overlayBackgroundColor: () => string;
  setOverlayBackgroundColor: (value: string) => void;
  overlayBackgroundOpacity: () => string;
  setOverlayBackgroundOpacity: (value: string) => void;
  overlayBackgroundRadius: () => string;
  setOverlayBackgroundRadius: (value: string) => void;
  overlayPadding: () => string;
  setOverlayPadding: (value: string) => void;
  overlayBorderWidth: () => string;
  setOverlayBorderWidth: (value: string) => void;
};

/**
 * The appearance/styling section's rows: text shadow and stroke, message
 * lifetime, and the message backing geometry.
 */
export function createStylingRows(source: StylingRowsSource): ControlRow[] {
  const {
    shadow,
    setShadow,
    stroke,
    setStroke,
    fade,
    setFade,
    overlayBackgroundColor,
    setOverlayBackgroundColor,
    overlayBackgroundOpacity,
    setOverlayBackgroundOpacity,
    overlayBackgroundRadius,
    setOverlayBackgroundRadius,
    overlayPadding,
    setOverlayPadding,
    overlayBorderWidth,
    setOverlayBorderWidth,
  } = source;

  return [
    {
      label: () => t("setup.textShadow"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={shadow()}
          onChange={(e) => setShadow(e.currentTarget.value)}
        >
          <option value="0">{t("setup.off")}</option>
          <option value="1">{t("setup.small")}</option>
          <option value="2">{t("setup.medium")}</option>
          <option value="3">{t("setup.large")}</option>
        </SetupSelect>
      ),
    },
    {
      label: () => t("setup.textStroke"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={stroke()}
          onChange={(e) => setStroke(e.currentTarget.value)}
        >
          <option value="0">{t("setup.off")}</option>
          <option value="1">{t("setup.thin")}</option>
          <option value="2">{t("setup.medium")}</option>
          <option value="3">{t("setup.thick")}</option>
          <option value="4">{t("setup.veryThick")}</option>
        </SetupSelect>
      ),
    },
    {
      label: () => t("setup.hideMessagesAfter"),
      hint: () => t("setup.hideMessagesAfterHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.hideMessagesAfter")}
          value={fade()}
          onChange={setFade}
          min={0}
          placeholder="30"
        />
      ),
    },
    {
      label: () => t("setup.messageBackground"),
      control: (_labelId) => (
        <ColorPickerField
          label={t("setup.messageBackground")}
          color={overlayBackgroundColor()}
          opacity={toInt(
            overlayBackgroundOpacity(),
            DEFAULT_CHAT_CONFIG.overlayBackgroundOpacity,
          )}
          onChange={({ color, opacity }) => {
            setOverlayBackgroundColor(color);
            setOverlayBackgroundOpacity(String(opacity));
          }}
        />
      ),
    },
    {
      label: () => t("setup.backgroundRadius"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.backgroundRadius")}
          value={overlayBackgroundRadius()}
          onChange={setOverlayBackgroundRadius}
          min={0}
          max={64}
          step={1}
        />
      ),
    },
    {
      label: () => t("setup.padding"),
      hint: () => t("setup.paddingHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.padding")}
          value={overlayPadding()}
          onChange={setOverlayPadding}
          min={0}
          max={64}
          step={1}
        />
      ),
    },
    {
      label: () => t("setup.borderThickness"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.borderThickness")}
          value={overlayBorderWidth()}
          onChange={setOverlayBorderWidth}
          min={0}
          max={8}
          step={1}
        />
      ),
    },
  ];
}
