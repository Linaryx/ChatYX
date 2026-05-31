import { log, LOG_CATEGORIES } from "~/utils/logger";

const RECENT_MESSAGES_MIRRORS = [
  "https://recent-messages.zneix.eu/api/v2/recent-messages",
  "https://recent-messages.robotty.de/api/v2/recent-messages",
] as const;

type RecentMessagesResponse = {
  messages?: unknown;
  error?: unknown;
  error_code?: unknown;
};

function buildRecentMessagesUrl(baseUrl: string, channel: string, limit: number) {
  const url = new URL(`${baseUrl}/${encodeURIComponent(channel)}`);
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

async function fetchRecentMessagesFromMirror(
  baseUrl: string,
  channel: string,
  limit: number,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildRecentMessagesUrl(baseUrl, channel, limit), {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as RecentMessagesResponse;
    if (data.error || data.error_code) {
      throw new Error(String(data.error || data.error_code));
    }

    if (!Array.isArray(data.messages)) {
      return [];
    }

    return data.messages.filter(
      (message): message is string => typeof message === "string",
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchRecentMessages(
  channel: string,
  limit = 25,
  timeoutMs = 1800,
): Promise<string[]> {
  const normalizedChannel = channel.trim().toLowerCase();
  if (!normalizedChannel) return [];

  for (const mirror of RECENT_MESSAGES_MIRRORS) {
    try {
      const messages = await fetchRecentMessagesFromMirror(
        mirror,
        normalizedChannel,
        limit,
        timeoutMs,
      );
      if (messages.length > 0) return messages;
    } catch (error) {
      log.warn(
        LOG_CATEGORIES.CHAT,
        `Failed to load recent messages from ${mirror}`,
        error,
      );
    }
  }

  return [];
}
