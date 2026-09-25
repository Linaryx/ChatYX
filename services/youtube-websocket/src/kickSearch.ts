export type KickSearchResult = {
  slug: string;
  username: string;
  avatarUrl: string;
};

const KICK_SEARCH_ENDPOINT = "https://search.kick.com/api/v1/search";
const MAX_RESULTS = 8;
const MAX_QUERY_LENGTH = 64;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isSafeKickAvatar(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname === "kick.com" || url.hostname.endsWith(".kick.com")
    );
  } catch {
    return false;
  }
}

export function normalizeKickSearchQuery(value: string): string {
  return value.trim().slice(0, MAX_QUERY_LENGTH);
}

export function normalizeKickSearchResults(value: unknown): KickSearchResult[] {
  const channels = asRecord(asRecord(value).data).channels;
  if (!Array.isArray(channels)) return [];

  const results: KickSearchResult[] = [];
  const seen = new Set<string>();
  for (const channel of channels) {
    const entry = asRecord(channel);
    const slug = asString(entry.slug).trim().toLowerCase();
    const username = asString(entry.username).trim();
    const avatarUrl = asString(entry.profile_picture).trim();
    if (!/^[a-z0-9_-]{1,64}$/i.test(slug) || !username || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    results.push({
      slug,
      username: username.slice(0, 64),
      avatarUrl: isSafeKickAvatar(avatarUrl) ? avatarUrl : "",
    });
    if (results.length === MAX_RESULTS) break;
  }
  return results;
}

export async function searchKickChannels(query: string): Promise<KickSearchResult[]> {
  const normalizedQuery = normalizeKickSearchQuery(query);
  if (normalizedQuery.length < 2) return [];

  const url = new URL(KICK_SEARCH_ENDPOINT);
  url.searchParams.set("query", normalizedQuery);
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Kick search failed (${response.status})`);
  return normalizeKickSearchResults(await response.json());
}
