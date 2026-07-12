// API base URL — set VITE_API_URL in .env to point to your own backend.
// Falls back to localhost:3002 for local development.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3002";

export const TWITCH_CONFIG = {
  API_BASE_URL: `${API_BASE}/api/twitch`,

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

// Cache the local API availability so we only probe once per session
let localApiAvailable: boolean | null = null;

async function checkLocalApi(): Promise<boolean> {
  if (localApiAvailable !== null) return localApiAvailable;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${API_BASE}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    localApiAvailable = response.ok;
  } catch {
    localApiAvailable = false;
  }

  return localApiAvailable;
}

export async function fetchWithFallback(
  primaryUrl: string,
  fallbackUrl: string | null = null,
  options?: RequestInit,
): Promise<Response> {
  const isLocalRequest = primaryUrl.startsWith(API_BASE);

  if (isLocalRequest) {
    const available = await checkLocalApi();
    if (!available) {
      if (fallbackUrl) return fetch(fallbackUrl, options);
      return new Response(JSON.stringify({ error: "API unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    const response = await fetch(primaryUrl, options);
    if (response.ok) return response;

    if (fallbackUrl) {
      const fallback = await fetch(fallbackUrl, options);
      if (fallback.ok) return fallback;
    }

    return response;
  } catch (error) {
    if (fallbackUrl) {
      try {
        const fallback = await fetch(fallbackUrl, options);
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
