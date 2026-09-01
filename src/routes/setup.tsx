import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Title } from "@solidjs/meta";
import { ColorPickerField } from "~/components/ColorPickerField";
import {
  ControlRows,
  SectionCard,
  SetupNav,
  ToggleRows,
  type ControlRow,
  type SetupSectionId,
  type ToggleRow,
} from "~/components/setup/SetupLayout";
import { AzureVoiceCatalog } from "~/components/setup/AzureVoiceCatalog";
import { SetupNumberField } from "~/components/setup/SetupNumberField";
import { SetupSelect } from "~/components/setup/SetupSelect";
import { SetupSwitch } from "~/components/setup/SetupSwitch";
import { TwitchChannelField } from "~/components/setup/TwitchChannelField";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { DEFAULT_BOT_NAMES } from "~/config/botNames";
import {
  DEFAULT_CHAT_CONFIG,
  chatConfigToSearchParams,
  normalizeBotNames,
  type ChatAnimationMode,
  type ChatConfig,
  type LinkDisplayMode,
} from "~/config/chatUrlParams";
import { getAppBaseUrl, getPublicAssetUrl } from "~/utils/appBase";
import {
  MAX_MESSAGE_SPEED,
  MIN_MESSAGE_SPEED,
  messageSpeedToIntervalMs,
} from "~/utils/ui/animationUtils";
import {
  createChatPreviewConfigMessage,
  getChatPreviewSessionKey,
} from "~/services/chat/preview";
import { cn } from "~/lib/utils";

type BotProfile = {
  login: string;
  displayName: string;
  avatarUrl: string;
};

type LocalFontData = {
  family: string;
  fullName?: string;
  postscriptName?: string;
  style?: string;
};

type LocalFontOption = {
  family: string;
  styles: string[];
};

type LocalFontWindow = Window & {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
};

const TWITCH_GQL_ENDPOINT = "https://gql.twitch.tv/gql";
const TWITCH_WEB_CLIENT_ID =
  import.meta.env.VITE_TWITCH_GQL_CLIENT_ID || "kimne78kx3ncx6brgo4mv6wki5h1ko";
const SETUP_STORAGE_KEYS = {
  twitchChannel: "chatyx.setup.twitchChannel",
} as const;

function readStoredSetupValue(key: string): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStoredSetupValue(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    const normalized = value.trim();
    if (normalized) {
      window.localStorage.setItem(key, normalized);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage can be blocked in private windows; setup must still work.
  }
}

function detectLocalFontBrowser(): string | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  const hasApi =
    typeof (window as LocalFontWindow).queryLocalFonts === "function";
  if (!hasApi) return null;

  const ua = navigator.userAgent;
  const vendor = navigator.vendor || "";

  if (/Edg\//.test(ua)) return "Edge";
  if (/(OPR|Opera)\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && vendor.includes("Google")) return "Chrome";

  return null;
}

function normalizeLocalFonts(fonts: LocalFontData[]): LocalFontOption[] {
  const families = new Map<string, Set<string>>();

  for (const font of fonts) {
    const family = font.family?.trim();
    if (!family) continue;

    const styles = families.get(family) ?? new Set<string>();
    if (font.style) styles.add(font.style);
    families.set(family, styles);
  }

  return Array.from(families.entries())
    .map(([family, styles]) => ({
      family,
      styles: Array.from(styles).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

function normalizeBotLogin(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

function splitBotLogins(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map(normalizeBotLogin)
    .filter(Boolean);
}

function botFallbackName(login: string): string {
  return login.slice(0, 1).toUpperCase();
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
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

async function loadBotProfiles(logins: string[]): Promise<BotProfile[]> {
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
      3500,
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

function mergeUniqueLogins(current: string[], raw: string): string[] {
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

export default function ChatSetup() {
  const [channel, setChannel] = createSignal(
    readStoredSetupValue(SETUP_STORAGE_KEYS.twitchChannel),
  );
  const [youtubeChannel, setYoutubeChannel] = createSignal("");
  const [size, setSize] = createSignal(String(DEFAULT_CHAT_CONFIG.size));
  const [font, setFont] = createSignal(String(DEFAULT_CHAT_CONFIG.font));
  const [fontWeight, setFontWeight] = createSignal(
    String(DEFAULT_CHAT_CONFIG.fontWeight),
  );
  const [nickFontWeight, setNickFontWeight] = createSignal(
    String(DEFAULT_CHAT_CONFIG.nickFontWeight),
  );
  const [fontCustom, setFontCustom] = createSignal("");
  const [localFontBrowser, setLocalFontBrowser] = createSignal("");
  const [localFonts, setLocalFonts] = createSignal<LocalFontOption[]>([]);
  const [localFontStatus, setLocalFontStatus] = createSignal("");
  const [isLoadingLocalFonts, setIsLoadingLocalFonts] = createSignal(false);
  const [shadow, setShadow] = createSignal(
    DEFAULT_CHAT_CONFIG.shadow === false
      ? "0"
      : String(DEFAULT_CHAT_CONFIG.shadow),
  );
  const [stroke, setStroke] = createSignal(
    DEFAULT_CHAT_CONFIG.stroke === false
      ? "0"
      : String(DEFAULT_CHAT_CONFIG.stroke),
  );
  const [fade, setFade] = createSignal(
    DEFAULT_CHAT_CONFIG.fade === false ? "0" : String(DEFAULT_CHAT_CONFIG.fade),
  );
  const [animation, setAnimation] = createSignal<ChatAnimationMode>(
    DEFAULT_CHAT_CONFIG.animation,
  );
  const [messageSpeed, setMessageSpeed] = createSignal(
    String(DEFAULT_CHAT_CONFIG.messageSpeed),
  );
  const [previewMode, setPreviewMode] = createSignal<"live" | "demo">("demo");
  const [previewDemoKind, setPreviewDemoKind] = createSignal<
    "pasta" | "emote"
  >("pasta");
  const [showHomies, setShowHomies] = createSignal(
    DEFAULT_CHAT_CONFIG.showHomies,
  );
  const [recentMessages, setRecentMessages] = createSignal(
    DEFAULT_CHAT_CONFIG.recentMessages,
  );
  const [bots, setBots] = createSignal(DEFAULT_CHAT_CONFIG.bots);
  const [commands, setCommands] = createSignal(DEFAULT_CHAT_CONFIG.commands);
  const [hideSpecialBadges, setHideSpecialBadges] = createSignal(
    DEFAULT_CHAT_CONFIG.hideSpecialBadges,
  );
  const [emoteScale, setEmoteScale] = createSignal(
    String(DEFAULT_CHAT_CONFIG.emoteScale),
  );
  const [botNames, setBotNames] = createSignal<string[]>([
    ...DEFAULT_BOT_NAMES,
  ]);
  const [botInput, setBotInput] = createSignal("");
  const [botProfiles, setBotProfiles] = createSignal<
    Record<string, BotProfile>
  >({});
  const [allowedChatters, setAllowedChatters] = createSignal<string[]>([]);
  const [allowedChatterInput, setAllowedChatterInput] = createSignal("");
  const [show7tvUnlisted, setShow7tvUnlisted] = createSignal(
    DEFAULT_CHAT_CONFIG.show7tvUnlisted,
  );
  const [smallCaps, setSmallCaps] = createSignal(DEFAULT_CHAT_CONFIG.smallCaps);
  const [nlAfterName, setNlAfterName] = createSignal(
    DEFAULT_CHAT_CONFIG.nlAfterName,
  );
  const [hideNames, setHideNames] = createSignal(DEFAULT_CHAT_CONFIG.hideNames);
  const [reverseLineOrder, setReverseLineOrder] = createSignal(
    DEFAULT_CHAT_CONFIG.reverseLineOrder,
  );
  const [horizontal, setHorizontal] = createSignal(
    DEFAULT_CHAT_CONFIG.horizontal,
  );
  const [ffzBotMixBroadcaster, setFfzBotMixBroadcaster] = createSignal(
    DEFAULT_CHAT_CONFIG.ffzBotMixBroadcaster,
  );
  const [ffzBotMixModerator, setFfzBotMixModerator] = createSignal(
    DEFAULT_CHAT_CONFIG.ffzBotMixModerator,
  );
  const [ffzBotMixVip, setFfzBotMixVip] = createSignal(
    DEFAULT_CHAT_CONFIG.ffzBotMixVip,
  );
  const [overlayBackgroundColor, setOverlayBackgroundColor] = createSignal(
    DEFAULT_CHAT_CONFIG.overlayBackgroundColor,
  );
  const [overlayBackgroundOpacity, setOverlayBackgroundOpacity] = createSignal(
    String(DEFAULT_CHAT_CONFIG.overlayBackgroundOpacity),
  );
  const [overlayBackgroundRadius, setOverlayBackgroundRadius] = createSignal(
    String(DEFAULT_CHAT_CONFIG.overlayBackgroundRadius),
  );
  const [overlayBorderOpacity, setOverlayBorderOpacity] = createSignal(
    String(DEFAULT_CHAT_CONFIG.overlayBorderOpacity),
  );
  const [highlightTwitchEvents, setHighlightTwitchEvents] = createSignal(
    DEFAULT_CHAT_CONFIG.highlightTwitchEvents,
  );
  const [twitchEventColor, setTwitchEventColor] = createSignal(
    DEFAULT_CHAT_CONFIG.twitchEventColor,
  );
  const [twitchEventBackgroundOpacity, setTwitchEventBackgroundOpacity] =
    createSignal(String(DEFAULT_CHAT_CONFIG.twitchEventBackgroundOpacity));
  const [twitchEventBold, setTwitchEventBold] = createSignal(
    DEFAULT_CHAT_CONFIG.twitchEventBold,
  );
  const [twitchEventItalic, setTwitchEventItalic] = createSignal(
    DEFAULT_CHAT_CONFIG.twitchEventItalic,
  );
  const [showHighlightedMessages, setShowHighlightedMessages] = createSignal(
    DEFAULT_CHAT_CONFIG.showHighlightedMessages,
  );
  const [showChannelPointRewards, setShowChannelPointRewards] = createSignal(
    DEFAULT_CHAT_CONFIG.showChannelPointRewards,
  );
  const [showGigantifiedEmotes, setShowGigantifiedEmotes] = createSignal(
    DEFAULT_CHAT_CONFIG.showGigantifiedEmotes,
  );
  const [showPredictions, setShowPredictions] = createSignal(
    DEFAULT_CHAT_CONFIG.showPredictions,
  );
  const [linkMode, setLinkMode] = createSignal<LinkDisplayMode>(
    DEFAULT_CHAT_CONFIG.linkMode,
  );
  const [linkColor, setLinkColor] = createSignal(DEFAULT_CHAT_CONFIG.linkColor);
  const [hideLinkRewards, setHideLinkRewards] = createSignal(
    DEFAULT_CHAT_CONFIG.hideLinkRewards,
  );
  const [rteProxy, setRteProxy] = createSignal(DEFAULT_CHAT_CONFIG.rteProxy);
  const [rteAzureTts, setRteAzureTts] = createSignal(
    DEFAULT_CHAT_CONFIG.rteAzureTts,
  );
  const [rteChatIsTts, setRteChatIsTts] = createSignal(
    DEFAULT_CHAT_CONFIG.rteChatIsTts,
  );
  const [rteReyohohoBadge, setRteReyohohoBadge] = createSignal(
    DEFAULT_CHAT_CONFIG.rteReyohohoBadge,
  );
  const [rteCustomCosmetics, setRteCustomCosmetics] = createSignal(
    DEFAULT_CHAT_CONFIG.rteCustomCosmetics,
  );

  const [generatedUrl, setGeneratedUrl] = createSignal("");
  const [previewUrl, setPreviewUrl] = createSignal("");
  // eslint-disable-next-line no-unassigned-vars -- assigned by SolidJS ref={}
  let iframeRef: HTMLIFrameElement | undefined;
  // eslint-disable-next-line no-unassigned-vars -- assigned by SolidJS ref={}
  let settingsScrollRef: HTMLDivElement | undefined;
  let activePreviewSessionKey = "";
  let previewNavigationTimer: number | undefined;

  const postPreviewConfig = (config = previewConfig()) => {
    iframeRef?.contentWindow?.postMessage(
      createChatPreviewConfigMessage(config),
      window.location.origin,
    );
  };

  onMount(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      htmlBg: html.style.background,
      bodyBg: body.style.background,
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      rootOverflow: root?.style.overflow ?? "",
      rootHeight: root?.style.height ?? "",
    };
    const supportedBrowser = detectLocalFontBrowser();

    // Lock document scroll — setup owns scrolling in fixed columns
    html.style.background = "#09090b";
    html.style.overflow = "hidden";
    body.style.background = "#09090b";
    body.style.overflow = "hidden";
    body.style.height = "100%";
    if (root) {
      root.style.overflow = "hidden";
      root.style.height = "100%";
    }

    if (supportedBrowser) {
      setLocalFontBrowser(supportedBrowser);
      setLocalFontStatus(
        `Можно загрузить локальные шрифты через ${supportedBrowser}.`,
      );
    }

    onCleanup(() => {
      html.style.background = prev.htmlBg;
      html.style.overflow = prev.htmlOverflow;
      body.style.background = prev.bodyBg;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      if (root) {
        root.style.overflow = prev.rootOverflow;
        root.style.height = prev.rootHeight;
      }
    });
  });

  const [activeSection, setActiveSection] =
    createSignal<SetupSectionId>("appearance");
  const [openSections, setOpenSections] = createSignal<
    Record<SetupSectionId, boolean>
  >({
    appearance: true,
    styling: false,
    behavior: false,
    content: false,
    bots: false,
    tts: false,
    rte: false,
  });

  const setSectionOpen = (id: SetupSectionId, open: boolean) => {
    setOpenSections((prev) => ({ ...prev, [id]: open }));
  };

  const scrollToSection = (id: SetupSectionId) => {
    setActiveSection(id);
    setSectionOpen(id, true);
    requestAnimationFrame(() => {
      const el = document.getElementById(`setup-section-${id}`);
      if (!el) return;
      if (settingsScrollRef) {
        const top =
          el.getBoundingClientRect().top -
          settingsScrollRef.getBoundingClientRect().top +
          settingsScrollRef.scrollTop -
          8;
        settingsScrollRef.scrollTo({ top, behavior: "smooth" });
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };


  const normalizeHexColor = (raw: string, fallback: string): string => {
    const value = raw.trim();
    const withHash = value.startsWith("#") ? value : `#${value}`;
    return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash : fallback;
  };

  const toIntOrFalse = (raw: string): number | false => {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : false;
  };

  const toSecondsOrFalse = (raw: string): number | false => {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : false;
  };

  const toInt = (raw: string, fallback: number): number => {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  const toClampedInt = (
    raw: string,
    fallback: number,
    min: number,
    max: number,
  ): number => {
    const n = Number.parseInt(raw, 10);
    const value = Number.isFinite(n) ? n : fallback;
    return Math.min(Math.max(value, min), max);
  };

  const toFloat = (raw: string, fallback: number): number => {
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const buildConfig = (selectedChannel: string): ChatConfig => ({
    ...DEFAULT_CHAT_CONFIG,
    channel: selectedChannel,
    youtubeChannel: youtubeChannel().trim().replace(/^@/, ""),
    size: toInt(size(), DEFAULT_CHAT_CONFIG.size),
    font: toInt(font(), DEFAULT_CHAT_CONFIG.font),
    fontWeight: toClampedInt(
      fontWeight(),
      DEFAULT_CHAT_CONFIG.fontWeight,
      100,
      1000,
    ),
    nickFontWeight: toClampedInt(
      nickFontWeight(),
      DEFAULT_CHAT_CONFIG.nickFontWeight,
      100,
      1000,
    ),
    fontCustom: fontCustom(),
    shadow: toIntOrFalse(shadow()),
    stroke: toIntOrFalse(stroke()),
    fade: toSecondsOrFalse(fade()),
    animation: animation(),
    messageSpeed: toClampedInt(
      messageSpeed(),
      DEFAULT_CHAT_CONFIG.messageSpeed,
      MIN_MESSAGE_SPEED,
      MAX_MESSAGE_SPEED,
    ),
    showHomies: showHomies(),
    recentMessages: recentMessages(),
    bots: bots(),
    commands: commands(),
    hideSpecialBadges: hideSpecialBadges(),
    emoteScale: toFloat(emoteScale(), DEFAULT_CHAT_CONFIG.emoteScale),
    botNames: normalizeBotNames(botNames().join(",")),
    singleChatter: normalizeBotNames(allowedChatters().join(",")),
    show7tvUnlisted: show7tvUnlisted(),
    smallCaps: smallCaps(),
    nlAfterName: nlAfterName(),
    hideNames: hideNames(),
    reverseLineOrder: reverseLineOrder(),
    horizontal: horizontal(),
    ffzBotMixCustom: true,
    ffzBotMixBroadcaster: ffzBotMixBroadcaster(),
    ffzBotMixModerator: ffzBotMixModerator(),
    ffzBotMixVip: ffzBotMixVip(),
    overlayBackgroundColor: normalizeHexColor(
      overlayBackgroundColor(),
      DEFAULT_CHAT_CONFIG.overlayBackgroundColor,
    ),
    overlayBackgroundOpacity: toInt(
      overlayBackgroundOpacity(),
      DEFAULT_CHAT_CONFIG.overlayBackgroundOpacity,
    ),
    overlayBackgroundRadius: toInt(
      overlayBackgroundRadius(),
      DEFAULT_CHAT_CONFIG.overlayBackgroundRadius,
    ),
    overlayBorderOpacity: toInt(
      overlayBorderOpacity(),
      DEFAULT_CHAT_CONFIG.overlayBorderOpacity,
    ),
    highlightTwitchEvents: highlightTwitchEvents(),
    twitchEventColor: normalizeHexColor(
      twitchEventColor(),
      DEFAULT_CHAT_CONFIG.twitchEventColor,
    ),
    twitchEventBackgroundOpacity: toInt(
      twitchEventBackgroundOpacity(),
      DEFAULT_CHAT_CONFIG.twitchEventBackgroundOpacity,
    ),
    twitchEventBold: twitchEventBold(),
    twitchEventItalic: twitchEventItalic(),
    showHighlightedMessages: showHighlightedMessages(),
    showChannelPointRewards: showChannelPointRewards(),
    showGigantifiedEmotes: showGigantifiedEmotes(),
    showPredictions: showPredictions(),
    linkMode: linkMode(),
    linkColor: normalizeHexColor(linkColor(), DEFAULT_CHAT_CONFIG.linkColor),
    hideLinkRewards: hideLinkRewards(),
    rteProxy: rteProxy(),
    rteAzureTts: rteAzureTts(),
    rteChatIsTts: rteChatIsTts(),
    rteReyohohoBadge: rteReyohohoBadge(),
    rteCustomCosmetics: rteCustomCosmetics(),
  });

  const buildChatUrl = (
    cfg: ChatConfig,
    extraParams?: Record<string, string>,
    options?: { includeMessageSpeed?: boolean },
  ) => {
    const params = chatConfigToSearchParams(cfg);
    if (options?.includeMessageSpeed === false) {
      params.delete("ms");
    }
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) =>
        params.set(key, value),
      );
    }
    const query = params.toString();
    return `${getAppBaseUrl()}/chat/${query ? `?${query}` : ""}`;
  };

  const hasTwitchChannel = createMemo(() => Boolean(channel().trim()));
  const hasYouTubeChannel = createMemo(() => Boolean(youtubeChannel().trim()));
  const isYouTubeOnly = createMemo(
    () => hasYouTubeChannel() && !hasTwitchChannel(),
  );
  const previewChannel = createMemo(() =>
    channel().trim() || (hasYouTubeChannel() ? "" : "chatyxpreview"),
  );
  const previewConfig = createMemo(() => buildConfig(previewChannel()));
  const messageSpeedValue = createMemo(() =>
    toClampedInt(
      messageSpeed(),
      DEFAULT_CHAT_CONFIG.messageSpeed,
      MIN_MESSAGE_SPEED,
      MAX_MESSAGE_SPEED,
    ),
  );
  const messageIntervalMs = createMemo(() =>
    messageSpeedToIntervalMs(messageSpeedValue()),
  );
  const messageSpeedLabel = createMemo(() =>
    messageIntervalMs() === null ? "стоп" : `${messageIntervalMs()} мс`,
  );
  const ffzBotBadgePreviewUrl = getPublicAssetUrl("img/ffz-bot-badge.png");
  const requestedBotProfiles = new Set<string>();

  const addBotNames = (raw: string) => {
    setBotNames((current) => mergeUniqueLogins(current, raw));
  };

  const addAllowedChatters = (raw: string) => {
    setAllowedChatters((current) => mergeUniqueLogins(current, raw));
  };

  const removeBotName = (login: string) => {
    setBotNames((current) => current.filter((entry) => entry !== login));
  };

  const removeAllowedChatter = (login: string) => {
    setAllowedChatters((current) => current.filter((entry) => entry !== login));
  };

  const handleBotInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addBotNames(botInput());
      setBotInput("");
      return;
    }

    if (event.key === "Backspace" && botInput().trim() === "") {
      setBotNames((current) => current.slice(0, -1));
    }
  };

  const handleAllowedChatterInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addAllowedChatters(allowedChatterInput());
      setAllowedChatterInput("");
      return;
    }

    if (event.key === "Backspace" && allowedChatterInput().trim() === "") {
      setAllowedChatters((current) => current.slice(0, -1));
    }
  };

  createEffect(() => {
    const missing = Array.from(
      new Set([...botNames(), ...allowedChatters()]),
    ).filter(
      (login) => !botProfiles()[login] && !requestedBotProfiles.has(login),
    );
    if (missing.length === 0) return;

    for (const login of missing) {
      requestedBotProfiles.add(login);
    }

    void loadBotProfiles(missing).then((profiles) => {
      if (profiles.length === 0) return;

      setBotProfiles((current) => {
        const next = { ...current };
        for (const profile of profiles) {
          next[profile.login] = profile;
        }
        return next;
      });
    });
  });

  createEffect(() => {
    if (isYouTubeOnly() && previewMode() === "demo") {
      setPreviewMode("live");
    }
  });

  createEffect(() => {
    writeStoredSetupValue(SETUP_STORAGE_KEYS.twitchChannel, channel());
  });

  createEffect(() => {
    const currentChannel = channel().trim();
    const currentYouTubeChannel = youtubeChannel().trim();
    if (!currentChannel && !currentYouTubeChannel) {
      setGeneratedUrl("");
      return;
    }

    setGeneratedUrl(
      buildChatUrl(buildConfig(currentChannel), undefined, {
        includeMessageSpeed: false,
      }),
    );
  });

  createEffect(() => {
    const cfg = previewConfig(); // read synchronously so SolidJS tracks the dependency
    const mode = previewMode();
    const demoKind = previewDemoKind();
    const sessionKey = getChatPreviewSessionKey(cfg, mode, demoKind);
    if (sessionKey === activePreviewSessionKey) return;

    activePreviewSessionKey = sessionKey;
    if (previewNavigationTimer !== undefined) {
      window.clearTimeout(previewNavigationTimer);
    }
    previewNavigationTimer = window.setTimeout(() => {
      previewNavigationTimer = undefined;
      const nextPreviewUrl = buildChatUrl(
        cfg,
        mode === "demo"
          ? {
              preview: "true",
              demo: demoKind,
            }
          : {
              preview: "false",
            },
      );

      // Set via ref to avoid about:blank flash — just swap src directly
      if (iframeRef) {
        iframeRef.src = nextPreviewUrl;
      } else {
        setPreviewUrl(nextPreviewUrl);
      }
    }, 180);
  });

  onCleanup(() => {
    if (previewNavigationTimer !== undefined) {
      window.clearTimeout(previewNavigationTimer);
    }
  });

  createEffect(() => {
    postPreviewConfig(previewConfig());
  });

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl());
      alert("Ссылка скопирована в буфер обмена");
    } catch (err) {
      console.error("Ошибка копирования:", err);
    }
  };

  const loadLocalFonts = async () => {
    const queryLocalFonts = (window as LocalFontWindow).queryLocalFonts;
    if (!localFontBrowser() || typeof queryLocalFonts !== "function") {
      setLocalFontStatus(
        "Этот браузер не даёт сайту список локальных шрифтов.",
      );
      return;
    }

    setIsLoadingLocalFonts(true);
    setLocalFontStatus("Запрашиваю доступ к локальным шрифтам...");

    try {
      const fonts = normalizeLocalFonts(await queryLocalFonts());
      setLocalFonts(fonts);
      setLocalFontStatus(
        fonts.length > 0
          ? `Найдено локальных шрифтов: ${fonts.length}.`
          : "Браузер не вернул локальные шрифты.",
      );
    } catch {
      setLocalFontStatus(
        "Не получилось получить список шрифтов. Проверь разрешение браузера.",
      );
    } finally {
      setIsLoadingLocalFonts(false);
    }
  };

  const appearanceRows: ControlRow[] = [
    {
      label: "Размер сообщений",
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={size()}
          onChange={(e) => setSize(e.currentTarget.value)}
        >
          <option value="1">Маленький</option>
          <option value="2">Средний</option>
          <option value="3">Большой</option>
        </SetupSelect>
      ),
    },
    {
      label: "Шрифт",
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={font()}
          onChange={(e) => setFont(e.currentTarget.value)}
        >
          <option value="0">Свой шрифт</option>
          <option value="1">Baloo Tammudu</option>
          <option value="2">Segoe UI (Chatterino)</option>
          <option value="3">Roboto</option>
          <option value="4">Lato</option>
          <option value="5">Noto Sans</option>
          <option value="6">Source Code Pro</option>
          <option value="7">Impact</option>
          <option value="8">Comfortaa</option>
          <option value="9">Dancing Script</option>
          <option value="10">Indie Flower</option>
          <option value="11">Open Sans</option>
          <option value="12">Alsina (Vsauce)</option>
        </SetupSelect>
      ),
    },
    {
      label: "Название своего шрифта",
      hint: "Работает, когда выше выбран пункт «Свой шрифт».",
      control: (labelId) => (
        <div class="flex flex-col gap-2">
          <Input
            aria-labelledby={labelId}
            type="text"
            value={fontCustom()}
            onInput={(e) => setFontCustom(e.currentTarget.value)}
            placeholder="Например: Comic Sans MS"
            disabled={font() !== "0"}
            class={cn(font() !== "0" && "opacity-50")}
          />
          <Show when={localFontBrowser()}>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadLocalFonts}
                disabled={font() !== "0" || isLoadingLocalFonts()}
                class="h-10"
              >
                {isLoadingLocalFonts() ? "Загрузка..." : "Локальные"}
              </Button>
              <SetupSelect
                aria-label="Выбрать локальный шрифт"
                value=""
                onChange={(e) => {
                  const selectedFont = e.currentTarget.value;
                  if (selectedFont) setFontCustom(selectedFont);
                }}
                disabled={font() !== "0" || localFonts().length === 0}
                class={cn(
                  !(font() === "0" && localFonts().length > 0) && "opacity-50",
                )}
              >
                <option value="">
                  {localFonts().length > 0
                    ? "Выбрать локальный шрифт"
                    : "Сначала загрузить список"}
                </option>
                <For each={localFonts()}>
                  {(localFont) => (
                    <option value={localFont.family}>
                      {localFont.family}
                      {localFont.styles.length > 0
                        ? ` (${localFont.styles.join(", ")})`
                        : ""}
                    </option>
                  )}
                </For>
              </SetupSelect>
            </div>
          </Show>
          <div class="text-xs text-muted-foreground">{localFontStatus()}</div>
        </div>
      ),
    },
    {
      label: "Вес текста",
      hint: "Толщина текста сообщений. 800 — текущий стандарт.",
      control: (_labelId) => (
        <SetupNumberField
          label="Вес текста"
          value={fontWeight()}
          onChange={setFontWeight}
          min={100}
          max={1000}
          step={100}
        />
      ),
    },
    {
      label: "Вес ника",
      hint: "Толщина имени автора и двоеточия. 800 — текущий стандарт.",
      control: (_labelId) => (
        <SetupNumberField
          label="Вес ника"
          value={nickFontWeight()}
          onChange={setNickFontWeight}
          min={100}
          max={1000}
          step={100}
        />
      ),
    },
    {
      label: "Размер эмоутов",
      control: (_labelId) => (
        <SetupNumberField
          label="Размер эмоутов"
          value={emoteScale()}
          onChange={setEmoteScale}
          min={0}
          max={3}
          step={0.1}
        />
      ),
    },
  ];

  const stylingRows: ControlRow[] = [
    {
      label: "Тень текста",
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={shadow()}
          onChange={(e) => setShadow(e.currentTarget.value)}
        >
          <option value="0">Выкл</option>
          <option value="1">Маленькая</option>
          <option value="2">Средняя</option>
          <option value="3">Большая</option>
        </SetupSelect>
      ),
    },
    {
      label: "Обводка текста",
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={stroke()}
          onChange={(e) => setStroke(e.currentTarget.value)}
        >
          <option value="0">Выкл</option>
          <option value="1">Тонкая</option>
          <option value="2">Средняя</option>
          <option value="3">Толстая</option>
          <option value="4">Очень толстая</option>
        </SetupSelect>
      ),
    },
    {
      label: "Скрывать сообщения через",
      hint: "В секундах. 0 — сообщения остаются на экране.",
      control: (_labelId) => (
        <SetupNumberField
          label="Скрывать сообщения через"
          value={fade()}
          onChange={setFade}
          min={0}
          placeholder="30"
        />
      ),
    },
    {
      label: "Фон сообщений",
      control: (_labelId) => (
        <ColorPickerField
          label="Фон сообщений"
          color={overlayBackgroundColor()}
          opacity={toInt(
            overlayBackgroundOpacity(),
            DEFAULT_CHAT_CONFIG.overlayBackgroundOpacity,
          )}
          onChange={({ color, opacity }) => {
            setOverlayBackgroundColor(color);
            setOverlayBackgroundOpacity(String(opacity));
          }}
        />
      ),
    },
    {
      label: "Скругление фона",
      control: (_labelId) => (
        <SetupNumberField
          label="Скругление фона"
          value={overlayBackgroundRadius()}
          onChange={setOverlayBackgroundRadius}
          min={0}
          max={64}
          step={1}
        />
      ),
    },
    {
      label: "Видимость рамки",
      control: (_labelId) => (
        <SetupNumberField
          label="Видимость рамки"
          value={overlayBorderOpacity()}
          onChange={setOverlayBorderOpacity}
          min={0}
          max={100}
          step={1}
        />
      ),
    },
    {
      label: "Подсветка событий Twitch",
      hint: "Цвет первых сообщений, рейдов, подписок, наград и Twitch Power-ups.",
      control: (_labelId) => (
        <ColorPickerField
          label="Подсветка событий Twitch"
          color={twitchEventColor()}
          opacity={toInt(
            twitchEventBackgroundOpacity(),
            DEFAULT_CHAT_CONFIG.twitchEventBackgroundOpacity,
          )}
          onChange={({ color, opacity }) => {
            setTwitchEventColor(color);
            setTwitchEventBackgroundOpacity(String(opacity));
          }}
        />
      ),
    },
    {
      label: "Цвет ссылок",
      hint: "Используется, когда для ссылок выбран режим выделения.",
      control: (_labelId) => (
        <ColorPickerField
          label="Цвет ссылок"
          color={linkColor()}
          opacity={100}
          showOpacity={false}
          onChange={({ color }) => setLinkColor(color)}
        />
      ),
    },
  ];

  const behaviorRows: ControlRow[] = [
    {
      label: "Анимация сообщений",
      hint: "Плавный поток двигает существующие строки, остальные режимы анимируют только новое сообщение.",
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={animation()}
          onChange={(event) =>
            setAnimation(event.currentTarget.value as ChatAnimationMode)
          }
        >
          <option value="fade">Появление</option>
          <option value="flow">Плавный поток</option>
          <option value="scroll">Плавный скролл</option>
          <option value="none">Без анимации</option>
        </SetupSelect>
      ),
    },
    {
      label: "Ссылки в сообщениях",
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={linkMode()}
          onChange={(event) =>
            setLinkMode(event.currentTarget.value as LinkDisplayMode)
          }
        >
          <option value="normal">Обычный текст</option>
          <option value="highlight">Выделять цветом</option>
          <option value="hide">Скрывать</option>
        </SetupSelect>
      ),
    },
  ];

  const behaviorToggles: ToggleRow[] = [
    {
      label: "Подсвечивать события Twitch",
      checked: highlightTwitchEvents,
      onChange: setHighlightTwitchEvents,
    },
    {
      label: "Усилить служебный текст событий",
      checked: twitchEventBold,
      onChange: setTwitchEventBold,
      hint: "Добавляет 100 к выбранному весу текста, не меняя вес ника и сообщения.",
    },
    {
      label: "Курсив для событий",
      checked: twitchEventItalic,
      onChange: setTwitchEventItalic,
    },
    {
      label: "Загружать последние сообщения",
      checked: recentMessages,
      onChange: setRecentMessages,
      hint: "Показывает recent-messages до подключения к Twitch IRC. Если выключить, чат стартует только с новых сообщений.",
    },
    {
      label: "Писать ники капсом",
      checked: smallCaps,
      onChange: setSmallCaps,
    },
    {
      label: "Переносить текст после ника",
      checked: nlAfterName,
      onChange: setNlAfterName,
    },
    { label: "Не показывать ники", checked: hideNames, onChange: setHideNames },
    {
      label: "Обратный порядок сообщений",
      checked: reverseLineOrder,
      onChange: setReverseLineOrder,
    },
    {
      label: "Чат одной строкой (горизонтальный режим)",
      checked: horizontal,
      onChange: setHorizontal,
    },
  ];

  const contentToggles: ToggleRow[] = [
    {
      label: "Показывать выделенные сообщения",
      checked: showHighlightedMessages,
      onChange: setShowHighlightedMessages,
    },
    {
      label: "Показывать покупки за баллы",
      checked: showChannelPointRewards,
      onChange: setShowChannelPointRewards,
    },
    {
      label: "Скрывать награды со ссылками",
      checked: hideLinkRewards,
      onChange: setHideLinkRewards,
      hint: "Включено по умолчанию. Скрывает всю покупку за баллы, если в сообщении, названии или описании награды есть ссылка.",
    },
    {
      label: "Показывать гигантские эмоуты",
      checked: showGigantifiedEmotes,
      onChange: setShowGigantifiedEmotes,
    },
    {
      label: "Показывать прогноз над чатом",
      checked: showPredictions,
      onChange: setShowPredictions,
      hint: "Полоска Twitch Predictions над сообщениями. Работает только при указанном Twitch-канале.",
    },
    {
      label: "Показывать команды с !",
      checked: commands,
      onChange: setCommands,
    },
    {
      label: "Показывать скрытые 7TV-эмоуты",
      checked: show7tvUnlisted,
      onChange: setShow7tvUnlisted,
    },
    {
      label: "Скрыть сторонние бейджи (7TV, FFZ, BTTV)",
      checked: hideSpecialBadges,
      onChange: setHideSpecialBadges,
      hint: "Бейджи Twitch и YouTube останутся видимыми.",
    },
    {
      label: "Показывать Homies-бейджи",
      checked: showHomies,
      onChange: setShowHomies,
    },
  ];

  const ttsToggles: ToggleRow[] = [
    {
      label: "Обычный TTS через ChatIS / Streamlabs",
      checked: rteChatIsTts,
      onChange: setRteChatIsTts,
      hint: "Команда модератора: !chat tts [-s Voice] текст. Синтезированный аудиофайл не сохраняется.",
    },
    {
      label: "Azure Neural TTS через JustDavi",
      checked: rteAzureTts,
      onChange: setRteAzureTts,
      hint: "Команда модератора: !chat azuretts [-v xx-XX-VoiceNeural] текст.",
    },
  ];

  const rteToggles: ToggleRow[] = [
    {
      label: "RTE-прокси для эмоутов и бейджей",
      checked: rteProxy,
      onChange: setRteProxy,
      hint: "Направляет только публичные API и CDN 7TV, BTTV и FFZ через RTE. Twitch и авторизация не проксируются.",
    },
    {
      label: "Reyohoho-бейдж",
      checked: rteReyohohoBadge,
      onChange: setRteReyohohoBadge,
      hint: "Показывает пользовательский бейдж из публичного RTE API, если он есть.",
    },
    {
      label: "Кастомные пейнты RTE",
      checked: rteCustomCosmetics,
      onChange: setRteCustomCosmetics,
      hint: "Подгружает персональный paint из RTE, если для пользователя нет подходящего локального источника.",
    },
  ];

  const roleBadgeMergeOptions = [
    {
      label: "Стример",
      badgeColor: "#e91916",
      checked: ffzBotMixBroadcaster,
      onChange: setFfzBotMixBroadcaster,
    },
    {
      label: "Модератор",
      badgeColor: "#00ad03",
      checked: ffzBotMixModerator,
      onChange: setFfzBotMixModerator,
    },
    {
      label: "VIP-зритель",
      badgeColor: "#e005b9",
      checked: ffzBotMixVip,
      onChange: setFfzBotMixVip,
    },
  ];

  const renderUserChip = (
    login: string,
    remove: (login: string) => void,
    ariaLabel: string,
  ) => {
    const profile = () => botProfiles()[login];
    const displayName = () => profile()?.displayName || login;
    const avatarUrl = () => profile()?.avatarUrl || "";

    return (
      <div
        class="inline-flex max-w-full items-center gap-2 rounded-full border border-white/50 bg-black px-1.5 py-0.5 text-white"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Backspace" || event.key === "Delete") {
            event.preventDefault();
            remove(login);
          }
        }}
      >
        <Show
          when={avatarUrl()}
          fallback={
            <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-white/40 bg-black text-xs font-bold">
              {botFallbackName(login)}
            </span>
          }
        >
          <img
            src={avatarUrl()}
            alt=""
            class="size-7 shrink-0 rounded-full border border-white/40 object-cover"
            loading="lazy"
          />
        </Show>
        <span class="flex min-w-0 flex-col justify-center leading-tight">
          <span class="max-w-[150px] truncate text-xs font-bold">
            {displayName()}
          </span>
          <Show when={displayName().toLowerCase() !== login}>
            <span class="max-w-[150px] truncate text-[10px] text-white/60">
              @{login}
            </span>
          </Show>
        </span>
        <button
          type="button"
          class="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full text-base leading-none text-white hover:bg-white/10"
          onClick={() => remove(login)}
          aria-label={`${ariaLabel}: ${displayName()}`}
        >
          ×
        </button>
      </div>
    );
  };

  const chipFieldClass =
    "flex min-h-[72px] w-full flex-wrap content-start items-center gap-1.5 rounded-lg border border-input bg-background p-2";

  return (
    <>
      <Title>ChatYX • настройка</Title>

      <div class="setup-root dark flex h-dvh max-h-dvh w-full flex-col overflow-hidden">
        <div class="mx-auto flex h-full min-h-0 w-full max-w-[1760px] flex-col gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 lg:px-5 xl:px-6">
          <header class="flex shrink-0 flex-col gap-1.5 border-b border-border/70 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 class="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Чат-оверлей
              </h1>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Настрой параметры и проверь их в живом превью.
              </p>
            </div>
            <p class="hidden text-xs text-muted-foreground sm:block">
              Изменения применяются сразу.
            </p>
          </header>

          <div class="shrink-0">
            <SectionCard
              title="Подключение чата"
              description="Укажи Twitch и YouTube, если нужен общий оверлей."
              compact
            >
              <div class="setup-channel-row grid grid-cols-1 items-center gap-2 md:grid-cols-2">
                <TwitchChannelField value={channel()} onChange={setChannel} />
                <Input
                  aria-label="YouTube handle или ID"
                  type="text"
                  value={youtubeChannel()}
                  onInput={(e) => setYoutubeChannel(e.currentTarget.value)}
                  placeholder="YouTube handle или ID, например @linaryx"
                  class="h-9 text-center sm:h-10"
                />
              </div>
            </SectionCard>
          </div>

          {/*
            <1100: stack
            ≥1100: settings | preview (compact)
            ≥1280: nav | settings | preview
          */}
          <div class="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto overflow-x-hidden min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(300px,38%)] min-[1100px]:gap-3 min-[1100px]:overflow-hidden xl:grid-cols-[196px_minmax(0,1fr)_minmax(320px,400px)] xl:gap-4">
            <aside class="hidden min-h-0 xl:block">
              <div class="setup-pane-scroll h-full max-h-full overflow-y-auto overscroll-contain rounded-lg border border-border/80 bg-card/60 p-1.5">
                <SetupNav active={activeSection()} onSelect={scrollToSection} />
              </div>
            </aside>

            <div
              ref={(el) => {
                settingsScrollRef = el;
              }}
              class="setup-pane-scroll flex min-h-0 min-w-0 flex-col gap-2.5 overflow-y-auto overscroll-contain min-[1100px]:h-full"
            >
              <div class="xl:hidden">
                <div class="flex gap-1 overflow-x-auto pb-0.5">
                  <For
                    each={[
                      { id: "appearance" as const, label: "Текст" },
                      { id: "styling" as const, label: "Вид" },
                      { id: "behavior" as const, label: "Поведение" },
                      { id: "content" as const, label: "Контент" },
                      { id: "bots" as const, label: "Фильтры" },
                      { id: "tts" as const, label: "Озвучка" },
                      { id: "rte" as const, label: "RTE" },
                    ]}
                  >
                    {(item) => (
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          activeSection() === item.id ? "secondary" : "ghost"
                        }
                        onClick={() => scrollToSection(item.id)}
                        class="h-8 shrink-0 px-2.5 text-xs"
                      >
                        {item.label}
                      </Button>
                    )}
                  </For>
                </div>
              </div>

              <SectionCard
                id="setup-section-appearance"
                title="Текст и размер"
                description="Настрой, насколько крупно и каким шрифтом будет выглядеть чат."
                collapsible
                open={openSections().appearance}
                onOpenChange={(open) => setSectionOpen("appearance", open)}
              >
                <ControlRows rows={appearanceRows} />
              </SectionCard>

              <SectionCard
                id="setup-section-styling"
                title="Внешний вид"
                description="Фон сообщений, тень, обводка и время жизни строк на экране."
                collapsible
                open={openSections().styling}
                onOpenChange={(open) => setSectionOpen("styling", open)}
              >
                <ControlRows rows={stylingRows} />
              </SectionCard>

              <SectionCard
                id="setup-section-behavior"
                title="Поведение сообщений"
                description="Управляет анимацией, переносами, порядком и форматом сообщений."
                collapsible
                open={openSections().behavior}
                onOpenChange={(open) => setSectionOpen("behavior", open)}
              >
                <ControlRows rows={behaviorRows} />
                <ToggleRows rows={behaviorToggles} />
              </SectionCard>

              <SectionCard
                id="setup-section-content"
                title="Контент и бейджи"
                description="Выбери, какие сообщения, эмоуты и бейджи попадут в оверлей."
                collapsible
                open={openSections().content}
                onOpenChange={(open) => setSectionOpen("content", open)}
              >
                <ToggleRows rows={contentToggles} />

                <div class="setup-role-merge grid grid-cols-1 gap-3 rounded-lg border border-border bg-black/40 p-3.5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
                  <div class="flex min-w-0 flex-col gap-1.5">
                    <div class="text-sm font-bold text-foreground">
                      Объединять bot badge с role badge
                    </div>
                    <div class="text-xs leading-snug text-muted-foreground">
                      Выбери роли, у которых FFZ-бот-бейдж будет показываться
                      рядом с Twitch-бейджем роли.
                    </div>
                  </div>
                  <div class="setup-role-pills grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <For each={roleBadgeMergeOptions}>
                      {(option) => {
                        const active = () => option.checked();
                        return (
                          <button
                            type="button"
                            class={cn(
                              "flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-lg border px-2.5 py-2.5 text-xs font-bold transition-colors",
                              active()
                                ? "border-white/70 bg-white/5 text-white"
                                : "border-white/20 bg-black text-white/70 hover:border-white/40",
                            )}
                            onClick={() => option.onChange(!active())}
                            aria-pressed={active()}
                          >
                            <span class="inline-flex items-center rounded-md border border-white/15 bg-black/70 p-0.5">
                              <span
                                class="inline-flex size-[23px] items-center justify-center rounded-[5px] border border-white/20"
                                style={{ background: option.badgeColor }}
                              >
                                <img
                                  src={ffzBotBadgePreviewUrl}
                                  alt=""
                                  class="block size-full object-contain"
                                  loading="lazy"
                                />
                              </span>
                            </span>
                            <span class="text-center leading-tight">
                              {option.label}
                            </span>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                id="setup-section-bots"
                title="Боты и фильтры"
                description="Спрячь ботов, команды или оставь сообщения только выбранных пользователей."
                collapsible
                open={openSections().bots}
                onOpenChange={(open) => setSectionOpen("bots", open)}
              >
                <div class="setup-bot-row grid grid-cols-1 items-start gap-2 min-[1100px]:grid-cols-[132px_minmax(0,1fr)] xl:grid-cols-[168px_minmax(0,1fr)] md:max-[1099px]:grid-cols-[180px_minmax(0,1fr)]">
                  <div class="flex min-w-0 flex-col gap-1.5">
                    <div class="text-xs font-medium text-foreground sm:text-sm">
                      Ники ботов
                    </div>
                    <div class="inline-flex items-center gap-2 text-[11px] text-muted-foreground sm:text-xs">
                      <SetupSwitch
                        checked={bots()}
                        onChange={setBots}
                        label="Не фильтровать ботов"
                      />
                      <span>Не фильтровать ботов</span>
                    </div>
                  </div>
                  <div class={chipFieldClass}>
                    <For each={botNames()}>
                      {(login) =>
                        renderUserChip(
                          login,
                          removeBotName,
                          "Убрать из списка ботов",
                        )
                      }
                    </For>
                    <input
                      aria-label="Добавить ник бота"
                      type="text"
                      value={botInput()}
                      onInput={(event) =>
                        setBotInput(event.currentTarget.value)
                      }
                      onKeyDown={handleBotInputKeyDown}
                      onBlur={() => {
                        addBotNames(botInput());
                        setBotInput("");
                      }}
                      placeholder="Введите никнейм и нажмите Enter"
                      class="h-[34px] min-w-[150px] flex-1 border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                <div class="setup-control-row grid grid-cols-1 items-center gap-2 min-[1100px]:grid-cols-[132px_minmax(0,1fr)] xl:grid-cols-[168px_minmax(0,1fr)] md:max-[1099px]:grid-cols-[180px_minmax(0,1fr)]">
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <div class="text-xs font-medium text-foreground sm:text-sm">
                      Показывать только этих зрителей
                    </div>
                    <div class="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                      Если список не пустой, остальные сообщения будут скрыты.
                    </div>
                  </div>
                  <div class={chipFieldClass}>
                    <For each={allowedChatters()}>
                      {(login) =>
                        renderUserChip(
                          login,
                          removeAllowedChatter,
                          "Убрать из списка зрителей",
                        )
                      }
                    </For>
                    <input
                      aria-label="Добавить зрителя в разрешённый список"
                      type="text"
                      value={allowedChatterInput()}
                      onInput={(event) =>
                        setAllowedChatterInput(event.currentTarget.value)
                      }
                      onKeyDown={handleAllowedChatterInputKeyDown}
                      onBlur={() => {
                        addAllowedChatters(allowedChatterInput());
                        setAllowedChatterInput("");
                      }}
                      placeholder="Введите никнейм и нажмите Enter"
                      class="h-[34px] min-w-[150px] flex-1 border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                id="setup-section-tts"
                title="Озвучка сообщений"
                description="Включи один или оба сервиса синтеза речи для команд модератора."
                collapsible
                open={openSections().tts}
                onOpenChange={(open) => setSectionOpen("tts", open)}
              >
                <ToggleRows rows={ttsToggles} />
                <AzureVoiceCatalog />
              </SectionCard>

              <SectionCard
                id="setup-section-rte"
                title="RTE-интеграции"
                description="Необязательный прокси для публичных ресурсов и пользовательской косметики."
                collapsible
                open={openSections().rte}
                onOpenChange={(open) => setSectionOpen("rte", open)}
              >
                <ToggleRows rows={rteToggles} />
              </SectionCard>
            </div>

            <div class="setup-pane-scroll min-h-0 min-w-0 overflow-y-auto overscroll-contain min-[1100px]:h-full">
              <div class="flex min-h-0 flex-col gap-2.5 pb-2 min-[1100px]:h-full min-[1100px]:pb-0">
                <SectionCard
                  title="Живое превью"
                  compact
                  class="min-[1100px]:flex min-[1100px]:min-h-0 min-[1100px]:flex-1 min-[1100px]:flex-col"
                >
                  <div class="flex min-h-0 flex-1 flex-col gap-2">
                    <div class="flex shrink-0 flex-col gap-2 rounded-lg border border-border bg-card/40 p-2.5">
                      <div
                        class={cn(
                          "setup-preview-controls grid gap-2",
                          isYouTubeOnly()
                            ? "grid-cols-1"
                            : "grid-cols-1 min-[1100px]:grid-cols-1 xl:grid-cols-2",
                        )}
                      >
                        <div class="flex min-w-0 flex-col gap-1">
                          <div class="text-xs font-medium sm:text-sm">
                            Режим превью
                          </div>
                          <SetupSelect
                            aria-label="Режим превью"
                            value={previewMode()}
                            onChange={(event) =>
                              setPreviewMode(
                                isYouTubeOnly() ||
                                  event.currentTarget.value === "live"
                                  ? "live"
                                  : "demo",
                              )
                            }
                            class="h-9"
                          >
                            <option value="live">Лайв режим</option>
                            <Show when={!isYouTubeOnly()}>
                              <option value="demo">Демонстрация</option>
                            </Show>
                          </SetupSelect>
                        </div>
                        <Show when={!isYouTubeOnly()}>
                          <div class="flex min-w-0 flex-col gap-1">
                            <div class="text-xs font-medium sm:text-sm">
                              Сценарий
                            </div>
                            <SetupSelect
                              aria-label="Сценарий превью"
                              value={previewDemoKind()}
                              onChange={(event) =>
                                setPreviewDemoKind(
                                  event.currentTarget.value === "emote"
                                    ? "emote"
                                    : "pasta",
                                )
                              }
                              disabled={previewMode() !== "demo"}
                              class={cn(
                                "h-9",
                                previewMode() !== "demo" && "opacity-50",
                              )}
                            >
                              <option value="pasta">Сообщения</option>
                              <option value="emote">Обычный</option>
                            </SetupSelect>
                          </div>
                        </Show>
                      </div>
                      <div class="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                        {isYouTubeOnly()
                          ? "Для YouTube-only превью доступен только лайв режим."
                          : "Лайв — реальный чат. Демо — тестовые сообщения."}
                      </div>
                    </div>

                    <Show when={previewMode() === "demo"}>
                      <div class="flex shrink-0 flex-col gap-2 rounded-lg border border-border bg-card/40 p-2.5">
                        <div class="flex items-baseline justify-between gap-2">
                          <div class="text-xs font-medium sm:text-sm">
                            Скорость сообщений
                          </div>
                          <div class="whitespace-nowrap text-[11px] font-semibold text-muted-foreground sm:text-xs">
                            {messageSpeedLabel()}
                          </div>
                        </div>
                        <Slider
                          aria-label="Скорость сообщений"
                          minValue={MIN_MESSAGE_SPEED}
                          maxValue={MAX_MESSAGE_SPEED}
                          step={1}
                          value={[messageSpeedValue()]}
                          onChange={(values) => {
                            const next = values[0];
                            if (next !== undefined)
                              setMessageSpeed(String(next));
                          }}
                          class="w-full px-1"
                        />
                        <div class="flex justify-between text-[11px] text-muted-foreground">
                          <span>Стоп</span>
                          <span>Летит</span>
                        </div>
                      </div>
                    </Show>

                    <div class="relative h-[min(420px,46dvh)] w-full min-h-[240px] flex-1 overflow-hidden bg-transparent min-[1100px]:h-auto min-[1100px]:min-h-[280px]">
                      <iframe
                        ref={iframeRef}
                        src={previewUrl()}
                        onLoad={() => postPreviewConfig()}
                        class="pointer-events-none relative z-[1] block h-full w-full border-0 bg-transparent"
                        title="Chat preview"
                        scrolling="no"
                        tabindex="-1"
                      />
                    </div>
                  </div>
                </SectionCard>

                <Show when={generatedUrl()}>
                  <SectionCard
                    title="Ссылка для OBS"
                    compact
                    class="shrink-0"
                  >
                    <div class="break-all rounded-md border border-border bg-background px-2.5 py-2 font-mono text-[0.75em] leading-snug text-muted-foreground">
                      {generatedUrl()}
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        onClick={copyToClipboard}
                      >
                        Скопировать
                      </Button>
                      <a
                        href={generatedUrl()}
                        target="_blank"
                        rel="noreferrer"
                        class={cn(
                          "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        )}
                      >
                        Открыть
                      </a>
                    </div>
                  </SectionCard>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
