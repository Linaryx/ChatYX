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
import { PlatformGlyph } from "~/components/brand/PlatformGlyph";
import { ColorPickerField } from "~/components/setup/ColorPickerField";
import { LanguageSwitcher } from "~/components/setup/LanguageSwitcher";
import { locale, t } from "~/i18n";
import {
  ControlRows,
  SectionCard,
  SETUP_NAV,
  SetupNav,
  ToggleRows,
  type ControlRow,
  type ToggleRow,
} from "~/components/setup/SetupLayout";
import type { SetupSectionId } from "~/features/setup/model/setupSections";
import { VoiceCatalog } from "~/components/setup/VoiceCatalog";
import { SetupImportCard } from "~/components/setup/SetupImportCard";
import { SetupChipInput } from "~/components/setup/SetupChipInput";
import { UserChip } from "~/components/setup/UserChip";
import { FfzBadgeMergeBlock } from "~/components/setup/FfzBadgeMergeBlock";
import { PreviewControls } from "~/components/setup/PreviewControls";
import { createAppearanceRows } from "~/components/setup/sections/appearanceRows";
import { createStylingRows } from "~/components/setup/sections/stylingRows";
import {
  createBehaviorRows,
  createBehaviorToggles,
} from "~/components/setup/sections/behaviorRows";
import {
  createContentToggles,
  createRteToggles,
  createTtsToggles,
} from "~/components/setup/sections/toggleRows";
import { parseSetupImport } from "~/config/setupImport";
import { toVisualSetupPatch } from "~/config/setupTemplates";
import { applySetupImport } from "~/components/setup/setupImportAdapter";
import {
  SETUP_STORAGE_KEYS,
  readStoredSetupValue,
  writeStoredSetupValue,
} from "~/services/storage/setupStorage";
import {
  loadKickBotProfiles,
  loadTwitchBotProfiles,
  type BotProfile,
} from "~/services/setup/botProfiles";
import { mergeUniqueLogins } from "~/services/setup/logins";
import {
  detectLocalFontBrowser,
  loadLocalFontOptions,
  type LocalFontOption,
} from "~/services/setup/localFonts";
import { toClampedInt, toInt } from "~/config/formValues";
import {
  buildOverlayUrl,
  buildSetupConfig,
  type SetupFormState,
} from "~/config/setupConfig";
import { SetupSelect } from "~/components/setup/SetupSelect";
import { SetupSwitch } from "~/components/setup/SetupSwitch";
import { TwitchChannelField } from "~/components/setup/TwitchChannelField";
import { Button } from "~/components/ui/button";
import { Icon } from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import {
  DEFAULT_EVENT_COLORS,
  normalizeEventColor,
  type EventColorConfig,
  type EventColorField,
} from "~/config/eventColors";
import {
  DEFAULT_CHAT_CONFIG,
  chatConfigToSearchParams,
  parseBotNames,
  type ChatAnimationMode,
  type LinkDisplayMode,
  type PlatformMarkerMode,
} from "~/config/chatUrlParams";
import { getPublicAssetUrl } from "~/utils/appBase";
import {
  MAX_MESSAGE_SPEED,
  MIN_MESSAGE_SPEED,
  messageSpeedToIntervalMs,
} from "~/config/chatAnimation";
import { getChatPreviewSessionKey } from "~/services/chat/preview";
import { createPreviewSynchronizer } from "~/features/setup/previewSync";
import {
  lockSetupDocument,
  watchReducedMotion,
} from "~/features/setup/setupDocument";
import { cn } from "~/lib/utils";
import {
  collectSetupSearchHits,
  formatSetupSearchCounter,
  highlightSetupSearchHits,
  revealSetupSearchHit,
  MIN_SETUP_SEARCH_LENGTH,
  type SetupSearchHit,
} from "~/features/setup/settingsSearch";
import Alert02Icon from "@hugeicons/core-free-icons/Alert02Icon";
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import ArrowUpRightStackIcon from "@hugeicons/core-free-icons/ArrowUpRightStackIcon";
import Blockchain05Icon from "@hugeicons/core-free-icons/Blockchain05Icon";
import BotMessageSquareIcon from "@hugeicons/core-free-icons/BotMessageSquareIcon";
import ColorsIcon from "@hugeicons/core-free-icons/ColorsIcon";
import Copy01Icon from "@hugeicons/core-free-icons/Copy01Icon";
import DashboardSquare03Icon from "@hugeicons/core-free-icons/DashboardSquare03Icon";
import GithubIcon from "@hugeicons/core-free-icons/GithubIcon";
import LinkSquare01Icon from "@hugeicons/core-free-icons/LinkSquare01Icon";
import MonitorIcon from "@hugeicons/core-free-icons/MonitorIcon";
import SearchingIcon from "@hugeicons/core-free-icons/SearchingIcon";
import SlidersHorizontalIcon from "@hugeicons/core-free-icons/SlidersHorizontalIcon";
import TextIcon from "@hugeicons/core-free-icons/TextIcon";
import TrashIcon from "@hugeicons/core-free-icons/TrashIcon";
import VoiceCommentIcon from "@hugeicons/core-free-icons/VoiceCommentIcon";
import XIcon from "@hugeicons/core-free-icons/XIcon";

const eventColorPalette: ReadonlyArray<{
  readonly field: EventColorField;
  readonly label: () => string;
}> = [
  { field: "eventColorDefault", label: () => t("setup.eventColorDefault") },
  { field: "eventColorFirst", label: () => t("setup.eventColorFirst") },
  { field: "eventColorHighlight", label: () => t("setup.eventColorHighlight") },
  { field: "eventColorReward", label: () => t("setup.eventColorReward") },
  { field: "eventColorSubscription", label: () => t("setup.eventColorSubscription") },
  { field: "eventColorRaid", label: () => t("setup.eventColorRaid") },
  { field: "eventColorStreak", label: () => t("setup.eventColorStreak") },
  { field: "eventColorPowerUp", label: () => t("setup.eventColorPowerUp") },
  { field: "eventColorAnnPrimary", label: () => t("setup.eventColorAnnPrimary") },
  { field: "eventColorAnnPurple", label: () => t("setup.eventColorAnnPurple") },
  { field: "eventColorAnnBlue", label: () => t("setup.eventColorAnnBlue") },
  { field: "eventColorAnnGreen", label: () => t("setup.eventColorAnnGreen") },
  { field: "eventColorAnnOrange", label: () => t("setup.eventColorAnnOrange") },
];

import "~/components/setup/SetupWorkspace.css";

type LocalFontStatus =
  | { kind: "idle" }
  | { kind: "available"; browser: string }
  | { kind: "unsupported" }
  | { kind: "loading" }
  | { kind: "found"; count: number }
  | { kind: "empty" }
  | { kind: "error" };

/** YouTube bot entries have no profile lookup, so their chips show the login. */
const EMPTY_BOT_PROFILES = (): Record<string, BotProfile> => ({});

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
  const [gigantifiedEmoteScale, setGigantifiedEmoteScale] = createSignal(
    String(DEFAULT_CHAT_CONFIG.gigantifiedEmoteScale),
  );
  const [botNames, setBotNames] = createSignal<string[]>(
    parseBotNames(DEFAULT_CHAT_CONFIG.botNames),
  );
  const [botInput, setBotInput] = createSignal("");
  const [youtubeBotNames, setYoutubeBotNames] = createSignal<string[]>(
    parseBotNames(DEFAULT_CHAT_CONFIG.youtubeBotNames),
  );
  const [youtubeBotInput, setYoutubeBotInput] = createSignal("");
  const [kickBotNames, setKickBotNames] = createSignal<string[]>(
    parseBotNames(DEFAULT_CHAT_CONFIG.kickBotNames),
  );
  const [kickBotInput, setKickBotInput] = createSignal("");
  const [botProfiles, setBotProfiles] = createSignal<
    Record<string, BotProfile>
  >({});
  const [kickBotProfiles, setKickBotProfiles] = createSignal<
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
  const [overlayBorderWidth, setOverlayBorderWidth] = createSignal(
    String(DEFAULT_CHAT_CONFIG.overlayBorderWidth),
  );
  const [overlayBorderColor, setOverlayBorderColor] = createSignal(
    DEFAULT_CHAT_CONFIG.overlayBorderColor,
  );
  const borderColorOpacity = createMemo(() => {
    const alpha = overlayBorderColor().slice(7);
    return /^[0-9a-f]{2}$/i.test(alpha)
      ? Math.round(Number.parseInt(alpha, 16) / 2.55)
      : 100;
  });
  const [highlightTwitchEvents, setHighlightTwitchEvents] = createSignal(
    DEFAULT_CHAT_CONFIG.highlightTwitchEvents,
  );
  const [eventColors, setEventColors] = createSignal<EventColorConfig>(
    DEFAULT_EVENT_COLORS,
  );
  const [eventColorOpacity, setEventColorOpacity] = createSignal(
    String(DEFAULT_CHAT_CONFIG.eventColorOpacity),
  );
  const setEventColor = (field: EventColorField, color: string) => {
    setEventColors((colors) => ({
      ...colors,
      [field]: normalizeEventColor(color, colors[field]),
    }));
  };
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
  const [showPredictionsOnlyWhileActive, setShowPredictionsOnlyWhileActive] = createSignal(
    DEFAULT_CHAT_CONFIG.showPredictionsOnlyWhileActive,
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
  let copyResetTimer: number | undefined;

  const previewSync = createPreviewSynchronizer({
    getIframe: () => iframeRef,
    setFallbackUrl: setPreviewUrl,
  });

  onMount(() => {
    const releaseDocumentLock = lockSetupDocument();
    const stopMotionWatch = watchReducedMotion((matches) => {
      setReducedMotion(matches);
      if (matches) setDemoPaused(true);
    });

    const supportedBrowser = detectLocalFontBrowser();
    if (supportedBrowser) {
      setLocalFontBrowser(supportedBrowser);
      setLocalFontStatus({ kind: "available", browser: supportedBrowser });
    }

    onCleanup(() => {
      previewSync.dispose();
      stopMotionWatch();
      releaseDocumentLock();
    });
  });

const [activeSection, setActiveSection] =
    createSignal<SetupSectionId>("appearance");
  const [setupSearch, setSetupSearch] = createSignal("");
  const [setupSearchIndex, setSetupSearchIndex] = createSignal(0);
  const setupSearchQuery = createMemo(() => setupSearch().trim());
  const setupSearchHits = createMemo(() => {
    const query = setupSearchQuery();
    if (query.length < MIN_SETUP_SEARCH_LENGTH) return [] as SetupSearchHit[];
    return collectSetupSearchHits(query);
  });
  const matchedSearchSections = createMemo(() => new Set(
    setupSearchHits().flatMap((hit) => (hit.sectionId ? [hit.sectionId] : [])),
  ));
  const setupSearchCounter = createMemo(() =>
    formatSetupSearchCounter(setupSearchIndex(), setupSearchHits().length),
  );
  const focusSearchResult = (index: number) => {
    const hits = setupSearchHits();
    if (hits.length === 0) return;
    const next = (index + hits.length) % hits.length;
    setSetupSearchIndex(next);
    revealSetupSearchHit(hits[next]!, scrollToSection);
  };
  let previousSearchQuery = "";
  createEffect(() => {
    const hits = setupSearchHits();
    highlightSetupSearchHits(hits);
    const query = setupSearchQuery();
    if (query === previousSearchQuery) return;
    previousSearchQuery = query;
    setSetupSearchIndex(0);
    if (hits.length > 0) focusSearchResult(0);
  });

  const importSettings = (patch: Parameters<typeof applySetupImport>[0]) => {
    applySetupImport(patch, {
      channel: setChannel,
      youtubeChannel: setYoutubeChannel,
      kickChannel: setKickChannel,
      platformMarker: setPlatformMarker,
      showGifs: setShowGifs,
      gifScale: setGifScale,
      gigantifiedEmoteScale: setGigantifiedEmoteScale,
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
      kickBotNames: setKickBotNames,
      youtubeBotNames: setYoutubeBotNames,
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
      overlayBorderWidth: setOverlayBorderWidth,
      overlayBorderColor: setOverlayBorderColor,
      highlightTwitchEvents: setHighlightTwitchEvents,
      eventColorOpacity: setEventColorOpacity,
      eventColorDefault: (value) => setEventColor("eventColorDefault", value),
      eventColorFirst: (value) => setEventColor("eventColorFirst", value),
      eventColorHighlight: (value) => setEventColor("eventColorHighlight", value),
      eventColorReward: (value) => setEventColor("eventColorReward", value),
      eventColorSubscription: (value) => setEventColor("eventColorSubscription", value),
      eventColorRaid: (value) => setEventColor("eventColorRaid", value),
      eventColorStreak: (value) => setEventColor("eventColorStreak", value),
      eventColorPowerUp: (value) => setEventColor("eventColorPowerUp", value),
      eventColorAnnPrimary: (value) => setEventColor("eventColorAnnPrimary", value),
      eventColorAnnPurple: (value) => setEventColor("eventColorAnnPurple", value),
      eventColorAnnBlue: (value) => setEventColor("eventColorAnnBlue", value),
      eventColorAnnGreen: (value) => setEventColor("eventColorAnnGreen", value),
      eventColorAnnOrange: (value) => setEventColor("eventColorAnnOrange", value),
      twitchEventBold: setTwitchEventBold,
      twitchEventItalic: setTwitchEventItalic,
      showPredictions: setShowPredictions,
      showPredictionsOnlyWhileActive: setShowPredictionsOnlyWhileActive,
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

  const previewFrameStyle = createMemo(() => {
    const radius = toClampedInt(
      overlayBackgroundRadius(),
      DEFAULT_CHAT_CONFIG.overlayBackgroundRadius,
      0,
      128,
    );
    return `${previewStageStyle()} border-radius: ${radius}px;`;
  });

  const formState = (): SetupFormState => ({
    youtubeChannel: youtubeChannel(),
    kickChannel: kickChannel(),
    size: size(),
    font: font(),
    lineHeight: lineHeight(),
    fontWeight: fontWeight(),
    nickFontWeight: nickFontWeight(),
    fontCustom: fontCustom(),
    shadow: shadow(),
    stroke: stroke(),
    fade: fade(),
    animation: animation(),
    messageSpeed: messageSpeed(),
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
    emoteScale: emoteScale(),
    showGifs: showGifs(),
    gifScale: gifScale(),
    gigantifiedEmoteScale: gigantifiedEmoteScale(),
    botNames: botNames(),
    kickBotNames: kickBotNames(),
    youtubeBotNames: youtubeBotNames(),
    allowedChatters: allowedChatters(),
    show7tvUnlisted: show7tvUnlisted(),
    smallCaps: smallCaps(),
    nlAfterName: nlAfterName(),
    hideNames: hideNames(),
    reverseLineOrder: reverseLineOrder(),
    horizontal: horizontal(),
    platformMarker: platformMarker(),
    ffzBotMixBroadcaster: ffzBotMixBroadcaster(),
    ffzBotMixModerator: ffzBotMixModerator(),
    ffzBotMixVip: ffzBotMixVip(),
    overlayBackgroundColor: overlayBackgroundColor(),
    overlayBackgroundOpacity: overlayBackgroundOpacity(),
    overlayBackgroundRadius: overlayBackgroundRadius(),
    overlayPadding: overlayPadding(),
    overlayBorderWidth: overlayBorderWidth(),
    overlayBorderColor: overlayBorderColor(),
    highlightTwitchEvents: highlightTwitchEvents(),
    eventColorOpacity: eventColorOpacity(),
    eventColors: eventColors(),
    twitchEventBold: twitchEventBold(),
    twitchEventItalic: twitchEventItalic(),
    showHighlightedMessages: showHighlightedMessages(),
    showChannelPointRewards: showChannelPointRewards(),
    showGigantifiedEmotes: showGigantifiedEmotes(),
    showPredictions: showPredictions(),
    showPredictionsOnlyWhileActive: showPredictionsOnlyWhileActive(),
    linkMode: linkMode(),
    linkColor: linkColor(),
    usersColorEnabled: usersColorEnabled(),
    usersColor: usersColor(),
    hideLinkRewards: hideLinkRewards(),
    rteProxy: rteProxy(),
    rteAzureTts: rteAzureTts(),
    rteChatIsTts: rteChatIsTts(),
    rteReyohohoBadge: rteReyohohoBadge(),
    rteCustomCosmetics: rteCustomCosmetics(),
  });

  /**
   * The preview, the persisted config and the exported link all project the same
   * form; only the channel differs between them.
   */
  const buildConfig = (selectedChannel: string) =>
    buildSetupConfig(formState(), selectedChannel);

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

  const hasTwitchChannel = createMemo(() => Boolean(channel().trim()));
  const hasYouTubeChannel = createMemo(() => Boolean(youtubeChannel().trim()));
  const hasKickChannel = createMemo(() => Boolean(kickChannel().trim()));
  const isExternalOnly = createMemo(
    () => (hasYouTubeChannel() || hasKickChannel()) && !hasTwitchChannel(),
  );
  const hasPreviewChannel = createMemo(
    () => hasTwitchChannel() || hasYouTubeChannel() || hasKickChannel(),
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
    messageIntervalMs() === null
      ? t("setup.speedStopped")
      : `${messageIntervalMs()} ${t("setup.milliseconds")}`,
  );
  const requestedBotProfiles = new Set<string>();
  const requestedKickBotProfiles = new Set<string>();

  const addBotNames = (raw: string) => {
    setBotNames((current) => mergeUniqueLogins(current, raw));
  };

  const addYouTubeBotNames = (raw: string) => {
    setYoutubeBotNames((current) => mergeUniqueLogins(current, raw));
  };

  const addKickBotNames = (raw: string) => {
    setKickBotNames((current) => mergeUniqueLogins(current, raw));
  };

  const addAllowedChatters = (raw: string) => {
    setAllowedChatters((current) => mergeUniqueLogins(current, raw));
  };

  const removeBotName = (login: string) => {
    setBotNames((current) => current.filter((entry) => entry !== login));
  };

  const removeYouTubeBotName = (login: string) => {
    setYoutubeBotNames((current) => current.filter((entry) => entry !== login));
  };

  const removeKickBotName = (login: string) => {
    setKickBotNames((current) => current.filter((entry) => entry !== login));
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

  const handleYouTubeBotInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addYouTubeBotNames(youtubeBotInput());
      setYoutubeBotInput("");
      return;
    }

    if (event.key === "Backspace" && youtubeBotInput().trim() === "") {
      setYoutubeBotNames((current) => current.slice(0, -1));
    }
  };

  const handleKickBotInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addKickBotNames(kickBotInput());
      setKickBotInput("");
      return;
    }

    if (event.key === "Backspace" && kickBotInput().trim() === "") {
      setKickBotNames((current) => current.slice(0, -1));
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

    void loadTwitchBotProfiles(missing).then((profiles) => {
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
    const missing = Array.from(new Set(kickBotNames())).filter(
      (login) =>
        !kickBotProfiles()[login] && !requestedKickBotProfiles.has(login),
    );
    if (missing.length === 0) return;

    for (const login of missing) {
      requestedKickBotProfiles.add(login);
    }

    void loadKickBotProfiles(missing).then((profiles) => {
      if (profiles.length === 0) return;

      setKickBotProfiles((current) => {
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
      buildOverlayUrl(buildConfig(currentChannel), undefined, {
        includeMessageSpeed: false,
      }),
    );
  });

  createEffect(() => {
    const cfg = previewConfig(); // read synchronously so SolidJS tracks the dependency
    const mode = previewMode();
    const demoKind = previewDemoKind();
    const sessionKey = getChatPreviewSessionKey(cfg, mode, demoKind);

    previewSync.scheduleNavigation(sessionKey, () =>
      buildOverlayUrl(
        cfg,
        mode === "demo"
          ? {
              preview: "true",
              demo: demoKind,
            }
          : {
              preview: "false",
            },
      ),
    );
  });

  onCleanup(() => {
    previewSync.dispose();
    if (copyResetTimer !== undefined) {
      window.clearTimeout(copyResetTimer);
    }
  });

  createEffect(() => {
    previewSync.postConfig(previewConfig());
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
      botNames: parseBotNames(DEFAULT_CHAT_CONFIG.botNames),
      youtubeBotNames: parseBotNames(DEFAULT_CHAT_CONFIG.youtubeBotNames),
      kickBotNames: parseBotNames(DEFAULT_CHAT_CONFIG.kickBotNames),
      singleChatter: parseBotNames(DEFAULT_CHAT_CONFIG.singleChatter),
    });
    setUsersColorEnabled(false);
    setBotInput("");
    setYoutubeBotInput("");
    setKickBotInput("");
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
    if (!localFontBrowser()) {
      setLocalFontStatus({ kind: "unsupported" });
      return;
    }

    setIsLoadingLocalFonts(true);
    setLocalFontStatus({ kind: "loading" });

    const result = await loadLocalFontOptions();
    if (result.kind === "found") {
      setLocalFonts(result.fonts);
      setLocalFontStatus({ kind: "found", count: result.fonts.length });
    } else if (result.kind === "empty") {
      setLocalFontStatus({ kind: "empty" });
    } else if (result.kind === "unsupported") {
      setLocalFontStatus({ kind: "unsupported" });
    } else {
      setLocalFontStatus({ kind: "error" });
    }

    setIsLoadingLocalFonts(false);
  };

  const appearanceRows = createAppearanceRows({
    size,
    setSize,
    font,
    setFont,
    fontCustom,
    setFontCustom,
    localFontBrowser,
    localFonts,
    localFontStatusText,
    isLoadingLocalFonts,
    loadLocalFonts,
    lineHeight,
    setLineHeight,
    fontWeight,
    setFontWeight,
    nickFontWeight,
    setNickFontWeight,
    emoteScale,
    setEmoteScale,
    gifScale,
    setGifScale,
    gigantifiedEmoteScale,
    setGigantifiedEmoteScale,
  });

  const stylingRows = createStylingRows({
    shadow,
    setShadow,
    stroke,
    setStroke,
    fade,
    setFade,
    overlayBackgroundColor,
    setOverlayBackgroundColor,
    overlayBackgroundOpacity,
    setOverlayBackgroundOpacity,
    overlayBackgroundRadius,
    setOverlayBackgroundRadius,
    overlayPadding,
    setOverlayPadding,
    overlayBorderWidth,
    setOverlayBorderWidth,
  });

  const linkColorRow: ControlRow = {
    label: () => t("setup.linkColor"),
    control: (_labelId) => (
      <ColorPickerField
        label={t("setup.linkColor")}
        color={linkColor()}
        opacity={100}
        showOpacity={false}
        onChange={({ color }) => setLinkColor(color)}
      />
    ),
  };

  const messageSourceRow: ControlRow = {
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
  };

  const behaviorRows = createBehaviorRows({ animation, setAnimation, linkMode, setLinkMode });

  const behaviorToggles = createBehaviorToggles({
    twitchEventBold,
    setTwitchEventBold,
    twitchEventItalic,
    setTwitchEventItalic,
    recentMessages,
    setRecentMessages,
    smallCaps,
    setSmallCaps,
    nlAfterName,
    setNlAfterName,
    hideNames,
    setHideNames,
    reverseLineOrder,
    setReverseLineOrder,
    horizontal,
    setHorizontal,
  });

  const contentToggles = createContentToggles({
    showHighlightedMessages,
    setShowHighlightedMessages,
    showChannelPointRewards,
    setShowChannelPointRewards,
    hideLinkRewards,
    setHideLinkRewards,
    showGigantifiedEmotes,
    setShowGigantifiedEmotes,
    showGifs,
    setShowGifs,
    showPredictions,
    setShowPredictions,
    showPredictionsOnlyWhileActive,
    setShowPredictionsOnlyWhileActive,
    commands,
    setCommands,
    show7tvUnlisted,
    setShow7tvUnlisted,
  });


  const ttsToggles = createTtsToggles({
    rteChatIsTts,
    setRteChatIsTts,
    rteAzureTts,
    setRteAzureTts,
  });

  const rteToggles = createRteToggles({
    rteProxy,
    setRteProxy,
    rteCustomCosmetics,
    setRteCustomCosmetics,
  });

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
      extra: (
        <FfzBadgeMergeBlock
          options={roleBadgeMergeOptions}
          disabled={!showFfzBadges() || hideAllBadges()}
        />
      ),
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
                <Icon icon={Alert02Icon} aria-hidden="true" />
                {t("toolbar.reportIssue")}
              </a>
              <a
                class="setup-toolbar-icon-link"
                href="https://github.com/Linaryx/ChatYX"
                target="_blank"
                rel="noreferrer"
                aria-label={t("toolbar.github")}
              >
                <Icon icon={GithubIcon} aria-hidden="true" />
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
            <button type="button" aria-pressed={mobileView() === "settings"} aria-controls="setup-settings" onClick={() => selectMobileView("settings")}><Icon icon={SlidersHorizontalIcon} size={16} aria-hidden="true" />{t("common.settings")}</button>
            <button type="button" aria-pressed={mobileView() === "preview"} aria-controls="setup-preview" onClick={() => selectMobileView("preview")}><Icon icon={MonitorIcon} size={16} aria-hidden="true" />{t("common.preview")}</button>
          </div>
          <main class="setup-body setup-pane-scroll" ref={bodyScrollRef}>
            <div class="setup-source-row">
            <section class="setup-connection" aria-label={t("setup.channelsConnection")}>
              <div class="setup-connection-intro"><h2>{t("setup.connection")}</h2><p>{t("setup.connectionHint")}</p></div>
              <div class="setup-channel-field">
                <label class="setup-field-label setup-platform-label" for="setup-twitch">
                  <PlatformGlyph
                    name="twitch"
                    class="setup-platform-logo setup-platform-logo--twitch"
                  />
                  Twitch
                </label>
                <TwitchChannelField inputId="setup-twitch" value={channel()} onChange={setChannel} />
              </div>
              <div class="setup-channel-field">
                <label class="setup-field-label setup-platform-label" for="setup-youtube">
                  <PlatformGlyph
                    name="youtube"
                    class="setup-platform-logo setup-platform-logo--youtube"
                  />
                  YouTube
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
                  Kick
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
                    <Icon icon={Copy01Icon} class="setup-export-icon" aria-hidden="true" />
                    {copyStatus() === "success" ? t("setup.copied") : t("setup.copy")}
                  </Button>
                  <Show when={generatedUrl()}><a class="setup-export-action setup-open-link" href={generatedUrl()} target="_blank" rel="noreferrer" aria-label={t("setup.openOverlayNewTab")}><Icon icon={LinkSquare01Icon} class="setup-export-icon" aria-hidden="true" /><span>{t("setup.open")}</span></a></Show>
                </div>
                <Button type="button" variant="outline" class="setup-export-action setup-reset-button" onClick={resetSettings}>
                  <Icon icon={TrashIcon} class="setup-export-icon" aria-hidden="true" />
                  {resetPending() ? t("setup.confirm") : t("setup.reset")}
                </Button>
              </div>
            </div>
            </div>
          <div class="setup-workspace">
            <aside class="setup-sidebar setup-pane-scroll">
              <p class="setup-sidebar-caption">{t("setup.overlaySettings")}</p>
                <SetupNav active={activeSection()} onSelect={scrollToSection} matchedSections={matchedSearchSections()} />
            </aside>

            <div class="setup-settings-column">
              <div class="setup-section-select">
                <label for="setup-section-picker" class="setup-field-label">{t("setup.settingsSection")}</label>
                <SetupSelect id="setup-section-picker" value={activeSection()} onChange={(event) => scrollToSection(event.currentTarget.value as SetupSectionId)}>
                  <For each={SETUP_NAV}>{(item) => <option value={item.id}>{t(item.labelKey)}</option>}</For>
                </SetupSelect>
              </div>

              <div class="setup-settings-search">
                <div class="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background pl-2 pr-1 transition-colors focus-within:border-white focus-within:shadow-[inset_0_0_0_1px_white]">
                  <button
                    type="button"
                    class="shrink-0 size-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={setupSearch() ? t("setup.clearSearch") : t("setup.searchSettings")}
                    onClick={() => setSetupSearch("")}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <Show when={!setupSearch()}>
                      <Icon icon={SearchingIcon} aria-hidden="true" />
                    </Show>
                    <Show when={setupSearch()}>
                      <Icon icon={XIcon} class="text-sm" aria-hidden="true" />
                    </Show>
                  </button>
                  <label for="setup-settings-search" class="sr-only">{t("setup.searchSettings")}</label>
                  <input
                    id="setup-settings-search"
                    type="search"
                    value={setupSearch()}
                    onInput={(event) => setSetupSearch(event.currentTarget.value)}
                    placeholder={t("setup.searchSettings")}
                    class="h-7 min-w-0 flex-1 appearance-none border-0 bg-transparent px-0 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-0 focus:outline-none focus:ring-0"
                  />
                  <Show when={setupSearch().length > 0}>
                    <div class="ml-auto flex shrink-0 items-center gap-1">
                      <span class="whitespace-nowrap text-xs tabular-nums text-muted-foreground" aria-live="polite">{setupSearchCounter()}</span>
                      <Button type="button" size="icon" variant="outline" class="size-7" disabled={setupSearchHits().length === 0} onClick={() => focusSearchResult(setupSearchIndex() - 1)} aria-label={t("setup.searchPrevious")}><Icon icon={ArrowLeft01Icon} aria-hidden="true" /></Button>
                      <Button type="button" size="icon" variant="outline" class="size-7" disabled={setupSearchHits().length === 0} onClick={() => focusSearchResult(setupSearchIndex() + 1)} aria-label={t("setup.searchNext")}><Icon icon={ArrowRight01Icon} aria-hidden="true" /></Button>
                    </div>
                  </Show>
                </div>
              </div>

              <div
                id="setup-settings"
                tabIndex={-1}
                class="setup-settings"
              >
              <div
                class="setup-settings-scroll setup-pane-scroll"
                ref={(el) => {
                  settingsScrollRef = el;
                }}
              >
              <SetupImportCard
                hidden={activeSection() !== "import"}
                onImport={importSettings}
                getCurrentTemplateSettings={() => toVisualSetupPatch(buildConfig(channel().trim()))}
              />

              <SectionCard
                id="setup-section-appearance"
                title={t("setup.appearanceTitle")}
                description={t("setup.appearanceDescription")}
                icon={TextIcon}
                hidden={activeSection() !== "appearance"}
              >
                <div class="setup-field-group"><h3>{t("setup.messageFont")}</h3><ControlRows rows={appearanceRows.slice(0, 3)} /></div>
                <div class="setup-field-group"><h3>{t("setup.weightAndEmotes")}</h3><ControlRows rows={appearanceRows.slice(3)} /></div>
              </SectionCard>

              <SectionCard
                id="setup-section-styling"
                title={t("setup.stylingTitle")}
                description={t("setup.stylingDescription")}
                icon={ColorsIcon}
                hidden={activeSection() !== "styling"}
              >
                <div class="setup-field-group"><h3>{t("setup.textReadability")}</h3><ControlRows rows={stylingRows.slice(0, 3)} /></div>
                <div class="setup-field-group"><h3>{t("setup.messageBacking")}</h3><ControlRows rows={stylingRows.slice(3)} /></div>
                <Show when={toInt(overlayBorderWidth(), 0) > 0}>
                  <div class="setup-field-group"><h3>{t("setup.borderColor")}</h3><ColorPickerField label={t("setup.borderColor")} color={overlayBorderColor().slice(0, 7)} opacity={borderColorOpacity()} onChange={({ color, opacity }) => setOverlayBorderColor(`${color}${Math.round(opacity * 2.55).toString(16).padStart(2, "0")}`)} /></div>
                </Show>
                <div class="setup-field-group"><h3>{t("setup.eventStyling")}</h3>
                  <ToggleRows rows={[{
                    label: () => t("setup.highlightTwitchEvents"),
                    hint: () => t("setup.twitchEventsHighlightHint"),
                    checked: highlightTwitchEvents,
                    onChange: setHighlightTwitchEvents,
                  }]} />
                  <div class="mt-3 flex flex-col gap-3">
                    <label class="text-xs font-medium text-foreground" for="setup-event-opacity">{t("setup.eventColorsOpacity")}</label>
                    <div class="flex items-center gap-3">
                      <Slider id="setup-event-opacity" minValue={0} maxValue={100} step={1} value={[toInt(eventColorOpacity(), DEFAULT_CHAT_CONFIG.eventColorOpacity)]} onChange={(value) => setEventColorOpacity(String(value[0] ?? 0))} class="flex-1" />
                      <output class="w-10 text-right text-xs tabular-nums text-muted-foreground">{eventColorOpacity()}%</output>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <For each={eventColorPalette}>{(item) => (
                        <ColorPickerField compact label={item.label()} triggerLabel={item.label()} color={eventColors()[item.field]} opacity={100} showOpacity={false} onChange={({ color }) => setEventColor(item.field, color)} />
                      )}</For>
                    </div>
                  </div>
                </div>
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
                icon={ArrowUpRightStackIcon}
                hidden={activeSection() !== "behavior"}
              >
                <div class="setup-field-group"><h3>{t("setup.animationAndLinks")}</h3><ControlRows rows={behaviorRows} /><Show when={linkMode() === "highlight"}><ControlRows rows={[linkColorRow]} /></Show></div>
                <div class="setup-field-group"><h3>{t("setup.eventStyling")}</h3><ToggleRows rows={behaviorToggles.slice(0, 2)} /></div>
                <div class="setup-field-group"><h3>{t("setup.messageFlow")}</h3><ToggleRows rows={behaviorToggles.slice(2)} /></div>
              </SectionCard>

              <SectionCard
                id="setup-section-content"
                title={t("setup.contentTitle")}
                description={t("setup.contentDescription")}
                icon={DashboardSquare03Icon}
                hidden={activeSection() !== "content"}
              >
                <div class="setup-field-group"><h3>{t("setup.messagesAndEvents")}</h3><ToggleRows rows={contentToggles} /></div>
                <div class="setup-field-group">
                  <h3>{t("setup.badges")}</h3>
                  <ControlRows rows={[messageSourceRow]} />
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
                icon={BotMessageSquareIcon}
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
                      {(login) => (
                        <UserChip
                          login={login}
                          profiles={botProfiles}
                          onRemove={removeBotName}
                          removeLabel={() => t("setup.removeBot")}
                        />
                      )}
                    </For>
                    <SetupChipInput
                      value={botInput()}
                      onInput={setBotInput}
                      onKeyDown={handleBotInputKeyDown}
                      onCommit={() => {
                        addBotNames(botInput());
                        setBotInput("");
                      }}
                      label={t("setup.addBot")}
                      placeholder={t("setup.nicknamePlaceholder")}
                    />
                  </div>
                </div>

                <div class="setup-bot-row flex flex-col gap-2">
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <div class="text-xs font-medium text-foreground sm:text-sm">
                      {t("setup.youtubeBotNicknames")}
                    </div>
                  </div>
                  <div class={chipFieldClass}>
                    <For each={youtubeBotNames()}>
                      {(login) => (
                        <UserChip
                          login={login}
                          profiles={EMPTY_BOT_PROFILES}
                          onRemove={removeYouTubeBotName}
                          removeLabel={() => t("setup.removeYouTubeBot")}
                        />
                      )}
                    </For>
                    <SetupChipInput
                      value={youtubeBotInput()}
                      onInput={setYoutubeBotInput}
                      onKeyDown={handleYouTubeBotInputKeyDown}
                      onCommit={() => {
                        addYouTubeBotNames(youtubeBotInput());
                        setYoutubeBotInput("");
                      }}
                      label={t("setup.addYouTubeBot")}
                      placeholder={t("setup.nicknamePlaceholder")}
                    />
                  </div>
                </div>

                <div class="setup-bot-row flex flex-col gap-2">
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <div class="text-xs font-medium text-foreground sm:text-sm">
                      {t("setup.kickBotNicknames")}
                    </div>
                  </div>
                  <div class={chipFieldClass}>
                    <For each={kickBotNames()}>
                      {(login) => (
                        <UserChip
                          login={login}
                          profiles={kickBotProfiles}
                          onRemove={removeKickBotName}
                          removeLabel={() => t("setup.removeKickBot")}
                        />
                      )}
                    </For>
                    <SetupChipInput
                      value={kickBotInput()}
                      onInput={setKickBotInput}
                      onKeyDown={handleKickBotInputKeyDown}
                      onCommit={() => {
                        addKickBotNames(kickBotInput());
                        setKickBotInput("");
                      }}
                      label={t("setup.addKickBot")}
                      placeholder={t("setup.nicknamePlaceholder")}
                    />
                  </div>
                </div>

                <div class="setup-bot-row flex flex-col gap-2">
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
                      {(login) => (
                        <UserChip
                          login={login}
                          profiles={botProfiles}
                          onRemove={removeAllowedChatter}
                          removeLabel={() => t("setup.removeViewer")}
                        />
                      )}
                    </For>
                    <SetupChipInput
                      value={allowedChatterInput()}
                      onInput={setAllowedChatterInput}
                      onKeyDown={handleAllowedChatterInputKeyDown}
                      onCommit={() => {
                        addAllowedChatters(allowedChatterInput());
                        setAllowedChatterInput("");
                      }}
                      label={t("setup.addViewer")}
                      placeholder={t("setup.nicknamePlaceholder")}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                id="setup-section-tts"
                title={t("setup.ttsTitle")}
                description={t("setup.ttsDescription")}
                icon={VoiceCommentIcon}
                hidden={activeSection() !== "tts"}
              >
                <ToggleRows rows={ttsToggles} />
                <VoiceCatalog />
              </SectionCard>

              <SectionCard
                id="setup-section-rte"
                title={t("setup.rteTitle")}
                description={t("setup.rteDescription")}
                icon={Blockchain05Icon}
                hidden={activeSection() !== "rte"}
              >
                <ToggleRows rows={rteToggles} />
              </SectionCard>
            </div>
            </div>
            </div>

            <div id="setup-preview" tabIndex={-1} class="setup-preview-pane setup-pane-scroll min-h-0 min-w-0 overflow-y-auto overscroll-contain min-[1100px]:h-full">
              <div class="flex min-h-0 flex-col gap-2 pb-2 min-[1100px]:h-full min-[1100px]:pb-0">
                <SectionCard
                  title={t("setup.previewTitle")}
                  compact
                  class="setup-preview-section min-[1100px]:flex min-[1100px]:min-h-0 min-[1100px]:flex-1 min-[1100px]:flex-col"
                >
                  <div class="setup-preview-content">
                    <PreviewControls
                      stageBackdrop={stageBackdrop}
                      setStageBackdrop={setStageBackdrop}
                      stageColor={stageColor}
                      setStageColor={setStageColor}
                      previewMode={previewMode}
                      setPreviewMode={setPreviewMode}
                      previewDemoKind={previewDemoKind}
                      setPreviewDemoKind={setPreviewDemoKind}
                      demoPaused={demoPaused}
                      setDemoPaused={setDemoPaused}
                      messageSpeedValue={messageSpeedValue}
                      messageSpeedLabel={messageSpeedLabel}
                      setMessageSpeed={setMessageSpeed}
                      hasPreviewChannel={hasPreviewChannel}
                      isExternalOnly={isExternalOnly}
                    />

                    <div
                      class="setup-preview-frame relative isolate h-[clamp(180px,36dvh,320px)] w-full shrink-0 overflow-hidden min-[1100px]:h-auto min-[1100px]:flex-1 min-[1100px]:min-h-[min(180px,36dvh)]"
                      style={previewFrameStyle()}
                    >
                      <iframe
                        ref={iframeRef}
                        src={previewUrl()}
                        onLoad={() => previewSync.postConfig(previewConfig())}
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
