import type { TwitchMessage } from "~/services/chat/twitch/twitchService";

export function selectPreviewModeration(
  messages: readonly TwitchMessage[],
  visibleIds: ReadonlySet<string>,
  random: () => number = Math.random,
): { ids: Set<string>; mutedUsername?: string } | null {
  const visible = messages.filter((message) => visibleIds.has(message.id));
  if (visible.length === 0) return null;
  if (random() < 0.5) {
    const selected = visible[Math.floor(random() * visible.length)];
    return { ids: new Set([selected.id]) };
  }
  const counts = new Map<string, number>();
  for (const message of messages) {
    const username = message.username.toLowerCase();
    counts.set(username, (counts.get(username) ?? 0) + 1);
  }
  // Prefer an author with multiple rows so the demo also exercises batch removal.
  const repeated = visible.filter((message) => (counts.get(message.username.toLowerCase()) ?? 0) > 1);
  const candidates = repeated.length ? repeated : visible;
  const username = candidates[Math.floor(random() * candidates.length)].username.toLowerCase();
  return {
    mutedUsername: username,
    ids: new Set(messages.filter((message) => message.username.toLowerCase() === username).map((message) => message.id)),
  };
}
