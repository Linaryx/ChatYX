import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  type JSX,
} from "solid-js";
import { Title } from "@solidjs/meta";
import { ColorPickerField } from "~/components/ColorPickerField";
import { LanguageSwitcher } from "~/components/setup/LanguageSwitcher";
import { locale, t } from "~/i18n";
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
import { toVisualSetupPatch } from "~/config/setupTemplates";
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
import Monitor from "lucide-solid/icons/monitor";
import Pause from "lucide-solid/icons/pause";
import Play from "lucide-solid/icons/play";
import SlidersHorizontal from "lucide-solid/icons/sliders-horizontal";
import X from "lucide-solid/icons/x";
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

type LocalFontStatus =
  | { kind: "idle" }
  | { kind: "available"; browser: string }
  | { kind: "unsupported" }
  | { kind: "loading" }
  | { kind: "found"; count: number }
  | { kind: "empty" }
  | { kind: "error" };

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
  const [lineHeight, setLineHeight] = createSignal(String(DEFAULT_CHAT_CONFIG.lineHeight));
  const [fontWeight, setFontWeight] = createSignal(
    String(DEFAULT_CHAT_CONFIG.fontWeight),
  );
  const [nickFontWeight, setNickFontWeight] = createSignal(
    String(DEFAULT_CHAT_CONFIG.nickFontWeight),
  );
  const [fontCustom, setFontCustom] = createSignal("");
  const [localFontBrowser, setLocalFontBrowser] = createSignal("");
  const [localFonts, setLocalFonts] = createSignal<LocalFontOption[]>([]);
  const [localFontStatus, setLocalFontStatus] = createSignal<LocalFontStatus>({
    kind: "idle",
  });
  const [isLoadingLocalFonts, setIsLoadingLocalFonts] = createSignal(false);
  const localFontStatusText = createMemo(() => {
    const status = localFontStatus();
    switch (status.kind) {
      case "available":
        return t("setup.localFontsAvailable", { browser: status.browser });
      case "unsupported":
        return t("setup.localFontsUnsupported");
      case "loading":
        return t("setup.localFontsLoading");
      case "found":
        return t("setup.localFontsFound", { count: status.count });
      case "empty":
        return t("setup.localFontsEmpty");
      case "error":
        return t("setup.localFontsError");
      case "idle":
        return "";
    }
  });
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
  const storedStageColor = readStoredSetupValue(
    SETUP_STORAGE_KEYS.previewStageColor,
  );
  const [stageColor, setStageColor] = createSignal(
    storedStageColor?.toUpperCase() === "#241B33"
      ? "#FF8400"
      : storedStageColor || "#FF8400",
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
  const [resetPending, setResetPending] = createSignal(false);
  const [previewDemoKind, setPreviewDemoKind] = createSignal<
    "pasta" | "emote"
  >("pasta");
  const [previewModeThumbStyle, setPreviewModeThumbStyle] =
    createSignal<JSX.CSSProperties>({ opacity: "0" });
  const [previewDemoThumbStyle, setPreviewDemoThumbStyle] =
    createSignal<JSX.CSSProperties>({ opacity: "0" });
  let previewControlsRef: HTMLDivElement | undefined;
  let previewModeSelectorRef: HTMLDivElement | undefined;
  let previewLiveOptionRef: HTMLButtonElement | undefined;
  let previewDemoOptionRef: HTMLButtonElement | undefined;
  let previewDemoSelectorRef: HTMLDivElement | undefined;
  let previewPastaOptionRef: HTMLButtonElement | undefined;
  let previewEmoteOptionRef: HTMLButtonElement | undefined;
  const [showHomies, setShowHomies] = createSignal(
    DEFAULT_CHAT_CONFIG.showHomies,
  );
  const [recentMessages, setRecentMessages] = createSignal(
    DEFAULT_CHAT_CONFIG.recentMessages,
  );
  const [bots, setBots] = createSignal(DEFAULT_CHAT_CONFIG.bots);
  const [commands, setCommands] = createSignal(DEFAULT_CHAT_CONFIG.commands);
  const [show7tvBadges, setShow7tvBadges] = createSignal(
    DEFAULT_CHAT_CONFIG.show7tvBadges,
  );
  const [showFfzBadges, setShowFfzBadges] = createSignal(
    DEFAULT_CHAT_CONFIG.showFfzBadges,
  );
  const [showBttvBadges, setShowBttvBadges] = createSignal(
    DEFAULT_CHAT_CONFIG.showBttvBadges,
  );
  const [showChatterinoBadges, setShowChatterinoBadges] = createSignal(
    DEFAULT_CHAT_CONFIG.showChatterinoBadges,
  );
  const [showChatisBadges, setShowChatisBadges] = createSignal(
    DEFAULT_CHAT_CONFIG.showChatisBadges,
  );
  const [showTwitchBadges, setShowTwitchBadges] = createSignal(
    DEFAULT_CHAT_CONFIG.showTwitchBadges,
  );
  const [showYouTubeBadges, setShowYouTubeBadges] = createSignal(
    DEFAULT_CHAT_CONFIG.showYouTubeBadges,
  );
  const [showKickBadges, setShowKickBadges] = createSignal(
    DEFAULT_CHAT_CONFIG.showKickBadges,
  );
  const [hideAllBadges, setHideAllBadges] = createSignal(
    DEFAULT_CHAT_CONFIG.hideAllBadges,
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
  const [overlayPadding, setOverlayPadding] = createSignal(
    String(DEFAULT_CHAT_CONFIG.overlayPadding),
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
  const [usersColorEnabled, setUsersColorEnabled] = createSignal(false);
  const [usersColor, setUsersColor] = createSignal("#ffffff");
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
      setLocalFontStatus({ kind: "available", browser: supportedBrowser });
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
      hideAllBadges: setHideAllBadges,
      showHomies: setShowHomies,
      show7tvBadges: setShow7tvBadges,
      showFfzBadges: setShowFfzBadges,
      showBttvBadges: setShowBttvBadges,
      showChatterinoBadges: setShowChatterinoBadges,
      showChatisBadges: setShowChatisBadges,
      showTwitchBadges: setShowTwitchBadges,
      showYouTubeBadges: setShowYouTubeBadges,
      showKickBadges: setShowKickBadges,
      fade: setFade,
      size: setSize,
      font: setFont,
      lineHeight: setLineHeight,
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
      overlayPadding: setOverlayPadding,
      overlayBorderOpacity: setOverlayBorderOpacity,
      highlightTwitchEvents: setHighlightTwitchEvents,
      twitchEventColor: setTwitchEventColor,
      twitchEventBackgroundOpacity: setTwitchEventBackgroundOpacity,
      twitchEventBold: setTwitchEventBold,
      twitchEventItalic: setTwitchEventItalic,
      showPredictions: setShowPredictions,
      linkMode: setLinkMode,
      linkColor: setLinkColor,
      usersColor: setUsersColor,
      hideLinkRewards: setHideLinkRewards,
      rteProxy: setRteProxy,
      rteAzureTts: setRteAzureTts,
      rteChatIsTts: setRteChatIsTts,
      rteReyohohoBadge: setRteReyohohoBadge,
      rteCustomCosmetics: setRteCustomCosmetics,
    });
    if (patch.usersColor !== undefined) {
      setUsersColorEnabled(Boolean(patch.usersColor));
    }
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

  const previewFrameStyle = createMemo(() => {
    const radius = toClampedInt(
      overlayBackgroundRadius(),
      DEFAULT_CHAT_CONFIG.overlayBackgroundRadius,
      0,
      128,
    );
    return `${previewStageStyle()} border-radius: ${radius}px;`;
  });

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
    lineHeight: toClampedInt(lineHeight(), DEFAULT_CHAT_CONFIG.lineHeight, 80, 200),
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
    show7tvBadges: show7tvBadges(),
    showFfzBadges: showFfzBadges(),
    showBttvBadges: showBttvBadges(),
    showChatterinoBadges: showChatterinoBadges(),
    showChatisBadges: showChatisBadges(),
    showTwitchBadges: showTwitchBadges(),
    showYouTubeBadges: showYouTubeBadges(),
    showKickBadges: showKickBadges(),
    recentMessages: recentMessages(),
    bots: bots(),
    commands: commands(),
    hideAllBadges: hideAllBadges(),
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
    overlayPadding: toInt(
      overlayPadding(),
      DEFAULT_CHAT_CONFIG.overlayPadding,
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
    usersColor: usersColorEnabled()
      ? normalizeHexColor(usersColor(), "#ffffff")
      : "",
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
  const hasPreviewChannel = createMemo(
    () => hasTwitchChannel() || hasYouTubeChannel() || hasKickChannel(),
  );
  const getPreviewSelectorThumbStyle = (
    selector: HTMLDivElement | undefined,
    option: HTMLButtonElement | undefined,
  ): JSX.CSSProperties => {
    if (!selector || !option) return { opacity: "0" };

    const selectorRect = selector.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    return {
      height: `${optionRect.height}px`,
      opacity: "1",
      transform: `translateY(${optionRect.top - selectorRect.top}px)`,
    };
  };
  const updatePreviewSelectorThumbs = () => {
    setPreviewModeThumbStyle(
      getPreviewSelectorThumbStyle(
        previewModeSelectorRef,
        previewMode() === "live" ? previewLiveOptionRef : previewDemoOptionRef,
      ),
    );
    setPreviewDemoThumbStyle(
      isExternalOnly()
        ? { opacity: "0" }
        : getPreviewSelectorThumbStyle(
            previewDemoSelectorRef,
            previewDemoKind() === "pasta"
              ? previewPastaOptionRef
              : previewEmoteOptionRef,
          ),
    );
  };
  createEffect(updatePreviewSelectorThumbs);
  onMount(() => {
    const observer = new ResizeObserver(updatePreviewSelectorThumbs);
    if (previewControlsRef) observer.observe(previewControlsRef);
    onCleanup(() => observer.disconnect());
  });
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
    messageIntervalMs() === null
      ? t("setup.speedStopped")
      : `${messageIntervalMs()} ${t("setup.milliseconds")}`,
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
    if (!hasPreviewChannel() && previewMode() === "live") {
      setPreviewMode("demo");
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

  const resetSettings = () => {
    if (!resetPending()) {
      setResetPending(true);
      return;
    }

    importSettings({
      ...DEFAULT_CHAT_CONFIG,
      botNames: [...DEFAULT_BOT_NAMES],
      singleChatter: [],
    });
    setUsersColorEnabled(false);
    setBotInput("");
    setBotProfiles({});
    setAllowedChatterInput("");
    setStageBackdrop("dark");
    setStageColor("#FF8400");
    setCopyStatus("idle");
    setResetPending(false);
  };

  createEffect(() => {
    generatedUrl();
    setCopyStatus("idle");
  });

  const loadLocalFonts = async () => {
    const queryLocalFonts = (window as LocalFontWindow).queryLocalFonts;
    if (!localFontBrowser() || typeof queryLocalFonts !== "function") {
      setLocalFontStatus({ kind: "unsupported" });
      return;
    }

    setIsLoadingLocalFonts(true);
    setLocalFontStatus({ kind: "loading" });

    try {
      const fonts = normalizeLocalFonts(await queryLocalFonts());
      setLocalFonts(fonts);
      setLocalFontStatus(
        fonts.length > 0
          ? { kind: "found", count: fonts.length }
          : { kind: "empty" },
      );
    } catch {
      setLocalFontStatus({ kind: "error" });
    } finally {
      setIsLoadingLocalFonts(false);
    }
  };

  const appearanceRows: ControlRow[] = [
    {
      label: () => t("setup.messageSize"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={size()}
          onChange={(e) => setSize(e.currentTarget.value)}
        >
          <option value="1">{t("setup.small")}</option>
          <option value="2">{t("setup.medium")}</option>
          <option value="3">{t("setup.large")}</option>
        </SetupSelect>
      ),
    },
    {
      label: () => t("setup.font"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={font()}
          onChange={(e) => setFont(e.currentTarget.value)}
        >
          <option value="0">{t("setup.customFont")}</option>
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
          <option value="13">BF Mono</option>
        </SetupSelect>
      ),
    },
    {
      label: () => t("setup.customFontName"),
      hint: () => t("setup.customFontHint"),
      control: (labelId) => (
        <div class="flex flex-col gap-2">
          <Input
            aria-labelledby={labelId}
            type="text"
            value={fontCustom()}
            onInput={(e) => setFontCustom(e.currentTarget.value)}
            placeholder={t("setup.customFontPlaceholder")}
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
                {isLoadingLocalFonts() ? t("setup.loading") : t("setup.local")}
              </Button>
              <SetupSelect
                aria-label={t("setup.selectLocalFont")}
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
                     ? t("setup.selectLocalFont")
                     : t("setup.loadLocalFontsFirst")}
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
          <div class="text-xs text-muted-foreground">{localFontStatusText()}</div>
        </div>
      ),
    },
    {
      label: () => t("setup.lineHeight"),
      hint: () => t("setup.lineHeightHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.lineHeight")}
          value={lineHeight()}
          onChange={setLineHeight}
          min={80}
          max={200}
          step={1}
        />
      ),
    },
    {
      label: () => t("setup.textWeight"),
      hint: () => t("setup.textWeightHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.textWeight")}
          value={fontWeight()}
          onChange={setFontWeight}
          min={100}
          max={1000}
          step={100}
        />
      ),
    },
    {
      label: () => t("setup.nicknameWeight"),
      hint: () => t("setup.nicknameWeightHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.nicknameWeight")}
          value={nickFontWeight()}
          onChange={setNickFontWeight}
          min={100}
          max={1000}
          step={100}
        />
      ),
    },
    {
      label: () => t("setup.emoteSize"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.emoteSize")}
          value={emoteScale()}
          onChange={setEmoteScale}
          min={0}
          max={3}
          step={0.1}
        />
      ),
    },
    {
      label: () => t("setup.gifSize"),
      hint: () => t("setup.gifSizeHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.gifSize")}
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
      label: () => t("setup.textShadow"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={shadow()}
          onChange={(e) => setShadow(e.currentTarget.value)}
        >
          <option value="0">{t("setup.off")}</option>
          <option value="1">{t("setup.small")}</option>
          <option value="2">{t("setup.medium")}</option>
          <option value="3">{t("setup.large")}</option>
        </SetupSelect>
      ),
    },
    {
      label: () => t("setup.textStroke"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={stroke()}
          onChange={(e) => setStroke(e.currentTarget.value)}
        >
          <option value="0">{t("setup.off")}</option>
          <option value="1">{t("setup.thin")}</option>
          <option value="2">{t("setup.medium")}</option>
          <option value="3">{t("setup.thick")}</option>
          <option value="4">{t("setup.veryThick")}</option>
        </SetupSelect>
      ),
    },
    {
      label: () => t("setup.hideMessagesAfter"),
      hint: () => t("setup.hideMessagesAfterHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.hideMessagesAfter")}
          value={fade()}
          onChange={setFade}
          min={0}
          placeholder="30"
        />
      ),
    },
    {
      label: () => t("setup.messageBackground"),
      control: (_labelId) => (
        <ColorPickerField
          label={t("setup.messageBackground")}
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
      label: () => t("setup.backgroundRadius"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.backgroundRadius")}
          value={overlayBackgroundRadius()}
          onChange={setOverlayBackgroundRadius}
          min={0}
          max={64}
          step={1}
        />
      ),
    },
    {
      label: () => t("setup.padding"),
      hint: () => t("setup.paddingHint"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.padding")}
          value={overlayPadding()}
          onChange={setOverlayPadding}
          min={0}
          max={64}
          step={1}
        />
      ),
    },
    {
      label: () => t("setup.borderVisibility"),
      control: (_labelId) => (
        <SetupNumberField
          label={t("setup.borderVisibility")}
          value={overlayBorderOpacity()}
          onChange={setOverlayBorderOpacity}
          min={0}
          max={100}
          step={1}
        />
      ),
    },
    {
      label: () => t("setup.twitchEventsHighlight"),
      hint: () => t("setup.twitchEventsHighlightHint"),
      control: (_labelId) => (
        <ColorPickerField
          label={t("setup.twitchEventsHighlight")}
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
      label: () => t("setup.linkColor"),
      hint: () => t("setup.linkColorHint"),
      control: (_labelId) => (
        <ColorPickerField
          label={t("setup.linkColor")}
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
      label: () => t("setup.messageSource"),
      hint: () => t("setup.messageSourceHint"),
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
            <option value="none">{t("setup.none")}</option>
            <option value="stripe">{t("setup.stripe")}</option>
            <option value="icon">{t("setup.icon")}</option>
          </SetupSelect>
        </div>
      ),
    },
    {
      label: () => t("setup.messageAnimation"),
      hint: () => t("setup.messageAnimationHint"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={animation()}
          onChange={(event) =>
            setAnimation(event.currentTarget.value as ChatAnimationMode)
          }
        >
          <option value="fade">{t("setup.fadeIn")}</option>
          <option value="flow">{t("setup.smoothFlow")}</option>
          <option value="scroll">{t("setup.smoothScroll")}</option>
          <option value="none">{t("setup.noAnimation")}</option>
        </SetupSelect>
      ),
    },
    {
      label: () => t("setup.messageLinks"),
      control: (labelId) => (
        <SetupSelect
          aria-labelledby={labelId}
          value={linkMode()}
          onChange={(event) =>
            setLinkMode(event.currentTarget.value as LinkDisplayMode)
          }
        >
          <option value="normal">{t("setup.normalText")}</option>
          <option value="highlight">{t("setup.highlightWithColor")}</option>
          <option value="hide">{t("setup.hide")}</option>
        </SetupSelect>
      ),
    },
  ];

  const behaviorToggles: ToggleRow[] = [
    {
      label: () => t("setup.highlightTwitchEvents"),
      checked: highlightTwitchEvents,
      onChange: setHighlightTwitchEvents,
    },
    {
      label: () => t("setup.emphasizeEventText"),
      checked: twitchEventBold,
      onChange: setTwitchEventBold,
      hint: () => t("setup.emphasizeEventTextHint"),
    },
    {
      label: () => t("setup.italicEvents"),
      checked: twitchEventItalic,
      onChange: setTwitchEventItalic,
    },
    {
      label: () => t("setup.loadRecentMessages"),
      checked: recentMessages,
      onChange: setRecentMessages,
      hint: () => t("setup.loadRecentMessagesHint"),
    },
    {
      label: () => t("setup.uppercaseNicknames"),
      checked: smallCaps,
      onChange: setSmallCaps,
    },
    {
      label: () => t("setup.lineBreakAfterNickname"),
      checked: nlAfterName,
      onChange: setNlAfterName,
    },
    { label: () => t("setup.hideNicknames"), checked: hideNames, onChange: setHideNames },
    {
      label: () => t("setup.reverseMessageOrder"),
      checked: reverseLineOrder,
      onChange: setReverseLineOrder,
    },
    {
      label: () => t("setup.horizontalMessageFeed"),
      checked: horizontal,
      onChange: setHorizontal,
    },
  ];

  const contentToggles: ToggleRow[] = [
    {
      label: () => t("setup.showHighlightedMessages"),
      checked: showHighlightedMessages,
      onChange: setShowHighlightedMessages,
    },
    {
      label: () => t("setup.showPointRewards"),
      checked: showChannelPointRewards,
      onChange: setShowChannelPointRewards,
    },
    {
      label: () => t("setup.hideLinkRewards"),
      checked: hideLinkRewards,
      onChange: setHideLinkRewards,
      hint: () => t("setup.hideLinkRewardsHint"),
    },
    {
      label: () => t("setup.showGigantifiedEmotes"),
      checked: showGigantifiedEmotes,
      onChange: setShowGigantifiedEmotes,
    },
    {
      label: () => t("setup.showGifs"),
      checked: showGifs,
      onChange: setShowGifs,
      hint: () => t("setup.showGifsHint"),
    },
    {
      label: () => t("setup.showPredictions"),
      checked: showPredictions,
      onChange: setShowPredictions,
      hint: () => t("setup.showPredictionsHint"),
    },
    {
      label: () => t("setup.showCommands"),
      checked: commands,
      onChange: setCommands,
    },
    {
      label: () => t("setup.showUnlistedEmotes"),
      checked: show7tvUnlisted,
      onChange: setShow7tvUnlisted,
    },
  ];


  const ttsToggles: ToggleRow[] = [
    {
      label: () => t("setup.chatIsTts"),
      checked: rteChatIsTts,
      onChange: setRteChatIsTts,
      hint: () => t("setup.chatIsTtsHint"),
    },
    {
      label: () => t("setup.azureTts"),
      checked: rteAzureTts,
      onChange: setRteAzureTts,
      hint: () => t("setup.azureTtsHint"),
    },
  ];

  const rteToggles: ToggleRow[] = [
    {
      label: () => t("setup.rteProxy"),
      checked: rteProxy,
      onChange: setRteProxy,
      hint: () => t("setup.rteProxyHint"),
    },
    {
      label: () => t("setup.rteCosmetics"),
      checked: rteCustomCosmetics,
      onChange: setRteCustomCosmetics,
      hint: () => t("setup.rteCosmeticsHint"),
    },
  ];

  const roleBadgeMergeOptions = [
    {
      label: () => t("setup.streamer"),
      badgeColor: "#e91916",
      checked: ffzBotMixBroadcaster,
      onChange: setFfzBotMixBroadcaster,
    },
    {
      label: () => t("setup.moderator"),
      badgeColor: "#00ad03",
      checked: ffzBotMixModerator,
      onChange: setFfzBotMixModerator,
    },
    {
      label: () => t("setup.vipViewer"),
      badgeColor: "#e005b9",
      checked: ffzBotMixVip,
      onChange: setFfzBotMixVip,
    },
  ];

  const ffzBadgeMergeBlock = (
    <div class="setup-role-merge grid grid-cols-1 gap-3 rounded-lg border border-border bg-black/40 p-3.5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
      <div class="flex min-w-0 flex-col gap-1.5">
        <div class="text-sm font-bold text-foreground">
          {t("setup.botBadgeNearRole")}
        </div>
        <div class="text-xs leading-snug text-muted-foreground">
          {t("setup.botBadgeNearRoleHint")}
        </div>
      </div>
      <div class="setup-role-pills grid grid-cols-1 gap-2 sm:grid-cols-3">
        <For each={roleBadgeMergeOptions}>
          {(option) => {
            const active = () => option.checked();
            const disabled = () => !showFfzBadges() || hideAllBadges();
            return (
              <button
                type="button"
                disabled={disabled()}
                class={cn(
                  "flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors",
                  disabled()
                    ? "cursor-not-allowed text-white/35"
                    : active()
                      ? "text-white hover:bg-[#27272a]"
                      : "text-white/55 hover:bg-[#27272a] hover:text-white/80",
                )}
                onClick={() => option.onChange(!active())}
                aria-pressed={active()}
              >
                <span
                  class={cn(
                    "inline-flex size-[31px] items-center justify-center rounded-lg border p-0.5 transition-[filter,border-color]",
                    active() && !disabled() ? "border-white/70" : "border-white/25",
                    (!active() || disabled()) && "saturate-0",
                  )}
                  style={{ background: option.badgeColor }}
                >
                  <img
                    src={ffzBotBadgePreviewUrl}
                    alt=""
                    class="block size-full object-contain"
                    loading="lazy"
                  />
                </span>
                <span class="text-center leading-tight">
                  {option.label()}
                </span>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
  const badgeProviderRows: Array<{
    toggle: ToggleRow;
    extra?: JSX.Element;
  }> = [
    {
      toggle: {
        label: () => t("setup.showTwitchBadges"),
        checked: showTwitchBadges,
        onChange: setShowTwitchBadges,
        disabled: hideAllBadges,
      },
    },
    {
      toggle: {
        label: () => t("setup.showYouTubeBadges"),
        checked: showYouTubeBadges,
        onChange: setShowYouTubeBadges,
        disabled: hideAllBadges,
      },
    },
    {
      toggle: {
        label: () => t("setup.showKickBadges"),
        checked: showKickBadges,
        onChange: setShowKickBadges,
        disabled: hideAllBadges,
      },
    },
    {
      toggle: {
        label: () => t("setup.showHomiesBadges"),
        checked: showHomies,
        onChange: setShowHomies,
        disabled: hideAllBadges,
      },
    },
    {
      toggle: {
        label: () => t("setup.show7tvBadges"),
        checked: show7tvBadges,
        onChange: setShow7tvBadges,
        disabled: hideAllBadges,
      },
    },
    {
      toggle: {
        label: () => t("setup.showFfzBadges"),
        checked: showFfzBadges,
        onChange: setShowFfzBadges,
        disabled: hideAllBadges,
      },
      extra: ffzBadgeMergeBlock,
    },
    {
      toggle: {
        label: () => t("setup.showBttvBadges"),
        checked: showBttvBadges,
        onChange: setShowBttvBadges,
        disabled: hideAllBadges,
      },
    },
    {
      toggle: {
        label: () => t("setup.showChatterinoBadges"),
        checked: showChatterinoBadges,
        onChange: setShowChatterinoBadges,
        disabled: hideAllBadges,
      },
    },
    {
      toggle: {
        label: () => t("setup.showChatisBadges"),
        checked: showChatisBadges,
        onChange: setShowChatisBadges,
        disabled: hideAllBadges,
      },
    },
    {
      toggle: {
        label: () => t("setup.reyohohoBadge"),
        checked: rteReyohohoBadge,
        onChange: setRteReyohohoBadge,
        hint: () => t("setup.reyohohoBadgeHint"),
        disabled: hideAllBadges,
      },
    },
  ];

  const renderUserChip = (
    login: string,
    remove: (login: string) => void,
    ariaLabel: () => string,
  ) => {
    const profile = () => botProfiles()[login];
    const displayName = () => profile()?.displayName || login;
    const avatarUrl = () => profile()?.avatarUrl || "";

    return (
      <div
        class="inline-flex max-w-full items-center gap-2 rounded-[0.5rem] border border-white/50 bg-[#27272a] px-1.5 py-0.5 text-white"
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
          aria-label={`${ariaLabel()}: ${displayName()}`}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    );
  };

  const chipFieldClass =
    "flex min-h-[72px] w-full flex-wrap content-start items-center gap-1.5 rounded-lg border border-input bg-background p-2";

  return (
    <>
      <Title>ChatYX • {t("common.settings")}</Title>

      <div class="setup-root dark" lang={locale()} data-mobile-view={mobileView()}>
        <div class="setup-shell">
          <a class="setup-skip-link" href={mobileView() === "settings" ? "#setup-settings" : "#setup-preview"}>{t("common.skipToWorkspace")}</a>
          <header class="setup-toolbar">
            <div class="setup-brand">
              <span class="setup-brand-mark" aria-hidden="true"><img src={getPublicAssetUrl("img/emote-2x.webp")} alt="" /></span>
              <div><h1>{t("toolbar.title")}</h1><p>{t("toolbar.description")}</p></div>
            </div>
            <div class="setup-toolbar-actions">
              <LanguageSwitcher />
              <a
                class="setup-report-issue"
                href="https://github.com/Linaryx/ChatYX/issues"
                target="_blank"
                rel="noreferrer"
              >
                <span class="hgi-stroke hgi-alert-02" aria-hidden="true" />
                {t("toolbar.reportIssue")}
              </a>
              <a
                class="setup-toolbar-icon-link"
                href="https://github.com/Linaryx/ChatYX"
                target="_blank"
                rel="noreferrer"
                aria-label={t("toolbar.github")}
              >
                <span class="hgi-stroke hgi-github" aria-hidden="true" />
              </a>
              <a
                class="setup-toolbar-icon-link"
                href="https://ruina.team"
                target="_blank"
                rel="noreferrer"
                aria-label={t("toolbar.ruina")}
              >
                <img src="https://ruina.team/favicon.svg" alt="" />
              </a>
            </div>
          </header>
          <div class="setup-view-switch" role="group" aria-label={t("common.workspace")}>
            <button type="button" aria-pressed={mobileView() === "settings"} aria-controls="setup-settings" onClick={() => selectMobileView("settings")}><SlidersHorizontal size={16} aria-hidden="true" />{t("common.settings")}</button>
            <button type="button" aria-pressed={mobileView() === "preview"} aria-controls="setup-preview" onClick={() => selectMobileView("preview")}><Monitor size={16} aria-hidden="true" />{t("common.preview")}</button>
          </div>
          <main class="setup-body setup-pane-scroll" ref={bodyScrollRef}>
            <div class="setup-source-row">
            <section class="setup-connection" aria-label={t("setup.channelsConnection")}>
              <div class="setup-connection-intro"><h2>{t("setup.connection")}</h2><p>{t("setup.connectionHint")}</p></div>
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
                  YouTube <span>{t("setup.optional")}</span>
                </label>
                <TwitchChannelField
                  inputId="setup-youtube"
                  value={youtubeChannel()}
                  onChange={setYoutubeChannel}
                  placeholder={t("setup.channelOrIdPlaceholder")}
                  platformName="YouTube"
                  platform="youtube"
                  loadSummary={false}
                />
              </div>
              <div class="setup-channel-field">
                <label class="setup-field-label setup-platform-label" for="setup-kick">
                  <img class="setup-platform-logo" src={getPublicAssetUrl("img/platform-kick.svg")} alt="" />
                  Kick <span>{t("setup.optional")}</span>
                </label>
                <TwitchChannelField
                  inputId="setup-kick"
                  value={kickChannel()}
                  onChange={setKickChannel}
                  placeholder={t("setup.channelNamePlaceholder")}
                  platformName="Kick"
                  platform="kick"
                  loadSummary={false}
                />
              </div>
            </section>
            <div class="setup-export">
              <div class="setup-export-link">
                <h2 class="setup-export-title">{t("setup.obsUrl")}</h2>
                <Input id="setup-obs-url" type="text" readonly value={generatedUrl()} placeholder={t("setup.obsUrlPlaceholder")} onFocus={(event) => event.currentTarget.select()} class="setup-url-input" aria-label={t("setup.obsUrl")} />
              </div>
              <div class="setup-export-actions">
                <div class="setup-export-primary-actions">
                  <Button
                    type="button"
                    onClick={copyToClipboard}
                    disabled={!generatedUrl() || copyStatus() === "copying"}
                    class={cn(
                      "setup-export-action setup-url-copy-button",
                      copyStatus() === "success" && "setup-url-copy-button--success",
                    )}
                  >
                    <span class="hgi-stroke hgi-copy-01 setup-export-icon" aria-hidden="true" />
                    {copyStatus() === "success" ? t("setup.copied") : t("setup.copy")}
                  </Button>
                  <Show when={generatedUrl()}><a class="setup-export-action setup-open-link" href={generatedUrl()} target="_blank" rel="noreferrer" aria-label={t("setup.openOverlayNewTab")}><span class="hgi-stroke hgi-link-square-01 setup-export-icon" aria-hidden="true" /><span>{t("setup.open")}</span></a></Show>
                </div>
                <Button type="button" variant="outline" class="setup-export-action setup-reset-button" onClick={resetSettings}>
                  <span class="hgi-stroke hgi-trash setup-export-icon" aria-hidden="true" />
                  {resetPending() ? t("setup.confirm") : t("setup.reset")}
                </Button>
              </div>
            </div>
            </div>
          <div class="setup-workspace">
            <aside class="setup-sidebar setup-pane-scroll">
              <p class="setup-sidebar-caption">{t("setup.overlaySettings")}</p>
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
                <label for="setup-section-picker" class="setup-field-label">{t("setup.settingsSection")}</label>
                <SetupSelect id="setup-section-picker" value={activeSection()} onChange={(event) => scrollToSection(event.currentTarget.value as SetupSectionId)}>
                  <For each={SETUP_NAV}>{(item) => <option value={item.id}>{t(item.labelKey)}</option>}</For>
                </SetupSelect>
              </div>

              <SetupImportCard
                hidden={activeSection() !== "import"}
                onImport={importSettings}
                getCurrentTemplateSettings={() => toVisualSetupPatch(buildConfig(channel().trim()))}
              />

              <SectionCard
                id="setup-section-appearance"
                title={t("setup.appearanceTitle")}
                description={t("setup.appearanceDescription")}
                icon="hgi-text"
                hidden={activeSection() !== "appearance"}
              >
                <div class="setup-field-group"><h3>{t("setup.messageFont")}</h3><ControlRows rows={appearanceRows.slice(0, 3)} /></div>
                <div class="setup-field-group"><h3>{t("setup.weightAndEmotes")}</h3><ControlRows rows={appearanceRows.slice(3)} /></div>
              </SectionCard>

              <SectionCard
                id="setup-section-styling"
                title={t("setup.stylingTitle")}
                description={t("setup.stylingDescription")}
                icon="hgi-colors"
                hidden={activeSection() !== "styling"}
              >
                <div class="setup-field-group"><h3>{t("setup.textReadability")}</h3><ControlRows rows={stylingRows.slice(0, 3)} /></div>
                <div class="setup-field-group"><h3>{t("setup.messageBacking")}</h3><ControlRows rows={stylingRows.slice(3, 6)} /></div>
                <div class="setup-field-group"><h3>{t("setup.colorAccents")}</h3><ControlRows rows={stylingRows.slice(6)} /></div>
                <div class="setup-field-group"><h3>{t("setup.nicknameColor")}</h3>
                  <ToggleRows rows={[{
                    label: () => t("setup.uniformNicknameColor"),
                    hint: () => t("setup.uniformNicknameColorHint"),
                    checked: usersColorEnabled,
                    onChange: setUsersColorEnabled,
                  }]} />
                  <Show when={usersColorEnabled()}>
                    <div class="pt-1">
                      <ColorPickerField label={t("setup.nicknameColor")} color={usersColor()} opacity={100} showOpacity={false} onChange={({ color }) => setUsersColor(color)} />
                    </div>
                  </Show>
                </div>
              </SectionCard>

              <SectionCard
                id="setup-section-behavior"
                title={t("setup.behaviorTitle")}
                description={t("setup.behaviorDescription")}
                icon="hgi-arrow-up-right-stack"
                hidden={activeSection() !== "behavior"}
              >
                <div class="setup-field-group"><h3>{t("setup.animationAndLinks")}</h3><ControlRows rows={behaviorRows} /></div>
                <div class="setup-field-group"><h3>{t("setup.eventStyling")}</h3><ToggleRows rows={behaviorToggles.slice(0, 3)} /></div>
                <div class="setup-field-group"><h3>{t("setup.messageFlow")}</h3><ToggleRows rows={behaviorToggles.slice(3)} /></div>
              </SectionCard>

              <SectionCard
                id="setup-section-content"
                title={t("setup.contentTitle")}
                description={t("setup.contentDescription")}
                icon="hgi-dashboard-square-03"
                hidden={activeSection() !== "content"}
              >
                <div class="setup-field-group"><h3>{t("setup.messagesAndEvents")}</h3><ToggleRows rows={contentToggles} /></div>
                <div class="setup-field-group">
                  <h3>{t("setup.badges")}</h3>
                  <ToggleRows rows={[{
                    label: () => t("setup.hideAllBadges"),
                    checked: hideAllBadges,
                    onChange: setHideAllBadges,
                    hint: () => t("setup.hideAllBadgesHint"),
                  }]} />
                  <For each={badgeProviderRows}>
                    {(row) => (
                      <>
                        <ToggleRows rows={[row.toggle]} />
                        {row.extra}
                      </>
                    )}
                  </For>
                </div>
              </SectionCard>

              <SectionCard
                id="setup-section-bots"
                title={t("setup.botsTitle")}
                description={t("setup.botsDescription")}
                icon="hgi-bot-message-square"
                hidden={activeSection() !== "bots"}
              >
                <div class="setup-bot-row flex flex-col gap-2">
                  <div>
                    <SetupSwitch
                      checked={!bots()}
                      onChange={(hideBots) => setBots(!hideBots)}
                       label={t("setup.hideBots")}
                    />
                  </div>
                  <div class="text-xs font-medium text-foreground sm:text-sm">
                     {t("setup.botNicknames")}
                  </div>
                  <div class={chipFieldClass}>
                    <For each={botNames()}>
                      {(login) =>
                        renderUserChip(
                          login,
                          removeBotName,
                          () => t("setup.removeBot"),
                        )
                      }
                    </For>
                    <input
                       aria-label={t("setup.addBot")}
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
                       placeholder={t("setup.nicknamePlaceholder")}
                      class="h-[34px] min-w-[150px] flex-1 border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                <div class="setup-control-row flex flex-col gap-2">
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <div class="text-xs font-medium text-foreground sm:text-sm">
                       {t("setup.onlyTheseViewers")}
                    </div>
                    <div class="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                       {t("setup.onlyTheseViewersHint")}
                    </div>
                  </div>
                  <div class={chipFieldClass}>
                    <For each={allowedChatters()}>
                      {(login) =>
                        renderUserChip(
                          login,
                          removeAllowedChatter,
                          () => t("setup.removeViewer"),
                        )
                      }
                    </For>
                    <input
                       aria-label={t("setup.addViewer")}
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
                       placeholder={t("setup.nicknamePlaceholder")}
                      class="h-[34px] min-w-[150px] flex-1 border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                id="setup-section-tts"
                title={t("setup.ttsTitle")}
                description={t("setup.ttsDescription")}
                icon="hgi-voice-comment"
                hidden={activeSection() !== "tts"}
              >
                <ToggleRows rows={ttsToggles} />
                <VoiceCatalog />
              </SectionCard>

              <SectionCard
                id="setup-section-rte"
                title={t("setup.rteTitle")}
                description={t("setup.rteDescription")}
                icon="hgi-blockchain-05"
                hidden={activeSection() !== "rte"}
              >
                <ToggleRows rows={rteToggles} />
              </SectionCard>
            </div>

            <div id="setup-preview" tabIndex={-1} class="setup-preview-pane setup-pane-scroll min-h-0 min-w-0 overflow-y-auto overscroll-contain min-[1100px]:h-full">
              <div class="flex min-h-0 flex-col gap-2 pb-2 min-[1100px]:h-full min-[1100px]:pb-0">
                <SectionCard
                  title={t("setup.previewTitle")}
                  compact
                  class="setup-preview-section min-[1100px]:flex min-[1100px]:min-h-0 min-[1100px]:flex-1 min-[1100px]:flex-col"
                >
                  <div class="setup-preview-content">
                    <div class="setup-preview-options">
                      <div
                        class="setup-preview-controls"
                        ref={(element) => (previewControlsRef = element)}
                      >
                        <div class="setup-preview-control-panel">
                           <div class="setup-preview-control-title">{t("setup.demoBackgroundColor")}</div>
                          <div
                            class="setup-stage-switcher"
                            role="group"
                             aria-label={t("setup.previewBackground")}
                          >
                            <button
                              type="button"
                              class={cn("setup-stage-option", stageBackdrop() === "dark" && "setup-stage-option--active")}
                              aria-pressed={stageBackdrop() === "dark"}
                               aria-label={t("setup.blackBackground")}
                              onClick={() => setStageBackdrop("dark")}
                            >
                              <span class="setup-stage-swatch setup-stage-swatch--dark" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              class={cn("setup-stage-option", stageBackdrop() === "light" && "setup-stage-option--active")}
                              aria-pressed={stageBackdrop() === "light"}
                               aria-label={t("setup.whiteBackground")}
                              onClick={() => setStageBackdrop("light")}
                            >
                              <span class="setup-stage-swatch setup-stage-swatch--light" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              class={cn("setup-stage-option", stageBackdrop() === "checker" && "setup-stage-option--active")}
                              aria-pressed={stageBackdrop() === "checker"}
                               aria-label={t("setup.checkerBackground")}
                              onClick={() => setStageBackdrop("checker")}
                            >
                              <span class="setup-stage-swatch setup-stage-swatch--checker" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              class={cn("setup-stage-option", stageBackdrop() === "custom" && "setup-stage-option--active")}
                              aria-pressed={stageBackdrop() === "custom"}
                               aria-label={t("setup.customBackgroundColor")}
                              onClick={() => setStageBackdrop("custom")}
                            >
                              <span class="setup-stage-swatch" style={`background-color: ${stageColor()}`} aria-hidden="true" />
                            </button>
                          </div>
                          <Show when={stageBackdrop() === "custom"}>
                            <div class="setup-stage-color">
                              <ColorPickerField
                                color={stageColor()}
                                opacity={100}
                                showOpacity={false}
                                showTransparencyGrid={false}
                                 label={t("setup.backgroundColor")}
                                onChange={(value) => setStageColor(value.color)}
                              />
                            </div>
                          </Show>
                        </div>
                        <div class="setup-preview-control-panel">
                           <div class="setup-preview-control-title">{t("setup.previewSettings")}</div>
                          <div class="setup-preview-setting-grid">
                            <div class="setup-preview-setting">
                               <div class="setup-preview-setting-title">{t("setup.chatMode")}</div>
                              <div
                                class="setup-preview-selector"
                                ref={(element) => (previewModeSelectorRef = element)}
                                role="radiogroup"
                                 aria-label={t("setup.previewChatMode")}
                              >
                                <div
                                  class="setup-selection-thumb"
                                  aria-hidden="true"
                                  style={previewModeThumbStyle()}
                                />
                                <button
                                  type="button"
                                  role="radio"
                                  ref={(element) => (previewLiveOptionRef = element)}
                                  disabled={!hasPreviewChannel()}
                                  aria-checked={previewMode() === "live"}
                                  class={cn("setup-preview-selector-option", previewMode() === "live" && "setup-preview-selector-option--selected")}
                                  onClick={() => setPreviewMode("live")}
                                >
                                  <span class="hgi-stroke hgi-live-streaming-02 setup-preview-selector-icon" aria-hidden="true" />
                                   <span>{t("setup.channelChat")}</span>
                                </button>
                                <Show when={!isExternalOnly()}>
                                  <button
                                    type="button"
                                    role="radio"
                                    ref={(element) => (previewDemoOptionRef = element)}
                                    aria-checked={previewMode() === "demo"}
                                    class={cn("setup-preview-selector-option", previewMode() === "demo" && "setup-preview-selector-option--selected")}
                                    onClick={() => setPreviewMode("demo")}
                                  >
                                    <span class="hgi-stroke hgi-test-tube-01 setup-preview-selector-icon" aria-hidden="true" />
                                     <span>{t("setup.demo")}</span>
                                  </button>
                                </Show>
                              </div>
                            </div>
                            <Show when={!isExternalOnly()}>
                              <div class="setup-preview-setting">
                                 <div class="setup-preview-setting-title">{t("setup.demoScenario")}</div>
                                <div
                                  class={cn(
                                    "setup-preview-selector",
                                    previewMode() !== "demo" && "setup-preview-selector--disabled",
                                  )}
                                  ref={(element) => (previewDemoSelectorRef = element)}
                                  role="radiogroup"
                                 aria-label={t("setup.demoScenario")}
                                >
                                  <div
                                    class="setup-selection-thumb"
                                    aria-hidden="true"
                                    style={previewDemoThumbStyle()}
                                  />
                                  <button
                                    type="button"
                                    role="radio"
                                    ref={(element) => (previewPastaOptionRef = element)}
                                    disabled={previewMode() !== "demo"}
                                    aria-checked={previewDemoKind() === "pasta"}
                                    class={cn("setup-preview-selector-option", previewDemoKind() === "pasta" && "setup-preview-selector-option--selected")}
                                    onClick={() => setPreviewDemoKind("pasta")}
                                  >
                                    <span class="hgi-stroke hgi-message-square-more setup-preview-selector-icon" aria-hidden="true" />
                                     <span>{t("setup.messages")}</span>
                                  </button>
                                  <button
                                    type="button"
                                    role="radio"
                                    ref={(element) => (previewEmoteOptionRef = element)}
                                    disabled={previewMode() !== "demo"}
                                    aria-checked={previewDemoKind() === "emote"}
                                    class={cn("setup-preview-selector-option", previewDemoKind() === "emote" && "setup-preview-selector-option--selected")}
                                    onClick={() => setPreviewDemoKind("emote")}
                                  >
                                    <span class="hgi-stroke hgi-rubber-duck setup-preview-selector-icon" aria-hidden="true" />
                                     <span>{t("setup.emotes")}</span>
                                  </button>
                                </div>
                              </div>
                            </Show>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Show when={previewMode() === "demo"}>
                      <div class="setup-preview-playback">
                        <div class="setup-preview-speed">
                          <span class="text-xs font-medium sm:text-sm">
                             {t("setup.speed")}
                          </span>
                          <Slider
                             aria-label={t("setup.messageSpeed")}
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
                           {demoPaused() ? t("setup.resume") : t("setup.pause")}
                        </button>
                      </div>
                    </Show>

                    <div
                      class="setup-preview-frame relative isolate h-[clamp(180px,36dvh,320px)] w-full shrink-0 overflow-hidden min-[1100px]:h-auto min-[1100px]:flex-1 min-[1100px]:min-h-[min(180px,36dvh)]"
                      style={previewFrameStyle()}
                    >
                      <iframe
                        ref={iframeRef}
                        src={previewUrl()}
                        onLoad={() => postPreviewConfig()}
                        class="pointer-events-none block h-full w-full border-0 bg-transparent"
                         title={t("setup.chatPreview")}
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
