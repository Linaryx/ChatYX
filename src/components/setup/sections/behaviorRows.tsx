import { t } from "~/i18n";
import type { ChatAnimationMode, LinkDisplayMode } from "~/config/chatUrlParams";
import { SetupSelect } from "../SetupSelect";
import type { ControlRow, ToggleRow } from "../SetupLayout";

/** Form state and callbacks the behaviour section reads. */
export type BehaviorRowsSource = {
  animation: () => ChatAnimationMode;
  setAnimation: (value: ChatAnimationMode) => void;
  linkMode: () => LinkDisplayMode;
  setLinkMode: (value: LinkDisplayMode) => void;
};

export type BehaviorTogglesSource = {
  twitchEventBold: () => boolean;
  setTwitchEventBold: (value: boolean) => void;
  twitchEventItalic: () => boolean;
  setTwitchEventItalic: (value: boolean) => void;
  recentMessages: () => boolean;
  setRecentMessages: (value: boolean) => void;
  smallCaps: () => boolean;
  setSmallCaps: (value: boolean) => void;
  nlAfterName: () => boolean;
  setNlAfterName: (value: boolean) => void;
  hideNames: () => boolean;
  setHideNames: (value: boolean) => void;
  reverseLineOrder: () => boolean;
  setReverseLineOrder: (value: boolean) => void;
  horizontal: () => boolean;
  setHorizontal: (value: boolean) => void;
};

/** The behaviour section's select rows. */
export function createBehaviorRows(source: BehaviorRowsSource): ControlRow[] {
  const { animation, setAnimation, linkMode, setLinkMode } = source;

  return [
    {
      label: () => t("setup.messageAnimation"),
      hint: () => t("setup.messageAnimationHint"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={animation()}
          onChange={(event) =>
            setAnimation(event.currentTarget.value as ChatAnimationMode)
          }
        >
          <option value="fade">{t("setup.fadeIn")}</option>
          <option value="flow">{t("setup.smoothFlow")}</option>
          <option value="scroll">{t("setup.smoothScroll")}</option>
          <option value="none">{t("setup.noAnimation")}</option>
        </SetupSelect>
      ),
    },
    {
      label: () => t("setup.messageLinks"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={linkMode()}
          onChange={(event) =>
            setLinkMode(event.currentTarget.value as LinkDisplayMode)
          }
        >
          <option value="normal">{t("setup.normalText")}</option>
          <option value="highlight">{t("setup.highlightWithColor")}</option>
          <option value="hide">{t("setup.hide")}</option>
        </SetupSelect>
      ),
    },
  ];
}

/** The behaviour section's switches. */
export function createBehaviorToggles(source: BehaviorTogglesSource): ToggleRow[] {
  const {
    twitchEventBold,
    setTwitchEventBold,
    twitchEventItalic,
    setTwitchEventItalic,
    recentMessages,
    setRecentMessages,
    smallCaps,
    setSmallCaps,
    nlAfterName,
    setNlAfterName,
    hideNames,
    setHideNames,
    reverseLineOrder,
    setReverseLineOrder,
    horizontal,
    setHorizontal,
  } = source;

  return [
    {
      label: () => t("setup.emphasizeEventText"),
      checked: twitchEventBold,
      onChange: setTwitchEventBold,
      hint: () => t("setup.emphasizeEventTextHint"),
    },
    {
      label: () => t("setup.italicEvents"),
      checked: twitchEventItalic,
      onChange: setTwitchEventItalic,
    },
    {
      label: () => t("setup.loadRecentMessages"),
      checked: recentMessages,
      onChange: setRecentMessages,
      hint: () => t("setup.loadRecentMessagesHint"),
    },
    {
      label: () => t("setup.uppercaseNicknames"),
      checked: smallCaps,
      onChange: setSmallCaps,
    },
    {
      label: () => t("setup.lineBreakAfterNickname"),
      checked: nlAfterName,
      onChange: setNlAfterName,
    },
    { label: () => t("setup.hideNicknames"), checked: hideNames, onChange: setHideNames },
    {
      label: () => t("setup.reverseMessageOrder"),
      checked: reverseLineOrder,
      onChange: setReverseLineOrder,
    },
    {
      label: () => t("setup.horizontalMessageFeed"),
      checked: horizontal,
      onChange: setHorizontal,
    },
  ];
}
