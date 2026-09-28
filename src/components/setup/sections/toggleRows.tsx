import { t } from "~/i18n";
import type { ToggleRow } from "../SetupLayout";

/** Switches for the content and badges section. */
export type ContentTogglesSource = {
  showHighlightedMessages: () => boolean;
  setShowHighlightedMessages: (value: boolean) => void;
  showChannelPointRewards: () => boolean;
  setShowChannelPointRewards: (value: boolean) => void;
  hideLinkRewards: () => boolean;
  setHideLinkRewards: (value: boolean) => void;
  showGigantifiedEmotes: () => boolean;
  setShowGigantifiedEmotes: (value: boolean) => void;
  showGifs: () => boolean;
  setShowGifs: (value: boolean) => void;
  showPredictions: () => boolean;
  setShowPredictions: (value: boolean) => void;
  commands: () => boolean;
  setCommands: (value: boolean) => void;
  show7tvUnlisted: () => boolean;
  setShow7tvUnlisted: (value: boolean) => void;
};

/** Switches for the narration section. */
export type TtsTogglesSource = {
  rteChatIsTts: () => boolean;
  setRteChatIsTts: (value: boolean) => void;
  rteAzureTts: () => boolean;
  setRteAzureTts: (value: boolean) => void;
};

/** Switches for the RTE section. */
export type RteTogglesSource = {
  rteProxy: () => boolean;
  setRteProxy: (value: boolean) => void;
  rteCustomCosmetics: () => boolean;
  setRteCustomCosmetics: (value: boolean) => void;
};

export function createContentToggles(source: ContentTogglesSource): ToggleRow[] {
  const {
    showHighlightedMessages,
    setShowHighlightedMessages,
    showChannelPointRewards,
    setShowChannelPointRewards,
    hideLinkRewards,
    setHideLinkRewards,
    showGigantifiedEmotes,
    setShowGigantifiedEmotes,
    showGifs,
    setShowGifs,
    showPredictions,
    setShowPredictions,
    commands,
    setCommands,
    show7tvUnlisted,
    setShow7tvUnlisted,
  } = source;

  return [
    {
      label: () => t("setup.showHighlightedMessages"),
      checked: showHighlightedMessages,
      onChange: setShowHighlightedMessages,
    },
    {
      label: () => t("setup.showPointRewards"),
      checked: showChannelPointRewards,
      onChange: setShowChannelPointRewards,
    },
    {
      label: () => t("setup.hideLinkRewards"),
      checked: hideLinkRewards,
      onChange: setHideLinkRewards,
      hint: () => t("setup.hideLinkRewardsHint"),
    },
    {
      label: () => t("setup.showGigantifiedEmotes"),
      checked: showGigantifiedEmotes,
      onChange: setShowGigantifiedEmotes,
    },
    {
      label: () => t("setup.showGifs"),
      checked: showGifs,
      onChange: setShowGifs,
      hint: () => t("setup.showGifsHint"),
    },
    {
      label: () => t("setup.showPredictions"),
      checked: showPredictions,
      onChange: setShowPredictions,
      hint: () => t("setup.showPredictionsHint"),
    },
    {
      label: () => t("setup.showCommands"),
      checked: commands,
      onChange: setCommands,
    },
    {
      label: () => t("setup.showUnlistedEmotes"),
      checked: show7tvUnlisted,
      onChange: setShow7tvUnlisted,
    },
  ];
}

export function createTtsToggles(source: TtsTogglesSource): ToggleRow[] {
  const { rteChatIsTts, setRteChatIsTts, rteAzureTts, setRteAzureTts } = source;

  return [
    {
      label: () => t("setup.chatIsTts"),
      checked: rteChatIsTts,
      onChange: setRteChatIsTts,
      hint: () => t("setup.chatIsTtsHint"),
    },
    {
      label: () => t("setup.azureTts"),
      checked: rteAzureTts,
      onChange: setRteAzureTts,
      hint: () => t("setup.azureTtsHint"),
    },
  ];
}

export function createRteToggles(source: RteTogglesSource): ToggleRow[] {
  const { rteProxy, setRteProxy, rteCustomCosmetics, setRteCustomCosmetics } = source;

  return [
    {
      label: () => t("setup.rteProxy"),
      checked: rteProxy,
      onChange: setRteProxy,
      hint: () => t("setup.rteProxyHint"),
    },
    {
      label: () => t("setup.rteCosmetics"),
      checked: rteCustomCosmetics,
      onChange: setRteCustomCosmetics,
      hint: () => t("setup.rteCosmeticsHint"),
    },
  ];
}
