import type { TwitchEventType } from "~/services/chat/twitch/twitchService";

export function isReplyEligibleEvent(
  eventType: TwitchEventType | undefined,
): boolean {
  return (
    eventType === undefined ||
    eventType === "first-message" ||
    eventType === "highlighted-message"
  );
}
