/**
 * Bot profile lookup for the setup page.
 *
 * Owns both the pure bot-list helpers and the Twitch/Kick lookups that resolve
 * a login into a display name and avatar, so the route stays presentation and
 * the GQL request shape has a single definition.
 */
import { TWITCH_GQL_ENDPOINT, TWITCH_WEB_CLIENT_ID } from "~/config/twitch";
import { fetchJsonWithTimeout } from "~/services/network/fetchJsonWithTimeout";

export type BotProfile = {
  login: string;
  displayName: string;
  avatarUrl: string;
};

const BOT_PROFILE_TIMEOUT_MS = 3500;

/**
 * Normalizes one pasted login. The leading `@` is stripped so users can paste a
 * handle straight out of a chat client, which `config/chatUrlParams` bot-name
 * parsing deliberately does not do for URL values.
 */
export function normalizeBotLogin(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export function splitBotLogins(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map(normalizeBotLogin)
    .filter(Boolean);
}

export function botFallbackName(login: string): string {
  return login.slice(0, 1).toUpperCase();
}

/** Appends the logins in `raw` that `current` does not already contain. */
export function mergeUniqueLogins(current: string[], raw: string): string[] {
  const nextLogins = splitBotLogins(raw);
  if (nextLogins.length === 0) return current;

  const seen = new Set(current);
  const merged = [...current];

  for (const login of nextLogins) {
    if (seen.has(login)) continue;
    seen.add(login);
    merged.push(login);
  }

  return merged;
}

/** Resolves logins through the public Twitch GQL endpoint in a single request. */
export async function loadTwitchBotProfiles(logins: string[]): Promise<BotProfile[]> {
  if (logins.length === 0) return [];

  try {
    const payload = await fetchJsonWithTimeout(
      TWITCH_GQL_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Client-ID": TWITCH_WEB_CLIENT_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operationName: "ChatYXSetupBotProfiles",
          query: `
            query ChatYXSetupBotProfiles($logins: [String!]!) {
              users(logins: $logins) {
                login
                displayName
                profileImageURL(width: 70)
              }
            }
          `,
          variables: { logins },
        }),
      },
      BOT_PROFILE_TIMEOUT_MS,
    );

    const users = (payload as { data?: { users?: unknown[] } })?.data?.users;
    if (!Array.isArray(users)) return [];

    return users
      .map((user) => {
        if (!user || typeof user !== "object") return null;

        const entry = user as {
          login?: unknown;
          displayName?: unknown;
          profileImageURL?: unknown;
        };
        const login = String(entry.login || "").toLowerCase();
        if (!login) return null;

        return {
          login,
          displayName: String(entry.displayName || entry.login || login),
          avatarUrl: String(entry.profileImageURL || ""),
        };
      })
      .filter((profile): profile is BotProfile => profile !== null);
  } catch {
    return [];
  }
}

/**
 * Kick has no batch endpoint, so each login is looked up on its own and a
 * failure only drops that one entry.
 */
export async function loadKickBotProfiles(logins: string[]): Promise<BotProfile[]> {
  const profiles = await Promise.all(
    logins.map(async (login) => {
      try {
        const payload = await fetchJsonWithTimeout(
          `https://kick.com/api/v2/channels/${encodeURIComponent(login)}/info`,
          {},
          BOT_PROFILE_TIMEOUT_MS,
        );
        const channel = payload as {
          slug?: unknown;
          user?: { username?: unknown; profile_pic?: unknown };
        };
        if (typeof channel.slug !== "string") return null;
        const avatarUrl = channel.user?.profile_pic;

        return {
          login: channel.slug.toLowerCase(),
          displayName:
            typeof channel.user?.username === "string" && channel.user.username.trim()
              ? channel.user.username.trim()
              : channel.slug,
          avatarUrl:
            typeof avatarUrl === "string" && avatarUrl.startsWith("https://")
              ? avatarUrl
              : "",
        };
      } catch {
        return null;
      }
    }),
  );
  return profiles.filter((profile): profile is BotProfile => profile !== null);
}
