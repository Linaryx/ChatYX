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
  SETUP_NAV,
  SetupNav,
  ToggleRows,
  type ControlRow,
  type SetupSectionId,
  type ToggleRow,
} from "~/components/setup/SetupLayout";
import { VoiceCatalog } from "~/components/setup/VoiceCatalog";
import { SetupImportCard } from "~/components/setup/SetupImportCard";
import { parseSetupImport } from "~/config/setupImport";
import { applySetupImport } from "~/components/setup/setupImportAdapter";
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
  type PlatformMarkerMode,
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
import Check from "lucide-solid/icons/check";
import Copy from "lucide-solid/icons/copy";
import ExternalLink from "lucide-solid/icons/external-link";
import Monitor from "lucide-solid/icons/monitor";
import Pause from "lucide-solid/icons/pause";
import Play from "lucide-solid/icons/play";
import SlidersHorizontal from "lucide-solid/icons/sliders-horizontal";
import "~/components/setup/SetupWorkspace.css";

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
  config: "chatyx.setup.config.v1",
  twitchChannel: "chatyx.setup.twitchChannel",
  previewStageBackdrop: "chatyx.setup.previewStageBackdrop",
  previewStageColor: "chatyx.setup.previewStageColor",
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
  const [kickChannel, setKickChannel] = createSignal("");
  const [platformMarker, setPlatformMarker] = createSignal<PlatformMarkerMode>(
    DEFAULT_CHAT_CONFIG.platformMarker,
  );
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
  const [demoPaused, setDemoPaused] = createSignal(false);
  const [stageBackdrop, setStageBackdrop] = createSignal<
    "dark" | "light" | "checker" | "custom"
  >(
    (readStoredSetupValue(SETUP_STORAGE_KEYS.previewStageBackdrop) as
      | "dark"
      | "light"
      | "checker"
      | "custom") || "dark",
  );
  const [stageColor, setStageColor] = createSignal(
    readStoredSetupValue(SETUP_STORAGE_KEYS.previewStageColor) || "#241b33",
  );

  const previewStageStyle = createMemo(() => {
    switch (stageBackdrop()) {
      case "checker":
        return "background-image: repeating-conic-gradient(#ffffff 0% 25%, #d4d4d8 0% 50%); background-size: 16px 16px;";
      case "light":
        return "background-color: #ffffff;";
      case "custom":
        return `background-color: ${stageColor()};`;
      case "dark":
      default:
        return "background-color: #000000;";
    }
  });
  const [reducedMotion, setReducedMotion] = createSignal(false);
  const [mobileView, setMobileView] = createSignal<"settings" | "preview">("settings");
  const [copyStatus, setCopyStatus] = createSignal<"idle" | "copying" | "success" | "error">("idle");
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
  const [showGifs, setShowGifs] = createSignal(DEFAULT_CHAT_CONFIG.showGifs);
  const [gifScale, setGifScale] = createSignal(String(DEFAULT_CHAT_CONFIG.gifScale));
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
  let settingsScrollRef: HTMLElement | undefined;
  // eslint-disable-next-line no-unassigned-vars -- assigned by SolidJS ref={}
  let bodyScrollRef: HTMLDivElement | undefined;
  const sectionScrollPositions = new Map<SetupSectionId, number>();
  const viewScrollPositions = { settings: 0, preview: 0 };
  let activePreviewSessionKey = "";
  let previewNavigationTimer: number | undefined;
  let copyResetTimer: number | undefined;

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
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => {
      setReducedMotion(motionQuery.matches);
      if (motionQuery.matches) setDemoPaused(true);
    };
    syncMotionPreference();
    motionQuery.addEventListener("change", syncMotionPreference);

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
      motionQuery.removeEventListener("change", syncMotionPreference);
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

  const importSettings = (patch: Parameters<typeof applySetupImport>[0]) => {
    applySetupImport(patch, {
      channel: setChannel,
      youtubeChannel: setYoutubeChannel,
      kickChannel: setKickChannel,
      platformMarker: setPlatformMarker,
      showGifs: setShowGifs,
      gifScale: setGifScale,
      animation: setAnimation,
      bots: setBots,
      commands: setCommands,
      hideSpecialBadges: setHideSpecialBadges,
      showHomies: setShowHomies,
      fade: setFade,
      size: setSize,
      font: setFont,
      fontWeight: setFontWeight,
      fontCustom: setFontCustom,
      stroke: setStroke,
      shadow: setShadow,
      emoteScale: setEmoteScale,
      smallCaps: setSmallCaps,
      nlAfterName: setNlAfterName,
      hideNames: setHideNames,
      botNames: setBotNames,
      reverseLineOrder: setReverseLineOrder,
      horizontal: setHorizontal,
      singleChatter: setAllowedChatters,
      show7tvUnlisted: setShow7tvUnlisted,
      showHighlightedMessages: setShowHighlightedMessages,
      showGigantifiedEmotes: setShowGigantifiedEmotes,
      showChannelPointRewards: setShowChannelPointRewards,
      nickFontWeight: setNickFontWeight,
      messageSpeed: setMessageSpeed,
      recentMessages: setRecentMessages,
      ffzBotMixBroadcaster: setFfzBotMixBroadcaster,
      ffzBotMixModerator: setFfzBotMixModerator,
      ffzBotMixVip: setFfzBotMixVip,
      overlayBackgroundColor: setOverlayBackgroundColor,
      overlayBackgroundOpacity: setOverlayBackgroundOpacity,
      overlayBackgroundRadius: setOverlayBackgroundRadius,
      overlayBorderOpacity: setOverlayBorderOpacity,
      highlightTwitchEvents: setHighlightTwitchEvents,
      twitchEventColor: setTwitchEventColor,
      twitchEventBackgroundOpacity: setTwitchEventBackgroundOpacity,
      twitchEventBold: setTwitchEventBold,
      twitchEventItalic: setTwitchEventItalic,
      showPredictions: setShowPredictions,
      linkMode: setLinkMode,
      linkColor: setLinkColor,
      hideLinkRewards: setHideLinkRewards,
      rteProxy: setRteProxy,
      rteAzureTts: setRteAzureTts,
      rteChatIsTts: setRteChatIsTts,
      rteReyohohoBadge: setRteReyohohoBadge,
      rteCustomCosmetics: setRteCustomCosmetics,
    });
  };

  const scrollToSection = (id: SetupSectionId) => {
    if (id === activeSection()) return;
    const scroller = window.matchMedia("(min-width: 1100px)").matches
      ? settingsScrollRef : bodyScrollRef;
    sectionScrollPositions.set(activeSection(), scroller?.scrollTop ?? 0);
    setActiveSection(id);
    if (scroller) scroller.scrollTop = sectionScrollPositions.get(id) ?? 0;
  };

  const selectMobileView = (view: "settings" | "preview") => {
    if (view === mobileView()) return;
    viewScrollPositions[mobileView()] = bodyScrollRef?.scrollTop ?? 0;
    setMobileView(view);
    if (bodyScrollRef) bodyScrollRef.scrollTop = viewScrollPositions[view];
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
    kickChannel: kickChannel().trim().replace(/^@/, ""),
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
    showGifs: showGifs(),
    gifScale: toFloat(gifScale(), DEFAULT_CHAT_CONFIG.gifScale),
    botNames: normalizeBotNames(botNames().join(",")),
    singleChatter: normalizeBotNames(allowedChatters().join(",")),
    show7tvUnlisted: show7tvUnlisted(),
    smallCaps: smallCaps(),
    nlAfterName: nlAfterName(),
    hideNames: hideNames(),
    reverseLineOrder: reverseLineOrder(),
    horizontal: horizontal(),
    platformMarker: platformMarker(),
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

  let canPersistSetupConfig = false;
  onMount(() => {
    const savedConfig = readStoredSetupValue(SETUP_STORAGE_KEYS.config);
    if (savedConfig) {
      const result = parseSetupImport(savedConfig, "chatyx");
      if (result.kind === "parsed") importSettings(result.patch);
    }
    canPersistSetupConfig = true;
  });

  createEffect(() => {
    const persistedConfig = chatConfigToSearchParams(buildConfig(channel().trim()))
      .toString();
    if (canPersistSetupConfig) {
      writeStoredSetupValue(SETUP_STORAGE_KEYS.config, persistedConfig);
    }
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
  const hasKickChannel = createMemo(() => Boolean(kickChannel().trim()));
  const isExternalOnly = createMemo(
    () => (hasYouTubeChannel() || hasKickChannel()) && !hasTwitchChannel(),
  );
  const previewChannel = createMemo(() =>
    channel().trim() || (hasYouTubeChannel() || hasKickChannel() ? "" : "chatyxpreview"),
  );
  // Preview playback is deliberately separate from the exported OBS configuration.
  const previewConfig = createMemo(() => ({
    ...buildConfig(previewChannel()),
    ...(previewMode() === "demo" && demoPaused() ? { messageSpeed: 0 } : {}),
    ...(reducedMotion() ? { animation: "none" as const } : {}),
  }));
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
    if (isExternalOnly() && previewMode() === "demo") {
      setPreviewMode("live");
    }
  });

  createEffect(() => {
    writeStoredSetupValue(SETUP_STORAGE_KEYS.twitchChannel, channel());
  });

  createEffect(() => {
    writeStoredSetupValue(
      SETUP_STORAGE_KEYS.previewStageBackdrop,
      stageBackdrop(),
    );
    writeStoredSetupValue(SETUP_STORAGE_KEYS.previewStageColor, stageColor());
  });

  createEffect(() => {
    const currentChannel = channel().trim();
    const currentYouTubeChannel = youtubeChannel().trim();
    const currentKickChannel = kickChannel().trim();
    if (!currentChannel && !currentYouTubeChannel && !currentKickChannel) {
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
    if (copyResetTimer !== undefined) {
      window.clearTimeout(copyResetTimer);
    }
  });

  createEffect(() => {
    postPreviewConfig(previewConfig());
  });

  const copyToClipboard = async () => {
    const url = generatedUrl();
    if (!url || copyStatus() === "copying") return;
    setCopyStatus("copying");
    try {
      await navigator.clipboard.writeText(url);
      if (url === generatedUrl()) {
        setCopyStatus("success");
        if (copyResetTimer !== undefined) window.clearTimeout(copyResetTimer);
        copyResetTimer = window.setTimeout(() => {
          copyResetTimer = undefined;
          setCopyStatus("idle");
        }, 2600);
      }
    } catch (err) {
      console.error("Ошибка копирования:", err);
      if (url === generatedUrl()) setCopyStatus("error");
    }
  };

  createEffect(() => {
    generatedUrl();
    setCopyStatus("idle");
  });

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
    {
      label: "Размер GIF",
      hint: "Масштаб GIF относительно размера эмоутов.",
      control: (_labelId) => (
        <SetupNumberField
          label="Размер GIF"
          value={gifScale()}
          onChange={setGifScale}
          min={0.25}
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
      label: "Источник сообщений",
      hint: "Показывается, когда подключены Twitch и YouTube.",
      control: (labelId) => (
        <div class="flex items-center gap-2">
          <img class="size-5 rounded-sm" src={getPublicAssetUrl("img/platform-twitch.svg")} alt="Twitch" />
          <img class="size-5 rounded-sm" src={getPublicAssetUrl("img/platform-youtube.svg")} alt="YouTube" />
          <SetupSelect
            aria-labelledby={labelId}
            value={platformMarker()}
            onChange={(event) =>
              setPlatformMarker(event.currentTarget.value as PlatformMarkerMode)
            }
          >
            <option value="none">Ничего</option>
            <option value="stripe">Полоска</option>
            <option value="icon">Иконка</option>
          </SetupSelect>
        </div>
      ),
    },
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
      label: "Отображать ники заглавными буквами",
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
      label: "Горизонтальная лента сообщений",
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
      label: "Показывать награды за баллы",
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
      label: "Показывать GIF в сообщениях",
      checked: showGifs,
      onChange: setShowGifs,
      hint: "Показывает Twitch GIF в формате WebP. Выключено по умолчанию.",
    },
    {
      label: "Показывать прогнозы над чатом",
      checked: showPredictions,
      onChange: setShowPredictions,
      hint: "Полоска Twitch Predictions над сообщениями. Работает только при указанном Twitch-канале.",
    },
    {
      label: "Показывать сообщения, начинающиеся с !",
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
      label: "Русский TTS через ChatIS / Streamlabs",
      checked: rteChatIsTts,
      onChange: setRteChatIsTts,
      hint: "Команда модератора: !chat tts (или короче !tts) [-s Maxim|Tatyana] текст. Синтезированный аудиофайл не сохраняется.",
    },
    {
      label: "Русский TTS через JustDavi / Azure",
      checked: rteAzureTts,
      onChange: setRteAzureTts,
      hint: "Команда модератора: !chat tts (или короче !tts) [-s Dmitry|Svetlana] текст.",
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
      label: "Бейдж Reyohoho",
      checked: rteReyohohoBadge,
      onChange: setRteReyohohoBadge,
      hint: "Показывает пользовательский бейдж из публичного RTE API, если он есть.",
    },
    {
      label: "Пользовательские пейнты RTE",
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
          class="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-base leading-none text-white hover:bg-white/10"
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

      <div class="setup-root dark" lang="ru" data-mobile-view={mobileView()}>
        <div class="setup-shell">
          <a class="setup-skip-link" href={mobileView() === "settings" ? "#setup-settings" : "#setup-preview"}>Перейти к рабочей области</a>
          <header class="setup-toolbar">
            <div class="setup-brand">
              <span class="setup-brand-mark" aria-hidden="true"><img src={getPublicAssetUrl("img/emote-2x.webp")} alt="" /></span>
              <div><h1>Чат-оверлей</h1><p>Настрой оформление и добавь оверлей в OBS.</p></div>
            </div>
          </header>
          <div class="setup-view-switch" role="group" aria-label="Рабочая область">
            <button type="button" aria-pressed={mobileView() === "settings"} aria-controls="setup-settings" onClick={() => selectMobileView("settings")}><SlidersHorizontal size={16} aria-hidden="true" />Настройки</button>
            <button type="button" aria-pressed={mobileView() === "preview"} aria-controls="setup-preview" onClick={() => selectMobileView("preview")}><Monitor size={16} aria-hidden="true" />Предпросмотр</button>
          </div>
          <main class="setup-body setup-pane-scroll" ref={bodyScrollRef}>
            <div class="setup-source-row">
            <section class="setup-connection" aria-label="Подключение каналов">
              <div class="setup-connection-intro"><h2>Подключение</h2><p>Укажи Twitch, YouTube, Kick или несколько каналов.</p></div>
              <div class="setup-channel-field">
                <span class="setup-field-label setup-platform-label">
                  <svg class="setup-platform-logo setup-platform-logo--twitch" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                  </svg>
                  Twitch
                </span>
                <TwitchChannelField value={channel()} onChange={setChannel} />
              </div>
              <div class="setup-channel-field">
                <label class="setup-field-label setup-platform-label" for="setup-youtube">
                  <svg class="setup-platform-logo setup-platform-logo--youtube" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.51A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.123 2.136c1.872.509 9.377.509 9.377.509s7.505 0 9.377-.51a3.02 3.02 0 0 0 2.122-2.135C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  YouTube <span>необязательно</span>
                </label>
                <Input
                  id="setup-youtube"
                  type="text"
                  autocomplete="off"
                  spellcheck={false}
                  value={youtubeChannel()}
                  onInput={(e) => setYoutubeChannel(e.currentTarget.value)}
                  placeholder="@канал или ID канала"
                  class="h-10"
                />
              </div>
              <div class="setup-channel-field">
                <label class="setup-field-label setup-platform-label" for="setup-kick">
                  <img class="setup-platform-logo" src={getPublicAssetUrl("img/platform-kick.svg")} alt="" />
                  Kick <span>необязательно</span>
                </label>
                <Input
                  id="setup-kick"
                  type="text"
                  autocomplete="off"
                  spellcheck={false}
                  value={kickChannel()}
                  onInput={(event) => setKickChannel(event.currentTarget.value)}
                  placeholder="название канала"
                  class="h-10"
                />
              </div>
            </section>
            <div class="setup-export">
              <label for="setup-obs-url" class="setup-field-label">Ссылка для OBS</label>
              <Input id="setup-obs-url" type="text" readonly value={generatedUrl()} placeholder="Укажи канал, чтобы создать ссылку" onFocus={(event) => event.currentTarget.select()} class="setup-url-input" aria-describedby="setup-copy-status" />
              <Button
                type="button"
                onClick={copyToClipboard}
                disabled={!generatedUrl() || copyStatus() === "copying"}
                class={cn(
                  "setup-url-copy-button",
                  copyStatus() === "success" && "setup-url-copy-button--success",
                )}
              >
                <Show when={copyStatus() === "success"} fallback={<Copy size={16} aria-hidden="true" />}><Check size={16} aria-hidden="true" /></Show>
                {copyStatus() === "success" ? "Скопировано" : "Скопировать"}
              </Button>
              <Show when={generatedUrl()}><a class="setup-open-link" href={generatedUrl()} target="_blank" rel="noreferrer" aria-label="Открыть оверлей в новой вкладке"><ExternalLink size={15} aria-hidden="true" /><span>Открыть</span></a></Show>
              <p id="setup-copy-status" role="status" aria-live="polite" class={cn("setup-copy-status", copyStatus() === "success" && "setup-copy-status--success", copyStatus() === "error" && "setup-copy-status--error")}>
                {copyStatus() === "success" ? "Ссылка скопирована. Добавь в OBS источник «Браузер» и вставь её."
                  : copyStatus() === "error" ? "Не удалось скопировать. Выдели ссылку выше и скопируй её вручную."
                  : copyStatus() === "copying" ? "Копирование ссылки…"
                  : generatedUrl() ? "Добавь в OBS источник «Браузер» и вставь эту ссылку."
                  : "Для демо канал не нужен. Для OBS укажи хотя бы один канал."}
              </p>
            </div>
            </div>
          <div class="setup-workspace">
            <aside class="setup-sidebar setup-pane-scroll">
              <p class="setup-sidebar-caption">Настройки оверлея</p>
                <SetupNav active={activeSection()} onSelect={scrollToSection} />
            </aside>

            <div
              id="setup-settings"
              tabIndex={-1}
              ref={(el) => {
                settingsScrollRef = el;
              }}
              class="setup-settings setup-pane-scroll"
            >
              <div class="setup-section-select">
                <label for="setup-section-picker" class="setup-field-label">Раздел настроек</label>
                <SetupSelect id="setup-section-picker" value={activeSection()} onChange={(event) => scrollToSection(event.currentTarget.value as SetupSectionId)}>
                  <For each={SETUP_NAV}>{(item) => <option value={item.id}>{item.label}</option>}</For>
                </SetupSelect>
              </div>

              <SetupImportCard
                hidden={activeSection() !== "import"}
                onImport={importSettings}
              />

              <SectionCard
                id="setup-section-appearance"
                title="Текст и размер"
                description="Настрой, насколько крупно и каким шрифтом будет выглядеть чат."
                hidden={activeSection() !== "appearance"}
              >
                <div class="setup-field-group"><h3>Шрифт сообщений</h3><ControlRows rows={appearanceRows.slice(0, 3)} /></div>
                <div class="setup-field-group"><h3>Насыщенность и эмоуты</h3><ControlRows rows={appearanceRows.slice(3)} /></div>
              </SectionCard>

              <SectionCard
                id="setup-section-styling"
                title="Внешний вид"
                description="Фон сообщений, тень, обводка и время жизни строк на экране."
                hidden={activeSection() !== "styling"}
              >
                <div class="setup-field-group"><h3>Читаемость текста</h3><ControlRows rows={stylingRows.slice(0, 3)} /></div>
                <div class="setup-field-group"><h3>Подложка сообщений</h3><ControlRows rows={stylingRows.slice(3, 6)} /></div>
                <div class="setup-field-group"><h3>Цветовые акценты</h3><ControlRows rows={stylingRows.slice(6)} /></div>
              </SectionCard>

              <SectionCard
                id="setup-section-behavior"
                title="Поведение сообщений"
                description="Управляет анимацией, переносами, порядком и форматом сообщений."
                hidden={activeSection() !== "behavior"}
              >
                <div class="setup-field-group"><h3>Анимация и ссылки</h3><ControlRows rows={behaviorRows} /></div>
                <div class="setup-field-group"><h3>Оформление событий</h3><ToggleRows rows={behaviorToggles.slice(0, 3)} /></div>
                <div class="setup-field-group"><h3>Поток сообщений</h3><ToggleRows rows={behaviorToggles.slice(3)} /></div>
              </SectionCard>

              <SectionCard
                id="setup-section-content"
                title="Контент и бейджи"
                description="Выбери, какие сообщения, эмоуты и бейджи попадут в оверлей."
                hidden={activeSection() !== "content"}
              >
                <div class="setup-field-group"><h3>Сообщения и события</h3><ToggleRows rows={contentToggles.slice(0, 6)} /></div>
                <div class="setup-field-group"><h3>Эмоуты и бейджи</h3><ToggleRows rows={contentToggles.slice(6)} /></div>

                <div class="setup-role-merge grid grid-cols-1 gap-3 rounded-lg border border-border bg-black/40 p-3.5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
                  <div class="flex min-w-0 flex-col gap-1.5">
                    <div class="text-sm font-bold text-foreground">
                      Бейдж бота рядом с ролью
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
                hidden={activeSection() !== "bots"}
              >
                <div class="setup-bot-row grid grid-cols-1 items-start gap-2 min-[1100px]:grid-cols-[132px_minmax(0,1fr)] xl:grid-cols-[168px_minmax(0,1fr)] md:max-[1099px]:grid-cols-[180px_minmax(0,1fr)]">
                  <div class="flex min-w-0 flex-col gap-1.5">
                    <div class="text-xs font-medium text-foreground sm:text-sm">
                      Ники ботов
                    </div>
                    <div class="inline-flex items-center gap-2 text-[11px] text-muted-foreground sm:text-xs">
                      <SetupSwitch
                        checked={!bots()}
                        onChange={(hideBots) => setBots(!hideBots)}
                        label="Скрывать ботов"
                      />
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
                description="Включи один или оба сервиса синтеза речи для единой команды модератора."
                hidden={activeSection() !== "tts"}
              >
                <ToggleRows rows={ttsToggles} />
                <VoiceCatalog />
              </SectionCard>

              <SectionCard
                id="setup-section-rte"
                title="RTE-интеграции"
                description="Необязательный прокси для публичных ресурсов и пользовательской косметики."
                hidden={activeSection() !== "rte"}
              >
                <ToggleRows rows={rteToggles} />
              </SectionCard>
            </div>

            <div id="setup-preview" tabIndex={-1} class="setup-preview-pane setup-pane-scroll min-h-0 min-w-0 overflow-y-auto overscroll-contain min-[1100px]:h-full">
              <div class="flex min-h-0 flex-col gap-2.5 pb-2 min-[1100px]:h-full min-[1100px]:pb-0">
                <SectionCard
                  title="Предпросмотр"
                  compact
                  class="min-[1100px]:flex min-[1100px]:min-h-0 min-[1100px]:flex-1 min-[1100px]:flex-col"
                >
                  <div class="setup-preview-content">
                    <div class="setup-preview-options">
                      <div
                        class={cn(
                          "setup-preview-controls grid gap-2",
                          isExternalOnly()
                            ? "grid-cols-1"
                            : "grid-cols-1 min-[1100px]:grid-cols-1 xl:grid-cols-2",
                        )}
                      >
                        <div class="flex min-w-0 flex-col gap-1">
                          <div class="text-xs font-medium sm:text-sm">
                            Режим чата
                          </div>
                          <SetupSelect
                            aria-label="Режим чата в предпросмотре"
                            value={previewMode()}
                            onChange={(event) =>
                              setPreviewMode(
                                isExternalOnly() ||
                                  event.currentTarget.value === "live"
                                  ? "live"
                                  : "demo",
                              )
                            }
                            class="h-9"
                          >
                            <option value="live">Чат канала</option>
                            <Show when={!isExternalOnly()}>
                              <option value="demo">Демо</option>
                            </Show>
                          </SetupSelect>
                        </div>
                        <Show when={!isExternalOnly()}>
                          <div class="flex min-w-0 flex-col gap-1">
                            <div class="text-xs font-medium sm:text-sm">
                              Сценарий демо
                            </div>
                            <SetupSelect
                              aria-label="Сценарий демо"
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
                              <option value="emote">Эмоуты</option>
                            </SetupSelect>
                          </div>
                        </Show>
                        <div class="flex min-w-0 flex-col gap-1 xl:col-span-full">
                          <div
                            class="text-xs font-medium sm:text-sm"
                          >
                            Фон предпросмотра
                          </div>
                          <div
                            class="setup-stage-switcher"
                            role="group"
                            aria-label="Фон предпросмотра"
                          >
                            <button
                              type="button"
                              class={cn("setup-stage-option", stageBackdrop() === "dark" && "setup-stage-option--active")}
                              aria-pressed={stageBackdrop() === "dark"}
                              aria-label="Чёрная подложка"
                              onClick={() => setStageBackdrop("dark")}
                            >
                              <span class="setup-stage-swatch setup-stage-swatch--dark" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              class={cn("setup-stage-option", stageBackdrop() === "light" && "setup-stage-option--active")}
                              aria-pressed={stageBackdrop() === "light"}
                              aria-label="Белая подложка"
                              onClick={() => setStageBackdrop("light")}
                            >
                              <span class="setup-stage-swatch setup-stage-swatch--light" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              class={cn("setup-stage-option", stageBackdrop() === "checker" && "setup-stage-option--active")}
                              aria-pressed={stageBackdrop() === "checker"}
                              aria-label="Подложка-сетка"
                              onClick={() => setStageBackdrop("checker")}
                            >
                              <span class="setup-stage-swatch setup-stage-swatch--checker" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              class={cn("setup-stage-option", stageBackdrop() === "custom" && "setup-stage-option--active")}
                              aria-pressed={stageBackdrop() === "custom"}
                              aria-label="Свой цвет подложки"
                              onClick={() => setStageBackdrop("custom")}
                            >
                              <span class="setup-stage-swatch" style={`background-color: ${stageColor()}`} aria-hidden="true" />
                            </button>
                          </div>
                          <p class="setup-preview-hint">Только для проверки. Не меняет фон в OBS.</p>
                          <Show when={stageBackdrop() === "custom"}>
                            <div class="setup-stage-color">
                              <ColorPickerField
                                color={stageColor()}
                                opacity={100}
                                showOpacity={false}
                                label="Цвет подложки"
                                onChange={(value) => setStageColor(value.color)}
                              />
                            </div>
                          </Show>
                          </div>
                      </div>
                      <div class="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                        {isExternalOnly()
                          ? "Для внешних источников доступен только чат канала."
                          : "Чат канала показывает сообщения в реальном времени. Демо выводит тестовые сообщения."}
                      </div>
                    </div>

                    <Show when={previewMode() === "demo"}>
                      <div class="setup-preview-playback">
                        <div class="setup-preview-speed">
                          <span class="text-xs font-medium sm:text-sm">
                            Скорость
                          </span>
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
                            class="min-w-0 flex-1 px-1"
                          />
                          <div class="whitespace-nowrap text-[11px] font-semibold tabular-nums text-muted-foreground sm:text-xs">
                            {messageSpeedLabel()}
                          </div>
                        </div>
                        <button
                          type="button"
                          class={cn(
                            "setup-pause-button",
                            demoPaused() && "setup-pause-button--paused",
                          )}
                          onClick={() => setDemoPaused((value) => !value)}
                          aria-pressed={demoPaused()}
                        >
                          <Show when={demoPaused()} fallback={<Pause size={14} aria-hidden="true" />}>
                            <Play size={14} aria-hidden="true" />
                          </Show>
                          {demoPaused() ? "Продолжить" : "Пауза"}
                        </button>
                      </div>
                    </Show>

                    <div
                      class="setup-preview-frame relative isolate h-[clamp(180px,36dvh,320px)] w-full shrink-0 overflow-hidden min-[1100px]:h-auto min-[1100px]:flex-1 min-[1100px]:min-h-[min(180px,36dvh)] min-[1100px]:max-h-[42dvh]"
                      style={previewStageStyle()}
                    >
                      <iframe
                        ref={iframeRef}
                        src={previewUrl()}
                        onLoad={() => postPreviewConfig()}
                        class="pointer-events-none block h-full w-full border-0 bg-transparent"
                        title="Предпросмотр чата"
                        scrolling="no"
                        tabIndex={-1}
                      />
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
          </main>
        </div>
      </div>
    </>
  );
}
