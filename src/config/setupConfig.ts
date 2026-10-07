/**
 * Projection from the setup form onto the overlay configuration.
 *
 * The setup form keeps every control as its own signal and the values stay in
 * their raw, user-editable shape — mostly strings — so the inputs can be
 * cleared while typing. This module owns the single step that turns that form
 * state into a `ChatConfig`, and the single step that turns a `ChatConfig` into
 * an overlay URL.
 *
 * Both are the setup page's half of the URL contract in `chatUrlParams`: a
 * value the user typed and the same value arriving back in a URL must land on
 * identical types, which is why the coercion helpers from `formValues` are
 * applied here rather than at the input sites.
 */
import {
  DEFAULT_CHAT_CONFIG,
  chatConfigToSearchParams,
  normalizeBotNames,
  type ChatAnimationMode,
  type ChatConfig,
  type LinkDisplayMode,
  type PlatformMarkerMode,
} from "./chatUrlParams";
import type { EventColorConfig } from "./eventColors";
import {
  normalizeHexColor,
  toClampedInt,
  toFloat,
  toInt,
  toPositiveIntOrFalse,
} from "./formValues";
import { MAX_MESSAGE_SPEED, MIN_MESSAGE_SPEED } from "./chatAnimation";
import type { MessageRemovalMode } from "./chatAnimation";
import { getAppBaseUrl } from "../utils/appBase";

/** Raw setup-form values, before any coercion. */
export type SetupFormState = {
  youtubeChannel: string;
  kickChannel: string;
  size: string;
  font: string;
  lineHeight: string;
  fontWeight: string;
  nickFontWeight: string;
  fontCustom: string;
  shadow: string;
  stroke: string;
  fade: string;
  animation: ChatAnimationMode;
  removalAnimation: MessageRemovalMode;
  fadeAnimation: boolean;
  messageSpeed: string;
  showHomies: boolean;
  show7tvBadges: boolean;
  showFfzBadges: boolean;
  showBttvBadges: boolean;
  showChatterinoBadges: boolean;
  showChatisBadges: boolean;
  showTwitchBadges: boolean;
  showYouTubeBadges: boolean;
  showKickBadges: boolean;
  recentMessages: boolean;
  bots: boolean;
  commands: boolean;
  hideAllBadges: boolean;
  emoteScale: string;
  showGifs: boolean;
  gifScale: string;
  gigantifiedEmoteScale: string;
  botNames: readonly string[];
  kickBotNames: readonly string[];
  youtubeBotNames: readonly string[];
  allowedChatters: readonly string[];
  show7tvUnlisted: boolean;
  smallCaps: boolean;
  nlAfterName: boolean;
  hideNames: boolean;
  reverseLineOrder: boolean;
  horizontal: boolean;
  platformMarker: PlatformMarkerMode;
  ffzBotMixBroadcaster: boolean;
  ffzBotMixModerator: boolean;
  ffzBotMixVip: boolean;
  overlayBackgroundColor: string;
  overlayBackgroundOpacity: string;
  overlayBackgroundRadius: string;
  overlayPadding: string;
  overlayBorderWidth: string;
  overlayBorderColor: string;
  highlightTwitchEvents: boolean;
  eventColorOpacity: string;
  eventColors: EventColorConfig;
  twitchEventBold: boolean;
  twitchEventItalic: boolean;
  showHighlightedMessages: boolean;
  showChannelPointRewards: boolean;
  showGigantifiedEmotes: boolean;
  showPredictions: boolean;
  showPredictionsOnlyWhileActive: boolean;
  linkMode: LinkDisplayMode;
  linkColor: string;
  usersColorEnabled: boolean;
  usersColor: string;
  hideLinkRewards: boolean;
  rteProxy: boolean;
  rteAzureTts: boolean;
  rteChatIsTts: boolean;
  rteReyohohoBadge: boolean;
  rteCustomCosmetics: boolean;
};

/**
 * `selectedChannel` stays a separate argument because the preview and the
 * exported link deliberately project the same form onto different channels.
 */
export function buildSetupConfig(
  form: SetupFormState,
  selectedChannel: string,
): ChatConfig {
  return {
    ...DEFAULT_CHAT_CONFIG,
    channel: selectedChannel,
    youtubeChannel: form.youtubeChannel.trim().replace(/^@/, ""),
    kickChannel: form.kickChannel.trim().replace(/^@/, ""),
    size: toInt(form.size, DEFAULT_CHAT_CONFIG.size),
    font: toInt(form.font, DEFAULT_CHAT_CONFIG.font),
    lineHeight: toClampedInt(
      form.lineHeight,
      DEFAULT_CHAT_CONFIG.lineHeight,
      80,
      200,
    ),
    fontWeight: toClampedInt(
      form.fontWeight,
      DEFAULT_CHAT_CONFIG.fontWeight,
      100,
      1000,
    ),
    nickFontWeight: toClampedInt(
      form.nickFontWeight,
      DEFAULT_CHAT_CONFIG.nickFontWeight,
      100,
      1000,
    ),
    fontCustom: form.fontCustom,
    shadow: toPositiveIntOrFalse(form.shadow),
    stroke: toPositiveIntOrFalse(form.stroke),
    fade: toPositiveIntOrFalse(form.fade),
    animation: form.animation,
    removalAnimation: form.removalAnimation,
    fadeAnimation: form.fadeAnimation,
    messageSpeed: toClampedInt(
      form.messageSpeed,
      DEFAULT_CHAT_CONFIG.messageSpeed,
      MIN_MESSAGE_SPEED,
      MAX_MESSAGE_SPEED,
    ),
    showHomies: form.showHomies,
    show7tvBadges: form.show7tvBadges,
    showFfzBadges: form.showFfzBadges,
    showBttvBadges: form.showBttvBadges,
    showChatterinoBadges: form.showChatterinoBadges,
    showChatisBadges: form.showChatisBadges,
    showTwitchBadges: form.showTwitchBadges,
    showYouTubeBadges: form.showYouTubeBadges,
    showKickBadges: form.showKickBadges,
    recentMessages: form.recentMessages,
    bots: form.bots,
    commands: form.commands,
    hideAllBadges: form.hideAllBadges,
    emoteScale: toFloat(form.emoteScale, DEFAULT_CHAT_CONFIG.emoteScale),
    showGifs: form.showGifs,
    gifScale: toFloat(form.gifScale, DEFAULT_CHAT_CONFIG.gifScale),
    gigantifiedEmoteScale: toFloat(
      form.gigantifiedEmoteScale,
      DEFAULT_CHAT_CONFIG.gigantifiedEmoteScale,
    ),
    botNames: normalizeBotNames(form.botNames.join(",")),
    kickBotNames: normalizeBotNames(form.kickBotNames.join(",")),
    youtubeBotNames: normalizeBotNames(form.youtubeBotNames.join(",")),
    singleChatter: normalizeBotNames(form.allowedChatters.join(",")),
    show7tvUnlisted: form.show7tvUnlisted,
    smallCaps: form.smallCaps,
    nlAfterName: form.nlAfterName,
    hideNames: form.hideNames,
    reverseLineOrder: form.reverseLineOrder,
    horizontal: form.horizontal,
    platformMarker: form.platformMarker,
    ffzBotMixCustom: true,
    ffzBotMixBroadcaster: form.ffzBotMixBroadcaster,
    ffzBotMixModerator: form.ffzBotMixModerator,
    ffzBotMixVip: form.ffzBotMixVip,
    overlayBackgroundColor: normalizeHexColor(
      form.overlayBackgroundColor,
      DEFAULT_CHAT_CONFIG.overlayBackgroundColor,
    ),
    overlayBackgroundOpacity: toInt(
      form.overlayBackgroundOpacity,
      DEFAULT_CHAT_CONFIG.overlayBackgroundOpacity,
    ),
    overlayBackgroundRadius: toInt(
      form.overlayBackgroundRadius,
      DEFAULT_CHAT_CONFIG.overlayBackgroundRadius,
    ),
    overlayPadding: toInt(form.overlayPadding, DEFAULT_CHAT_CONFIG.overlayPadding),
    overlayBorderWidth: toInt(
      form.overlayBorderWidth,
      DEFAULT_CHAT_CONFIG.overlayBorderWidth,
    ),
    overlayBorderColor: normalizeHexColor(
      form.overlayBorderColor,
      DEFAULT_CHAT_CONFIG.overlayBorderColor,
      true,
    ),
    highlightTwitchEvents: form.highlightTwitchEvents,
    eventColorOpacity: toInt(
      form.eventColorOpacity,
      DEFAULT_CHAT_CONFIG.eventColorOpacity,
    ),
    ...form.eventColors,
    twitchEventBold: form.twitchEventBold,
    twitchEventItalic: form.twitchEventItalic,
    showHighlightedMessages: form.showHighlightedMessages,
    showChannelPointRewards: form.showChannelPointRewards,
    showGigantifiedEmotes: form.showGigantifiedEmotes,
    showPredictions: form.showPredictions,
    showPredictionsOnlyWhileActive: form.showPredictionsOnlyWhileActive,
    linkMode: form.linkMode,
    linkColor: normalizeHexColor(form.linkColor, DEFAULT_CHAT_CONFIG.linkColor),
    usersColor: form.usersColorEnabled
      ? normalizeHexColor(form.usersColor, "#ffffff")
      : "",
    hideLinkRewards: form.hideLinkRewards,
    rteProxy: form.rteProxy,
    rteAzureTts: form.rteAzureTts,
    rteChatIsTts: form.rteChatIsTts,
    rteReyohohoBadge: form.rteReyohohoBadge,
    rteCustomCosmetics: form.rteCustomCosmetics,
  };
}

/**
 * Builds the overlay link. `includeMessageSpeed: false` drops the `ms` parameter
 * for the embedded preview, which must follow the preview's own pacing rather
 * than the exported message speed. `baseUrl` exists so the URL contract can be
 * asserted in tests without a document to derive the app base from.
 */
export function buildOverlayUrl(
  cfg: ChatConfig,
  extraParams?: Record<string, string>,
  options?: { includeMessageSpeed?: boolean; baseUrl?: string },
): string {
  const params = chatConfigToSearchParams(cfg);
  if (options?.includeMessageSpeed === false) {
    params.delete("ms");
  }
  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => params.set(key, value));
  }
  const query = params.toString();
  const baseUrl = options?.baseUrl ?? getAppBaseUrl();
  return `${baseUrl}/chat/${query ? `?${query}` : ""}`;
}
