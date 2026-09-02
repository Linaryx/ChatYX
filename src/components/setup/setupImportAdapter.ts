import type { ChatAnimationMode } from "~/config/chatUrlParams";
import type { SetupImportPatch } from "~/config/setupImport";

export type SetupImportSetters = {
  readonly channel: (value: string) => void;
  readonly youtubeChannel: (value: string) => void;
  readonly animation: (value: ChatAnimationMode) => void;
  readonly bots: (value: boolean) => void;
  readonly commands: (value: boolean) => void;
  readonly hideSpecialBadges: (value: boolean) => void;
  readonly showHomies: (value: boolean) => void;
  readonly fade: (value: string) => void;
  readonly size: (value: string) => void;
  readonly font: (value: string) => void;
  readonly fontWeight: (value: string) => void;
  readonly fontCustom: (value: string) => void;
  readonly stroke: (value: string) => void;
  readonly shadow: (value: string) => void;
  readonly emoteScale: (value: string) => void;
  readonly smallCaps: (value: boolean) => void;
  readonly nlAfterName: (value: boolean) => void;
  readonly hideNames: (value: boolean) => void;
  readonly botNames: (value: string[]) => void;
  readonly reverseLineOrder: (value: boolean) => void;
  readonly horizontal: (value: boolean) => void;
  readonly singleChatter: (value: string[]) => void;
  readonly show7tvUnlisted: (value: boolean) => void;
  readonly showHighlightedMessages: (value: boolean) => void;
  readonly showGigantifiedEmotes: (value: boolean) => void;
  readonly showChannelPointRewards: (value: boolean) => void;
};

export function applySetupImport(
  patch: SetupImportPatch,
  setters: SetupImportSetters,
): void {
  if (patch.channel !== undefined) setters.channel(patch.channel);
  if (patch.youtubeChannel !== undefined) setters.youtubeChannel(patch.youtubeChannel);
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
}
