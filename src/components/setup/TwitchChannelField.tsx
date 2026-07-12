import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  type JSX,
} from "solid-js";
import "./TwitchChannelField.css";

type TwitchChannelFieldProps = {
  value: string;
  onChange: (login: string) => void;
};

type TwitchChannelProfile = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string;
};

type TwitchChannelSummary = {
  profile: TwitchChannelProfile;
  emotes: {
    twitch: number;
    sevenTv: number;
    bttv: number;
    ffz: number;
  };
  roles: {
    moderators: number;
    vips: number;
    founders: number;
    leadModerators: number;
    artists: number;
  };
};

type Metric = {
  key: string;
  label: string;
  value: number;
  icon: "twitch" | "sevenTv" | "bttv" | "ffz" | "vip" | "mod" | "founder" | "lead" | "artist";
};

const TWITCH_GQL_ENDPOINT = "https://gql.twitch.tv/gql";
const TWITCH_WEB_CLIENT_ID =
  import.meta.env.VITE_TWITCH_GQL_CLIENT_ID || "kimne78kx3ncx6brgo4mv6wki5h1ko";
const SUMMARY_TIMEOUT_MS = 4000;
const METRIC_IMAGE_ICON_URLS: Partial<Record<Metric["icon"], string>> = {
  bttv: "https://betterttv.com/favicon.png",
  ffz: "https://www.frankerfacez.com/static/images/favicon-32.png",
  mod: "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3",
  vip: "https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3",
  founder: "https://static-cdn.jtvnw.net/badges/v1/511b78a9-ab37-472f-9569-457753bbe7d3/3",
  artist: "https://static-cdn.jtvnw.net/badges/v1/4300a897-03dc-4e83-8c0e-c332fee7057f/3",
};

function normalizeLogin(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

function fallbackName(login: string): string {
  return login.slice(0, 1).toUpperCase();
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function uniqueCount(values: Array<string | number | undefined | null>): number {
  return new Set(values.filter((value) => value !== undefined && value !== null)).size;
}

async function fetchJsonWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = SUMMARY_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchTwitchGql(query: string, variables: Record<string, unknown>) {
  const payload = await fetchJsonWithTimeout(TWITCH_GQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_WEB_CLIENT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operationName: "ChatYXSetupChannelSummary",
      query,
      variables,
    }),
  });

  return (payload as { data?: unknown })?.data;
}

async function loadChannelProfile(login: string): Promise<TwitchChannelProfile | null> {
  try {
    const data = await fetchTwitchGql(
      `
        query ChatYXSetupChannelSummary($logins: [String!]!) {
          users(logins: $logins) {
            id
            login
            displayName
            profileImageURL(width: 96)
          }
        }
      `,
      { logins: [login] },
    );
    const user = (data as { users?: unknown[] })?.users?.[0];
    if (user && typeof user === "object") {
      const entry = user as {
        id?: unknown;
        login?: unknown;
        displayName?: unknown;
        profileImageURL?: unknown;
      };
      const id = String(entry.id || "");
      const resolvedLogin = normalizeLogin(String(entry.login || login));
      if (id && resolvedLogin) {
        return {
          id,
          login: resolvedLogin,
          displayName: String(entry.displayName || entry.login || resolvedLogin),
          avatarUrl: String(entry.profileImageURL || ""),
        };
      }
    }
  } catch {
    // IVR fallback below.
  }

  try {
    const payload = await fetchJsonWithTimeout(
      `https://api.ivr.fi/v2/twitch/user?login=${encodeURIComponent(login)}`,
      undefined,
      3000,
    );
    const user = Array.isArray(payload) ? payload[0] : null;
    if (!user || typeof user !== "object") return null;

    const entry = user as {
      id?: unknown;
      login?: unknown;
      displayName?: unknown;
      logo?: unknown;
    };
    const id = String(entry.id || "");
    const resolvedLogin = normalizeLogin(String(entry.login || login));
    if (!id || !resolvedLogin) return null;

    return {
      id,
      login: resolvedLogin,
      displayName: String(entry.displayName || entry.login || resolvedLogin),
      avatarUrl: String(entry.logo || ""),
    };
  } catch {
    return null;
  }
}

async function loadTwitchEmoteCount(login: string): Promise<number> {
  try {
    const data = await fetchTwitchGql(
      `
        query ChatYXSetupChannelSummary($login: String!) {
          user(login: $login) {
            channel {
              localEmoteSets {
                emotes {
                  id
                }
              }
            }
          }
        }
      `,
      { login },
    );
    const emoteSets = (data as any)?.user?.channel?.localEmoteSets;
    if (!Array.isArray(emoteSets)) return 0;

    return uniqueCount(
      emoteSets.flatMap((set) =>
        Array.isArray(set?.emotes)
          ? set.emotes.map((emote: { id?: unknown }) => String(emote.id || ""))
          : [],
      ),
    );
  } catch {
    return 0;
  }
}

async function loadSevenTvEmoteCount(channelId: string): Promise<number> {
  try {
    const data = await fetchJsonWithTimeout(
      `https://7tv.io/v3/users/twitch/${encodeURIComponent(channelId)}`,
      undefined,
      3500,
    );
    return countArray((data as any)?.emote_set?.emotes);
  } catch {
    return 0;
  }
}

async function loadBttvEmoteCount(channelId: string): Promise<number> {
  try {
    const data = await fetchJsonWithTimeout(
      `https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(channelId)}`,
      undefined,
      3500,
    );
    return (
      countArray((data as any)?.channelEmotes) +
      countArray((data as any)?.sharedEmotes)
    );
  } catch {
    return 0;
  }
}

async function loadFfzEmoteCount(channelId: string): Promise<number> {
  try {
    const data = await fetchJsonWithTimeout(
      `https://api.frankerfacez.com/v1/room/id/${encodeURIComponent(channelId)}`,
      undefined,
      3500,
    );
    const sets = (data as any)?.sets;
    if (!sets || typeof sets !== "object") return 0;

    return Object.values(sets as Record<string, unknown>).reduce<number>(
      (total, set) => total + countArray((set as { emoticons?: unknown })?.emoticons),
      0,
    );
  } catch {
    return 0;
  }
}

async function loadArtistCount(login: string): Promise<number> {
  try {
    const data = await fetchJsonWithTimeout(
      `https://api.tackling.cc/twitch/Artists?login=${encodeURIComponent(login)}`,
      undefined,
      3500,
    );
    const total = Number((data as { totalArtists?: unknown })?.totalArtists);
    if (Number.isFinite(total) && total >= 0) return total;

    return countArray((data as { artists?: unknown })?.artists);
  } catch {
    return 0;
  }
}

async function loadRoleCounts(login: string): Promise<TwitchChannelSummary["roles"]> {
  const roles: TwitchChannelSummary["roles"] = {
    moderators: 0,
    vips: 0,
    founders: 0,
    leadModerators: 0,
    artists: 0,
  };

  const [artistsResult, modVipResult, foundersResult] = await Promise.allSettled([
    loadArtistCount(login),
    fetchJsonWithTimeout(
      `https://api.ivr.fi/v2/twitch/modvip/${encodeURIComponent(login)}`,
      undefined,
      3500,
    ),
    fetchJsonWithTimeout(
      `https://api.ivr.fi/v2/twitch/founders/${encodeURIComponent(login)}`,
      undefined,
      3500,
    ),
  ]);

  if (modVipResult.status === "fulfilled") {
    roles.moderators = countArray((modVipResult.value as any)?.mods);
    roles.vips = countArray((modVipResult.value as any)?.vips);
  }

  if (foundersResult.status === "fulfilled") {
    const founders = Array.isArray(foundersResult.value)
      ? foundersResult.value
      : (foundersResult.value as any)?.founders;
    roles.founders = countArray(founders);
  }

  if (artistsResult.status === "fulfilled") {
    roles.artists = artistsResult.value;
  }

  return roles;
}

async function loadChannelSummary(login: string): Promise<TwitchChannelSummary | null> {
  const profile = await loadChannelProfile(login);
  if (!profile) return null;

  const [twitch, sevenTv, bttv, ffz, roles] = await Promise.all([
    loadTwitchEmoteCount(profile.login),
    loadSevenTvEmoteCount(profile.id),
    loadBttvEmoteCount(profile.id),
    loadFfzEmoteCount(profile.id),
    loadRoleCounts(profile.login),
  ]);

  return {
    profile,
    emotes: { twitch, sevenTv, bttv, ffz },
    roles,
  };
}

function metricImageIcon(src: string): JSX.Element {
  return (
    <img
      class="twitch-channel-metric-image"
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

function metricIcon(type: Metric["icon"]): JSX.Element {
  const imageUrl = METRIC_IMAGE_ICON_URLS[type];
  if (imageUrl) return metricImageIcon(imageUrl);

  switch (type) {
    case "twitch":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
        </svg>
      );
    case "sevenTv":
      return (
        <svg viewBox="0 0 28 20" aria-hidden="true">
          <path d="M20.7465 5.48825 21.9799 3.33745 22.646 2.20024 21.4125 0.0494437V0H14.8259L17.2928 4.3016 17.9836 5.48825H20.7465Z" />
          <path d="M7.15395 19.9258 14.5546 7.02104 15.4673 5.43884 13.0004 1.13724 12.3097 0.0247596H1.8995L0.666057 2.17556 0 3.31276 1.23344 5.46356V5.51301H9.12745L2.96025 16.267 2.09685 17.7998 3.33029 19.9506V20H7.15395" />
          <path d="M17.4655 19.9257H21.2398L26.1736 11.3225 27.037 9.83924 25.8036 7.68844V7.63899H22.0046L19.5377 11.9406 19.365 12.262 16.8981 7.96038 16.7255 7.63899 14.2586 11.9406 13.5679 13.1272 17.2682 19.5796 17.4655 19.9257Z" />
        </svg>
      );
    case "bttv":
    case "ffz":
    case "vip":
    case "mod":
      return <span />;
    case "founder":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5 3 7v7c0 4 3.8 7.2 9 8 5.2-.8 9-4 9-8V7l-9-4.5Zm0 4.2 4.5 2.2v4.6c0 2.1-1.8 3.8-4.5 4.5-2.7-.7-4.5-2.4-4.5-4.5V8.9L12 6.7Z" />
          <path d="m12 8.3 1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4L12 8.3Z" />
        </svg>
      );
    case "lead":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2 4 5.7v6.4c0 4.7 3.3 8.5 8 9.9 4.7-1.4 8-5.2 8-9.9V5.7L12 2Zm0 4 4 1.8v4.1c0 2.2-1.4 4.1-4 5.2-2.6-1.1-4-3-4-5.2V7.8L12 6Z" />
          <path d="M11 8.5h2v2.7h2.7v2H13V16h-2v-2.8H8.3v-2H11V8.5Z" />
        </svg>
      );
    case "artist":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a9 9 0 0 0 0 18h1.8a2.4 2.4 0 0 0 1.6-4.2l-.9-.8h1.3A4.7 4.7 0 0 0 20.5 11C20.5 6.6 16.7 3 12 3ZM7.6 10.2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm4.4-2.6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm-4.1 6.8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm4.3 2.2a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z" />
        </svg>
      );
  }
}

export function TwitchChannelField(props: TwitchChannelFieldProps) {
  const [input, setInput] = createSignal("");
  const [summary, setSummary] = createSignal<TwitchChannelSummary | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [failedLogin, setFailedLogin] = createSignal("");

  const login = createMemo(() => normalizeLogin(props.value));
  const metrics = createMemo<Metric[]>(() => {
    const data = summary();
    if (!data) return [];

    const allMetrics: Metric[] = [
      { key: "twitch", label: "Twitch эмоуты", value: data.emotes.twitch, icon: "twitch" },
      { key: "seven-tv", label: "7TV эмоуты", value: data.emotes.sevenTv, icon: "sevenTv" },
      { key: "bttv", label: "BTTV эмоуты", value: data.emotes.bttv, icon: "bttv" },
      { key: "ffz", label: "FFZ эмоуты", value: data.emotes.ffz, icon: "ffz" },
      { key: "vips", label: "VIP", value: data.roles.vips, icon: "vip" },
      { key: "mods", label: "Модераторы", value: data.roles.moderators, icon: "mod" },
      { key: "founders", label: "Основатели", value: data.roles.founders, icon: "founder" },
      { key: "leadmods", label: "Лидмодеры", value: data.roles.leadModerators, icon: "lead" },
      { key: "artists", label: "Артисты", value: data.roles.artists, icon: "artist" },
    ];

    return allMetrics.filter((metric) => metric.value > 0);
  });

  createEffect(() => {
    const currentLogin = login();
    if (!currentLogin) {
      setSummary(null);
      setLoading(false);
      setFailedLogin("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailedLogin("");

    const timeout = window.setTimeout(() => {
      void loadChannelSummary(currentLogin)
        .then((nextSummary) => {
          if (cancelled) return;
          setSummary(nextSummary);
          if (!nextSummary) setFailedLogin(currentLogin);
        })
        .catch(() => {
          if (cancelled) return;
          setSummary(null);
          setFailedLogin(currentLogin);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 160);

    onCleanup(() => {
      cancelled = true;
      window.clearTimeout(timeout);
    });
  });

  const commitInput = () => {
    const nextLogin = normalizeLogin(input());
    if (!nextLogin) return;
    props.onChange(nextLogin);
    setInput("");
  };

  const clearChannel = () => {
    props.onChange("");
    setInput("");
    setSummary(null);
    setFailedLogin("");
  };

  const displayName = createMemo(
    () => summary()?.profile.displayName || props.value || failedLogin(),
  );
  const avatarUrl = createMemo(() => summary()?.profile.avatarUrl || "");

  return (
    <div class="twitch-channel-field">
      {login() ? (
        <div
          class="twitch-channel-chip"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Backspace" || event.key === "Delete") {
              event.preventDefault();
              clearChannel();
            }
          }}
        >
          {avatarUrl() ? (
            <img
              class="twitch-channel-avatar"
              src={avatarUrl()}
              alt=""
              loading="lazy"
            />
          ) : (
            <span class="twitch-channel-avatar-fallback">
              {fallbackName(login())}
            </span>
          )}
          <span class="twitch-channel-main">
            <span class="twitch-channel-title-row">
              <span class="twitch-channel-name">{displayName()}</span>
              {loading() && <span class="twitch-channel-loading" />}
            </span>
            <span class="twitch-channel-metrics">
              <For each={metrics()}>
                {(metric) => (
                  <span
                    class="twitch-channel-metric"
                    data-metric={metric.key}
                    title={metric.label}
                  >
                    {metricIcon(metric.icon)}
                    {compactNumber(metric.value)}
                  </span>
                )}
              </For>
            </span>
          </span>
          <button
            type="button"
            class="twitch-channel-remove"
            onClick={clearChannel}
            aria-label="Убрать Twitch канал"
          >
            ×
          </button>
        </div>
      ) : (
        <input
          class="twitch-channel-input"
          type="text"
          value={input()}
          onInput={(event) => setInput(event.currentTarget.value)}
          onBlur={commitInput}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commitInput();
            }
          }}
          placeholder="Ник Twitch-канала, например linaryx"
        />
      )}
    </div>
  );
}
