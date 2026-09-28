/**
 * Channel search for the setup page's channel field.
 *
 * Twitch answers through its public GQL search-suggestion query and Kick
 * through the project's source bridge. Both normalize to the same shape, and
 * the normalizers are pure so they can be tested without a DOM.
 */
import { TWITCH_GQL_ENDPOINT, TWITCH_WEB_CLIENT_ID } from "~/config/twitch";
import { normalizeLogin } from "./logins";

export type ChannelSuggestion = {
  login: string;
  displayName: string;
  avatarUrl: string;
};

const KICK_SEARCH_ENDPOINT = "https://ytwss.ruina.team/api/kick/channels";

function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeTwitchSearchSuggestions(
  value: unknown,
): ChannelSuggestion[] {
  const payload = Array.isArray(value) ? value[0] : null;
  const edges = (payload as {
    data?: { searchSuggestions?: { edges?: unknown } };
  })?.data?.searchSuggestions?.edges;
  if (!Array.isArray(edges)) return [];

  return edges.flatMap((edge) => {
    if (!edge || typeof edge !== "object") return [];
    const entry = edge as Record<string, unknown>;
    const content = (entry.node as { content?: unknown } | undefined)?.content;
    if (!content || typeof content !== "object") return [];
    const channel = content as Record<string, unknown>;
    const login = normalizeLogin(String(channel.login || ""));
    const displayName = String(entry.text || login).trim();
    const avatarUrl = isSafeHttpsUrl(channel.profileImageURL)
      ? channel.profileImageURL
      : "";
    return channel.__typename === "SearchSuggestionChannel" && login
      ? [{ login, displayName: displayName.slice(0, 64), avatarUrl }]
      : [];
  }).slice(0, 8);
}

function normalizeKickSuggestions(value: unknown): ChannelSuggestion[] {
  const channels = (value as { channels?: unknown })?.channels;
  if (!Array.isArray(channels)) return [];

  return channels.flatMap((channel) => {
    if (!channel || typeof channel !== "object") return [];
    const entry = channel as Record<string, unknown>;
    const login = normalizeLogin(String(entry.slug || ""));
    const displayName = String(entry.username || "").trim();
    const avatarUrl = isSafeHttpsUrl(entry.avatarUrl) ? entry.avatarUrl : "";
    return /^[a-z0-9_-]{1,64}$/i.test(login) && displayName
      ? [{ login, displayName: displayName.slice(0, 64), avatarUrl }]
      : [];
  }).slice(0, 8);
}

export async function searchTwitchChannels(
  query: string,
  signal: AbortSignal,
): Promise<ChannelSuggestion[]> {
  const payload = [{
    operationName: "SearchTray_SearchSuggestions",
    variables: {
      requestID: crypto.randomUUID(),
      queryFragment: query,
      withOfflineChannelContent: true,
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: "1d2cd6ae289d7baa682ef4437ab010c8ea42749ebb81c052f87a8a857ea93378",
      },
    },
  }];
  const response = await fetch(TWITCH_GQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_WEB_CLIENT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) throw new Error(`Twitch search failed (${response.status})`);
  return normalizeTwitchSearchSuggestions(await response.json());
}

export async function searchKickChannels(
  query: string,
  signal: AbortSignal,
): Promise<ChannelSuggestion[]> {
  const url = new URL(KICK_SEARCH_ENDPOINT);
  url.searchParams.set("query", query);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Kick search failed (${response.status})`);
  return normalizeKickSuggestions(await response.json());
}
