import { networkClient } from "~/services/network/networkClient";

// Production only uses a backend when explicitly configured.
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export const TWITCH_CONFIG = {
  API_BASE_URL: API_BASE ? `${API_BASE}/api/twitch` : "",

  TWITCH_API_BASE: "https://api.twitch.tv/helix",
  TWITCH_OAUTH_URL: "https://id.twitch.tv/oauth2/token",
};

export const FALLBACK_APIS = {
  badges_global: "https://api.ivr.fi/v2/twitch/badges/global",
  badges_channel: (channelName: string) =>
    `https://api.ivr.fi/v2/twitch/badges/channel?login=${encodeURIComponent(channelName)}`,
  user_info: (channelName: string) =>
    `https://api.ivr.fi/v2/twitch/user?login=${encodeURIComponent(channelName)}`,
  // Cheermotes require a local API with OAuth — no public endpoint available
  cheermotes: null,
};

export async function fetchWithFallback(
  primaryUrl: string,
  fallbackUrl: string | null = null,
  options?: RequestInit,
): Promise<Response> {
  const requestFallback = (url: string) =>
    networkClient.request(url, { route: "rte", init: options });

  if (!API_BASE && primaryUrl.startsWith("/")) {
    if (fallbackUrl) return requestFallback(fallbackUrl);
    return new Response(JSON.stringify({ error: "API unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(primaryUrl, options);
    if (response.ok) return response;

    if (fallbackUrl) {
      const fallback = await requestFallback(fallbackUrl);
      if (fallback.ok) return fallback;
    }

    return response;
  } catch (error) {
    if (fallbackUrl) {
      try {
        const fallback = await requestFallback(fallbackUrl);
        if (fallback.ok) return fallback;
      } catch { /* fallback also failed, fall through */ }
    }
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for API compatibility
export async function getTwitchAccessToken(): Promise<string | null> {
  return null;
}
