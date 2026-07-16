import type { ChatConfig } from "~/config/chatUrlParams";
import type { TwitchMessage } from "~/services/chat/twitchService";

const DOMAIN =
  "(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,63}";
const HOST = `(?:${DOMAIN}|(?:\\d{1,3}\\.){3}\\d{1,3}|localhost)`;
const URL_SUFFIX =
  "(?::\\d{2,5})?(?:[/?#][a-z0-9\\-._~%!$&()*+,;=:@/?#]*)?";
const LINK_PATTERN = new RegExp(
  `(?:https?:\\/\\/${HOST}|www\\.${DOMAIN})${URL_SUFFIX}|${DOMAIN}${URL_SUFFIX}`,
  "gi",
);
const TRAILING_PUNCTUATION = /[),.!?;:\]}]+$/;

export type LinkSegment = {
  kind: "text" | "link";
  value: string;
};

export function tokenizeLinks(text: string): LinkSegment[] {
  const segments: LinkSegment[] = [];
  const matches = text.matchAll(new RegExp(LINK_PATTERN.source, LINK_PATTERN.flags));
  let cursor = 0;

  for (const match of matches) {
    const index = match.index ?? 0;
    if (index > 0 && !/[\s([{'"]/.test(text[index - 1])) continue;

    const raw = match[0];
    const trailing = raw.match(TRAILING_PUNCTUATION)?.[0] || "";
    const link = trailing ? raw.slice(0, -trailing.length) : raw;
    if (!link) continue;

    if (index > cursor) {
      segments.push({ kind: "text", value: text.slice(cursor, index) });
    }
    segments.push({ kind: "link", value: link });
    if (trailing) segments.push({ kind: "text", value: trailing });
    cursor = index + raw.length;
  }

  if (cursor < text.length) {
    segments.push({ kind: "text", value: text.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ kind: "text", value: text }];
}

export function containsLink(text: string): boolean {
  return tokenizeLinks(text).some((segment) => segment.kind === "link");
}

export function shouldHideLinkedReward(
  message: TwitchMessage,
  config: Pick<ChatConfig, "hideLinkRewards">,
): boolean {
  if (!config.hideLinkRewards || message.twitchEvent?.type !== "reward") {
    return false;
  }

  return [
    message.message,
    message.channelPointReward?.title || "",
    message.channelPointReward?.prompt || "",
  ].some(containsLink);
}
