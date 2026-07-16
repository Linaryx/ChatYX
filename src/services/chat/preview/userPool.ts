import { badgeService } from "~/services/badges";
import { twitchGqlService, type TwitchGqlBadge } from "~/services/chat/twitchGqlService";

export type PreviewRealUser = {
  username: string;
  displayName: string;
  role: "broadcaster" | "moderator" | "vip" | "founder" | "";
  userId?: string;
  color?: string;
  badges?: string[];
};

const PREVIEW_COLORS = [
  "#FF0000", "#0000FF", "#00FF00", "#B22222", "#FF7F50",
  "#9ACD32", "#FF4500", "#2E8B57", "#DAA520", "#D2691E",
  "#5F9EA0", "#1E90FF", "#FF69B4", "#8A2BE2", "#00FF7F",
];

const IVR_CHUNK = 50;
const PREVIEW_FETCH_TIMEOUT_MS = 3500;
const MAX_ACTIVE_PREVIEW_VIEWERS = 40;

export type PreviewChatters = {
  broadcasters: string[];
  moderators: string[];
  vips: string[];
  staff: string[];
  viewers: string[];
  chatbots: string[];
};

export let previewRealUsers: PreviewRealUser[] = [];

export function resetUserPool() {
  previewRealUsers = [];
}

export function parsePreviewChatters(payload: any): PreviewChatters {
  const source = payload?.chatters ?? payload;
  const stringList = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];

  return {
    broadcasters: stringList(source?.broadcasters),
    moderators: stringList(source?.moderators),
    vips: stringList(source?.vips),
    staff: stringList(source?.staff),
    viewers: stringList(source?.viewers),
    chatbots: stringList(source?.chatbots),
  };
}

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = PREVIEW_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timeout);
  });
}

async function fetchActiveChatters(channel: string): Promise<PreviewChatters> {
  const urls = [
    `https://api.markzynk.com/twitch/chatters/${encodeURIComponent(channel)}`,
    `https://api.tackling.cc/twitch/Chatters?login=${encodeURIComponent(channel)}&limit=500`,
  ];

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) continue;

      const chatters = parsePreviewChatters(await response.json());
      const count =
        chatters.broadcasters.length +
        chatters.moderators.length +
        chatters.vips.length +
        chatters.staff.length +
        chatters.viewers.length;
      if (count > 0) return chatters;
    } catch {
      // Try the next mirror.
    }
  }

  return parsePreviewChatters(null);
}

export async function resolveChannelId(channel: string): Promise<string> {
  try {
    const resp = await fetchWithTimeout(
      `https://api.ivr.fi/v2/twitch/user?login=${encodeURIComponent(channel)}`,
      undefined,
      2500,
    );
    if (resp.ok) {
      const data = await resp.json();
      const resolved = String(Array.isArray(data) ? data[0]?.id ?? "" : "");
      if (/^\d+$/.test(resolved)) return resolved;
    }
  } catch { /* fallback */ }
  return "0";
}

function badgeToString(badge: TwitchGqlBadge): string | null {
  const setId = badge.setID || badge.setId || "";
  const version = badge.version || "";
  return setId && version ? `${setId}/${version}` : null;
}

function pickPreviewBadges(badges: TwitchGqlBadge[]): string[] {
  const roleBadges: string[] = [];
  const subBadges: string[] = [];
  const vanityBadges: string[] = [];

  for (const badge of badges) {
    const setId = badge.setID || badge.setId || "";
    const badgeString = badgeToString(badge);
    if (!badgeString) continue;

    if (["broadcaster", "lead_moderator", "moderator", "vip"].includes(setId)) {
      roleBadges.push(badgeString);
    } else if (["subscriber", "founder"].includes(setId)) {
      subBadges.push(badgeString);
    } else {
      vanityBadges.push(badgeString);
    }
  }

  const result = [...roleBadges];
  if (subBadges.length > 0) {
    result.push(subBadges[Math.floor(Math.random() * subBadges.length)]);
  }
  if (vanityBadges.length > 0) {
    result.push(vanityBadges[Math.floor(Math.random() * vanityBadges.length)]);
  }

  return result;
}

export async function fetchChannelUsers(
  channel: string,
  channelId = "0",
): Promise<void> {
  previewRealUsers = [];
  previewRealUsers.push({ username: channel, displayName: channel, role: "broadcaster" });

  // Phase 1: mods, VIPs, founders, and public leaderboard users
  try {
    const [modvipResult, foundersResult, leaderboardResult, chattersResult] =
      await Promise.allSettled([
        fetchWithTimeout(
          `https://api.ivr.fi/v2/twitch/modvip/${encodeURIComponent(channel)}`,
        ),
        fetchWithTimeout(
          `https://api.ivr.fi/v2/twitch/founders/${encodeURIComponent(channel)}`,
        ),
        twitchGqlService.loadChannelLeaderboardUsers(channelId),
        fetchActiveChatters(channel),
      ]);

    if (modvipResult.status === "fulfilled" && modvipResult.value.ok) {
      const data = await modvipResult.value.json();
      for (const mod of (data.mods ?? []) as any[]) {
        const login: string = mod.login ?? mod.name ?? "";
        if (login) previewRealUsers.push({ username: login, displayName: mod.displayName ?? login, role: "moderator" });
      }
      for (const vip of (data.vips ?? []) as any[]) {
        const login: string = vip.login ?? vip.name ?? "";
        if (login) previewRealUsers.push({ username: login, displayName: vip.displayName ?? login, role: "vip" });
      }
    }

    if (foundersResult.status === "fulfilled" && foundersResult.value.ok) {
      const data = await foundersResult.value.json();
      const founders: any[] = Array.isArray(data) ? data : (data.founders ?? []);
      for (const founder of founders) {
        const login: string = founder.login ?? founder.name ?? "";
        if (login) previewRealUsers.push({ username: login, displayName: founder.displayName ?? login, role: "founder" });
      }
    }

    if (chattersResult.status === "fulfilled") {
      const chatters = chattersResult.value;
      const addChatters = (
        usernames: string[],
        role: PreviewRealUser["role"],
      ) => {
        for (const username of usernames) {
          previewRealUsers.push({ username, displayName: username, role });
        }
      };

      addChatters(chatters.broadcasters, "broadcaster");
      addChatters(chatters.moderators, "moderator");
      addChatters(chatters.vips, "vip");
      addChatters(chatters.staff, "");

      const chatbotNames = new Set(
        chatters.chatbots.map((username) => username.toLowerCase()),
      );
      addChatters(
        chatters.viewers
          .filter((username) => !chatbotNames.has(username.toLowerCase()))
          .slice(0, MAX_ACTIVE_PREVIEW_VIEWERS),
        "",
      );
    }

    if (leaderboardResult.status === "fulfilled") {
      for (const user of leaderboardResult.value) {
        previewRealUsers.push({
          username: user.login,
          displayName: user.displayName,
          role: "",
          userId: user.id,
        });
      }
    }
  } catch {
    // Non-fatal: preview continues without real users;
  }

  // Deduplicate
  const seen = new Set<string>();
  previewRealUsers = previewRealUsers.filter((u) => {
    const key = u.username.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (previewRealUsers.length === 0) return;

  // Phase 2a: bulk colors + channel badge URLs (awaited)
  const allUsernames = previewRealUsers.map((u) => u.username);
  const loginChunks: string[] = [];
  for (let i = 0; i < allUsernames.length; i += IVR_CHUNK) {
    loginChunks.push(allUsernames.slice(i, i + IVR_CHUNK).join(","));
  }

  const [channelBadgesResult, ...colorResults] = await Promise.allSettled([
    twitchGqlService.loadBadgeSets(channelId),
    ...loginChunks.map((chunk) =>
      fetchWithTimeout(`https://api.ivr.fi/v2/twitch/user?login=${encodeURIComponent(chunk)}`),
    ),
  ]);

  // Apply colors + displayNames
  const infoMap = new Map<string, { color: string; displayName: string; userId: string }>();
  for (const result of colorResults) {
    if (result.status !== "fulfilled" || !result.value.ok) continue;
    const users: any[] = await result.value.json().catch(() => []);
    for (const u of Array.isArray(users) ? users : []) {
      const login: string = (u.login ?? "").toLowerCase();
      if (!login) continue;
      const userId = String(u.id ?? "");
      const color: string = typeof u.chatColor === "string" && u.chatColor.startsWith("#") ? u.chatColor : "";
      infoMap.set(login, { color, displayName: u.displayName ?? "", userId });
    }
  }
  for (const user of previewRealUsers) {
    const info = infoMap.get(user.username.toLowerCase());
    if (info?.displayName) user.displayName = info.displayName;
    if (info?.userId) user.userId = info.userId;
    let hash = 0;
    for (let ci = 0; ci < user.username.length; ci++) hash = (hash * 31 + user.username.charCodeAt(ci)) >>> 0;
    user.color = info?.color || PREVIEW_COLORS[hash % PREVIEW_COLORS.length];
  }

  // Register channel badge image URLs
  if (channelBadgesResult.status === "fulfilled") {
    const badgeList = channelBadgesResult.value;
    const badgeMap = badgeService.getBadgeData().badges;
    for (const badge of badgeList) {
      const setId = badge.setID || badge.setId || "";
      const version = badge.version || "";
      const url = twitchGqlService.getBadgeUrl(badge);
      if (!setId || !url) continue;
      badgeMap[`${setId}:${version}`] = url;
    }
  }

  // Resolve Twitch and third-party badges before rendering preview messages.
  // Use username as key instead of array index to avoid races if the pool is rebuilt.
  const senders = await twitchGqlService.loadSenders(
    channelId,
    previewRealUsers.flatMap((user) => (user.userId ? [user.userId] : [])),
  );
  await Promise.allSettled(
    previewRealUsers.map(async (u) => {
      const login = u.username;
      if (!u.userId) return;

      const sender = senders.get(u.userId);
      await badgeService.loadUserBadges(login, u.userId, true);
      if (!sender) return;

      const user = previewRealUsers.find((x) => x.username === login);
      if (!user) return;

      user.displayName = sender.displayName || user.displayName;
      user.color = sender.chatColor || user.color;
      const badges = pickPreviewBadges(sender.displayBadges);
      if (badges.length > 0) user.badges = badges;
    }),
  );
}
