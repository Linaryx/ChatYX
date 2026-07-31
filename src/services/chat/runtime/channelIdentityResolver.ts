import { FALLBACK_APIS, TWITCH_CONFIG, fetchWithFallback } from "~/config/twitch";
import { LOG_CATEGORIES, log } from "~/utils/logger";

export type ChannelIdentity = {
  channelId: string;
  displayName: string;
};

const EMPTY_CHANNEL_IDENTITY: ChannelIdentity = {
  channelId: "",
  displayName: "",
};

function isTwitchUserId(value: string) {
  return /^\d+$/.test(value) && value !== "0";
}

function getDisplayName(entry: Record<string, unknown>) {
  return String(
    entry.display_name ?? entry.displayName ?? entry.login ?? "",
  );
}

function parseChannelIdentity(payload: unknown): ChannelIdentity | null {
  const data = payload as {
    data?: Array<Record<string, unknown>>;
  } | Array<Record<string, unknown>>;
  const entry = Array.isArray(data) ? data[0] : data.data?.[0];
  const channelId = String(entry?.id ?? "");

  if (!entry || !isTwitchUserId(channelId)) return null;
  return { channelId, displayName: getDisplayName(entry) };
}

export class ChannelIdentityResolver {
  constructor(private readonly channel: string) {}

  async resolve(): Promise<ChannelIdentity> {
    try {
      const response = await fetchWithFallback(
        `${TWITCH_CONFIG.API_BASE_URL}/users?login=${encodeURIComponent(this.channel)}`,
        FALLBACK_APIS.user_info(this.channel),
      );

      if (!response.ok) {
        log.warn(
          LOG_CATEGORIES.TWITCH_IRC,
          "Failed to get channel ID, using channel name as fallback",
        );
        return EMPTY_CHANNEL_IDENTITY;
      }

      const identity = parseChannelIdentity(await response.json());
      if (identity) return identity;

      log.warn(
        LOG_CATEGORIES.TWITCH_IRC,
        "Unexpected API response format, using channel name as fallback",
      );
      return EMPTY_CHANNEL_IDENTITY;
    } catch (error) {
      log.warn(
        LOG_CATEGORIES.TWITCH_IRC,
        "Failed to get channel ID, using channel name as fallback",
        error,
      );
      return EMPTY_CHANNEL_IDENTITY;
    }
  }
}
