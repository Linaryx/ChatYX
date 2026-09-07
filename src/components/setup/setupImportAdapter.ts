import type { SetupImportPatch } from "~/config/setupImport";

export type SetupImportSetters = {
  readonly [K in keyof SetupImportPatch]-?: (
    value: number extends SetupImportPatch[K] ? string
      : NonNullable<SetupImportPatch[K]> extends readonly string[] ? string[]
      : NonNullable<SetupImportPatch[K]>,
  ) => void;
};

export function applySetupImport(
  patch: SetupImportPatch,
  setters: SetupImportSetters,
): void {
  if (patch.channel !== undefined) setters.channel(patch.channel);
  if (patch.youtubeChannel !== undefined) setters.youtubeChannel(patch.youtubeChannel);
  if (patch.platformMarker !== undefined) setters.platformMarker(patch.platformMarker);
  if (patch.showGifs !== undefined) setters.showGifs(patch.showGifs);
  if (patch.gifScale !== undefined) setters.gifScale(String(patch.gifScale));
  if (patch.animation !== undefined) setters.animation(patch.animation);
  if (patch.bots !== undefined) setters.bots(patch.bots);
  if (patch.commands !== undefined) setters.commands(patch.commands);
  if (patch.hideSpecialBadges !== undefined) setters.hideSpecialBadges(patch.hideSpecialBadges);
  if (patch.showHomies !== undefined) setters.showHomies(patch.showHomies);
  if (patch.fade !== undefined) setters.fade(String(patch.fade === false ? 0 : patch.fade));
  if (patch.size !== undefined) setters.size(String(patch.size));
  if (patch.font !== undefined) setters.font(String(patch.font));
  if (patch.fontWeight !== undefined) setters.fontWeight(String(patch.fontWeight));
  if (patch.fontCustom !== undefined) setters.fontCustom(patch.fontCustom);
  if (patch.stroke !== undefined) setters.stroke(String(patch.stroke === false ? 0 : patch.stroke));
  if (patch.shadow !== undefined) setters.shadow(String(patch.shadow === false ? 0 : patch.shadow));
  if (patch.emoteScale !== undefined) setters.emoteScale(String(patch.emoteScale));
  if (patch.smallCaps !== undefined) setters.smallCaps(patch.smallCaps);
  if (patch.nlAfterName !== undefined) setters.nlAfterName(patch.nlAfterName);
  if (patch.hideNames !== undefined) setters.hideNames(patch.hideNames);
  if (patch.botNames !== undefined) setters.botNames([...patch.botNames]);
  if (patch.reverseLineOrder !== undefined) setters.reverseLineOrder(patch.reverseLineOrder);
  if (patch.horizontal !== undefined) setters.horizontal(patch.horizontal);
  if (patch.singleChatter !== undefined) setters.singleChatter([...patch.singleChatter]);
  if (patch.show7tvUnlisted !== undefined) setters.show7tvUnlisted(patch.show7tvUnlisted);
  if (patch.showHighlightedMessages !== undefined) setters.showHighlightedMessages(patch.showHighlightedMessages);
  if (patch.showGigantifiedEmotes !== undefined) setters.showGigantifiedEmotes(patch.showGigantifiedEmotes);
  if (patch.showChannelPointRewards !== undefined) setters.showChannelPointRewards(patch.showChannelPointRewards);
  if (patch.nickFontWeight !== undefined) setters.nickFontWeight(String(patch.nickFontWeight));
  if (patch.messageSpeed !== undefined) setters.messageSpeed(String(patch.messageSpeed));
  if (patch.recentMessages !== undefined) setters.recentMessages(patch.recentMessages);
  if (patch.ffzBotMixBroadcaster !== undefined) setters.ffzBotMixBroadcaster(patch.ffzBotMixBroadcaster);
  if (patch.ffzBotMixModerator !== undefined) setters.ffzBotMixModerator(patch.ffzBotMixModerator);
  if (patch.ffzBotMixVip !== undefined) setters.ffzBotMixVip(patch.ffzBotMixVip);
  if (patch.overlayBackgroundColor !== undefined) setters.overlayBackgroundColor(patch.overlayBackgroundColor);
  if (patch.overlayBackgroundOpacity !== undefined) setters.overlayBackgroundOpacity(String(patch.overlayBackgroundOpacity));
  if (patch.overlayBackgroundRadius !== undefined) setters.overlayBackgroundRadius(String(patch.overlayBackgroundRadius));
  if (patch.overlayBorderOpacity !== undefined) setters.overlayBorderOpacity(String(patch.overlayBorderOpacity));
  if (patch.highlightTwitchEvents !== undefined) setters.highlightTwitchEvents(patch.highlightTwitchEvents);
  if (patch.twitchEventColor !== undefined) setters.twitchEventColor(patch.twitchEventColor);
  if (patch.twitchEventBackgroundOpacity !== undefined) setters.twitchEventBackgroundOpacity(String(patch.twitchEventBackgroundOpacity));
  if (patch.twitchEventBold !== undefined) setters.twitchEventBold(patch.twitchEventBold);
  if (patch.twitchEventItalic !== undefined) setters.twitchEventItalic(patch.twitchEventItalic);
  if (patch.showPredictions !== undefined) setters.showPredictions(patch.showPredictions);
  if (patch.linkMode !== undefined) setters.linkMode(patch.linkMode);
  if (patch.linkColor !== undefined) setters.linkColor(patch.linkColor);
  if (patch.hideLinkRewards !== undefined) setters.hideLinkRewards(patch.hideLinkRewards);
  if (patch.rteProxy !== undefined) setters.rteProxy(patch.rteProxy);
  if (patch.rteAzureTts !== undefined) setters.rteAzureTts(patch.rteAzureTts);
  if (patch.rteChatIsTts !== undefined) setters.rteChatIsTts(patch.rteChatIsTts);
  if (patch.rteReyohohoBadge !== undefined) setters.rteReyohohoBadge(patch.rteReyohohoBadge);
  if (patch.rteCustomCosmetics !== undefined) setters.rteCustomCosmetics(patch.rteCustomCosmetics);
}
