import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js";
import { Title } from "@solidjs/meta";
import { ColorPickerField } from "~/components/ColorPickerField";
import { SetupNumberField } from "~/components/setup/SetupNumberField";
import { SetupSwitch } from "~/components/setup/SetupSwitch";
import { DEFAULT_BOT_NAMES } from "~/config/botNames";
import {
  DEFAULT_CHAT_CONFIG,
  chatConfigToSearchParams,
  normalizeBotNames,
  type ChatConfig,
} from "~/config/chatUrlParams";
import { getAppBaseUrl, getPublicAssetUrl } from "~/utils/appBase";

type ControlRow = {
  label: string;
  control: JSX.Element;
  hint?: string;
};

type ToggleRow = {
  label: string;
  checked: () => boolean;
  onChange: (value: boolean) => void;
  hint?: string;
};

type BotProfile = {
  login: string;
  displayName: string;
  avatarUrl: string;
};

const TWITCH_GQL_ENDPOINT = "https://gql.twitch.tv/gql";
const TWITCH_WEB_CLIENT_ID =
  import.meta.env.VITE_TWITCH_GQL_CLIENT_ID || "kimne78kx3ncx6brgo4mv6wki5h1ko";

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

function renderToggleRows(
  rows: ToggleRow[],
  styles: Record<string, JSX.CSSProperties>,
) {
  return (
    <For each={rows}>
      {(row) => (
        <div style={styles.toggleRow}>
          <div style={styles.toggleLabelWrap}>
            <div style={styles.settingLabel}>{row.label}</div>
            {row.hint && <div style={styles.settingHint}>{row.hint}</div>}
          </div>
          <SetupSwitch checked={row.checked()} onChange={row.onChange} />
        </div>
      )}
    </For>
  );
}

function renderControlRows(
  rows: ControlRow[],
  styles: Record<string, JSX.CSSProperties>,
) {
  return (
    <For each={rows}>
      {(row) => (
        <div style={styles.controlRow}>
          <div style={styles.controlLabelWrap}>
            <div style={styles.settingLabel}>{row.label}</div>
            {row.hint && <div style={styles.settingHint}>{row.hint}</div>}
          </div>
          <div style={styles.controlSlot}>{row.control}</div>
        </div>
      )}
    </For>
  );
}

export default function ChatSetup() {
  const [channel, setChannel] = createSignal("");
  const [size, setSize] = createSignal(String(DEFAULT_CHAT_CONFIG.size));
  const [font, setFont] = createSignal(String(DEFAULT_CHAT_CONFIG.font));
  const [fontCustom, setFontCustom] = createSignal("");
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
  const [animate, setAnimate] = createSignal(DEFAULT_CHAT_CONFIG.animate);
  const [showHomies, setShowHomies] = createSignal(
    DEFAULT_CHAT_CONFIG.showHomies,
  );
  const [bots, setBots] = createSignal(DEFAULT_CHAT_CONFIG.bots);
  const [commands, setCommands] = createSignal(DEFAULT_CHAT_CONFIG.commands);
  const [hideSpecialBadges, setHideSpecialBadges] = createSignal(
    DEFAULT_CHAT_CONFIG.hideSpecialBadges,
  );
  const [emoteScale, setEmoteScale] = createSignal(
    String(DEFAULT_CHAT_CONFIG.emoteScale),
  );
  const [botNames, setBotNames] = createSignal<string[]>([...DEFAULT_BOT_NAMES]);
  const [botInput, setBotInput] = createSignal("");
  const [botProfiles, setBotProfiles] = createSignal<Record<string, BotProfile>>(
    {},
  );
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

  const [generatedUrl, setGeneratedUrl] = createSignal("");
  const [previewUrl, setPreviewUrl] = createSignal("");
  // eslint-disable-next-line no-unassigned-vars -- assigned by SolidJS ref={}
  let iframeRef: HTMLIFrameElement | undefined;

  onMount(() => {
    const previousHtmlBackground = document.documentElement.style.background;
    const previousBodyBackground = document.body.style.background;

    document.documentElement.style.background = "#09090b";
    document.body.style.background = "#09090b";

    onCleanup(() => {
      document.documentElement.style.background = previousHtmlBackground;
      document.body.style.background = previousBodyBackground;
    });
  });

  // shadcn-dark zinc palette
  const C = {
    bg: "#09090b",
    card: "#111113",
    border: "#27272a",
    input: "#0d0d0f",
    text: "#fafafa",
    muted: "#71717a",
    subtle: "#a1a1aa",
  } as const;

  const styles = {
    page: {
      background: C.bg,
      color: C.text,
      padding: "24px 16px 48px",
      "min-height": "100vh",
      width: "100%",
      "box-sizing": "border-box",
      "overflow-x": "hidden",
    },
    shell: {
      margin: "0 auto",
      width: "100%",
      "max-width": "1320px",
      display: "flex",
      "flex-direction": "column",
      gap: "16px",
      "font-family": "'Inter', 'Segoe UI', sans-serif",
    },
    title: {
      "text-align": "center",
      "font-size": "18px",
      "font-weight": 600,
      color: C.text,
      "letter-spacing": "-0.01em",
    },
    channelCard: {
      background: C.card,
      padding: "14px 16px",
      width: "100%",
      "border-radius": "8px",
      border: `1px solid ${C.border}`,
      display: "flex",
      "flex-direction": "column",
      gap: "12px",
    },
    channelRow: {
      display: "flex",
      "align-items": "center",
      gap: "10px",
      "flex-wrap": "wrap",
    },
    channelInput: {
      flex: "1 1 420px",
      height: "40px",
      padding: "9px 14px",
      border: `1px solid ${C.border}`,
      "border-radius": "6px",
      "font-size": "14px",
      background: C.input,
      color: C.text,
      "font-family": "inherit",
      "box-sizing": "border-box",
      "text-align": "center",
    },
    primaryButton: {
      background: C.text,
      color: C.bg,
      border: "none",
      padding: "0 16px",
      "border-radius": "6px",
      "font-size": "13px",
      "font-weight": 600,
      "font-family": "'Inter', 'Segoe UI', sans-serif",
      cursor: "pointer",
      transition: "opacity 0.15s",
      "min-width": "160px",
      height: "40px",
    },
    mainGrid: {
      display: "grid",
      gap: "20px",
      width: "100%",
    },
    leftPane: {
      display: "flex",
      "flex-direction": "column",
      gap: "12px",
      "min-width": "0",
    },
    previewPane: {
      "min-width": "0",
    },
    sectionCard: {
      background: C.card,
      border: `1px solid ${C.border}`,
      "border-radius": "8px",
      padding: "16px",
      display: "flex",
      "flex-direction": "column",
      gap: "12px",
    },
    sectionTitle: {
      margin: "0",
      "font-size": "11px",
      "font-weight": 600,
      color: C.muted,
      "text-transform": "uppercase",
      "letter-spacing": "0.08em",
    },
    sectionHint: {
      "font-size": "12px",
      color: C.muted,
      "line-height": 1.5,
    },
    controlRow: {
      display: "grid",
      "grid-template-columns": "200px minmax(0, 1fr)",
      gap: "12px",
      "align-items": "center",
      width: "100%",
    },
    controlLabelWrap: {
      display: "flex",
      "flex-direction": "column",
      gap: "3px",
      "min-width": "0",
    },
    controlSlot: {
      width: "100%",
      "min-width": "0",
    },
    toggleRow: {
      display: "grid",
      "grid-template-columns": "minmax(0, 1fr) auto",
      gap: "12px",
      "align-items": "center",
      width: "100%",
    },
    toggleLabelWrap: {
      display: "flex",
      "flex-direction": "column",
      gap: "3px",
      "min-width": "0",
    },
    settingLabel: {
      "font-size": "13px",
      "font-weight": 500,
      color: C.text,
    },
    settingHint: {
      "font-size": "11px",
      color: C.muted,
      "line-height": 1.4,
    },
    input: {
      padding: "8px 12px",
      height: "36px",
      border: `1px solid ${C.border}`,
      "border-radius": "6px",
      "font-size": "13px",
      background: C.input,
      color: C.text,
      "font-family": "inherit",
      "box-sizing": "border-box",
      width: "100%",
    },
    textarea: {
      padding: "10px 12px",
      minHeight: "100px",
      border: `1px solid ${C.border}`,
      "border-radius": "6px",
      "font-size": "13px",
      background: C.input,
      color: C.text,
      "font-family": "inherit",
      "box-sizing": "border-box",
      width: "100%",
      resize: "vertical",
      "line-height": 1.45,
    },
    previewSticky: {
      position: "sticky",
      top: "24px",
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
    },
    previewLabel: {
      "font-size": "11px",
      "font-weight": 600,
      color: C.muted,
      "text-transform": "uppercase",
      "letter-spacing": "0.08em",
    },
    previewScreen: {
      position: "relative",
      height: "600px",
      width: "100%",
      overflow: "hidden",
      background: "#08090f",
    },
    previewOverlay: {
      position: "absolute",
      inset: "0",
      background:
        "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.04) 40%, rgba(0,0,0,0.38) 100%)",
      "pointer-events": "none",
    },
    previewFrame: {
      position: "relative",
      width: "100%",
      height: "100%",
      border: "0",
      display: "block",
      background: "transparent",
      "z-index": "1",
    },
    secondaryButton: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      height: "36px",
      padding: "0 14px",
      background: "transparent",
      color: C.text,
      border: `1px solid ${C.border}`,
      "border-radius": "6px",
      "font-size": "13px",
      "font-weight": 500,
      "text-decoration": "none",
      cursor: "pointer",
      "box-sizing": "border-box",
    },
    botHeader: {
      display: "grid",
      "grid-template-columns": "200px minmax(0, 1fr)",
      gap: "12px",
      "align-items": "start",
      width: "100%",
    },
    botLabelWrap: {
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      "min-width": "0",
    },
    botSwitchRow: {
      display: "inline-flex",
      "align-items": "center",
      gap: "8px",
      "font-size": "12px",
      color: C.subtle,
    },
    botChipField: {
      width: "100%",
      minHeight: "92px",
      padding: "10px",
      border: `1px solid ${C.border}`,
      "border-radius": "14px",
      background: C.input,
      "box-sizing": "border-box",
    },
    botChipList: {
      display: "flex",
      "align-items": "center",
      "align-content": "flex-start",
      "flex-wrap": "wrap",
      gap: "8px",
      width: "100%",
    },
    botChip: {
      display: "inline-flex",
      "align-items": "center",
      gap: "8px",
      maxWidth: "100%",
      minHeight: "34px",
      padding: "3px 6px 3px 4px",
      color: "#ffffff",
      background: "#050505",
      border: "1px solid rgba(255,255,255,0.52)",
      "border-radius": "999px",
      "box-sizing": "border-box",
    },
    botAvatar: {
      width: "28px",
      height: "28px",
      "border-radius": "999px",
      "object-fit": "cover",
      background: "#000000",
      border: "1px solid rgba(255,255,255,0.36)",
      "box-sizing": "border-box",
      flex: "0 0 auto",
    },
    botAvatarFallback: {
      width: "28px",
      height: "28px",
      "border-radius": "999px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      background: "#000000",
      border: "1px solid rgba(255,255,255,0.36)",
      color: "#ffffff",
      "font-size": "12px",
      "font-weight": 700,
      "box-sizing": "border-box",
      flex: "0 0 auto",
    },
    botText: {
      display: "flex",
      "flex-direction": "column",
      "justify-content": "center",
      minWidth: "0",
      "line-height": 1.05,
    },
    botDisplayName: {
      color: "#ffffff",
      "font-size": "12px",
      "font-weight": 700,
      "white-space": "nowrap",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      maxWidth: "150px",
    },
    botLogin: {
      color: "rgba(255,255,255,0.62)",
      "font-size": "10px",
      "white-space": "nowrap",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      maxWidth: "150px",
    },
    botRemoveButton: {
      width: "22px",
      height: "22px",
      border: "0",
      "border-radius": "999px",
      background: "transparent",
      color: "#ffffff",
      cursor: "pointer",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "font-size": "16px",
      "line-height": 1,
      padding: "0",
      flex: "0 0 auto",
    },
    botInput: {
      flex: "1 1 180px",
      minWidth: "150px",
      height: "34px",
      border: "0",
      background: "transparent",
      color: "#ffffff",
      "font-family": "inherit",
      "font-size": "13px",
      padding: "0 4px",
      "box-sizing": "border-box",
    },
    roleMergeCard: {
      display: "grid",
      "grid-template-columns": "minmax(0, 0.9fr) minmax(300px, 1.4fr)",
      gap: "12px",
      "align-items": "stretch",
      padding: "14px",
      border: "1px solid rgba(255,255,255,0.18)",
      "border-radius": "10px",
      background: "#020202",
    },
    roleMergeHeader: {
      display: "flex",
      "flex-direction": "column",
      gap: "5px",
      "min-width": "0",
    },
    roleMergeTitle: {
      color: C.text,
      "font-size": "13px",
      "font-weight": 700,
    },
    roleMergeHint: {
      color: C.muted,
      "font-size": "11px",
      "line-height": 1.45,
    },
    rolePillGroup: {
      display: "grid",
      "grid-template-columns": "repeat(3, minmax(0, 1fr))",
      gap: "8px",
    },
    rolePill: {
      minHeight: "74px",
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      gap: "9px",
      padding: "10px",
      border: "1px solid rgba(255,255,255,0.18)",
      "border-radius": "10px",
      background: "#000000",
      color: "rgba(255,255,255,0.68)",
      cursor: "pointer",
      "font-family": "inherit",
      "font-size": "12px",
      "font-weight": 700,
      "box-sizing": "border-box",
    },
    rolePillActive: {
      border: "1px solid rgba(255,255,255,0.72)",
      color: "#ffffff",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01))",
      "box-shadow": "inset 0 0 0 1px rgba(255,255,255,0.05)",
    },
    roleBadgePreview: {
      display: "inline-flex",
      "align-items": "center",
      padding: "3px",
      border: "1px solid rgba(255,255,255,0.16)",
      "border-radius": "7px",
      background: "#070707",
    },
    roleBadgeIcon: {
      width: "23px",
      height: "23px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "border-radius": "5px",
      color: "#ffffff",
      "font-size": "8px",
      "font-weight": 900,
      "letter-spacing": "0.02em",
      "box-sizing": "border-box",
      border: "1px solid rgba(255,255,255,0.2)",
    },
    roleBadgeImage: {
      width: "100%",
      height: "100%",
      display: "block",
      "object-fit": "contain",
    },
    rolePillLabel: {
      "line-height": 1.1,
      "text-align": "center",
    },
    resultCard: {
      background: C.card,
      padding: "16px",
      "border-radius": "8px",
      border: `1px solid ${C.border}`,
      display: "flex",
      "flex-direction": "column",
      gap: "12px",
    },
    resultBody: {
      background: C.input,
      padding: "12px 14px",
      "border-radius": "6px",
      border: `1px solid ${C.border}`,
      "word-break": "break-all",
      color: C.subtle,
      "font-family": "'Source Code Pro', monospace",
      "font-size": "0.85em",
    },
    resultActions: {
      display: "flex",
      gap: "8px",
      "flex-wrap": "wrap",
    },
  } as const;

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

  const toFloat = (raw: string, fallback: number): number => {
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const buildConfig = (selectedChannel: string): ChatConfig => ({
    ...DEFAULT_CHAT_CONFIG,
    channel: selectedChannel,
    size: toInt(size(), DEFAULT_CHAT_CONFIG.size),
    font: toInt(font(), DEFAULT_CHAT_CONFIG.font),
    fontCustom: fontCustom(),
    shadow: toIntOrFalse(shadow()),
    stroke: toIntOrFalse(stroke()),
    fade: toSecondsOrFalse(fade()),
    animate: animate(),
    showHomies: showHomies(),
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
  });

  const buildChatUrl = (
    cfg: ChatConfig,
    extraParams?: Record<string, string>,
  ) => {
    const params = chatConfigToSearchParams(cfg);
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) =>
        params.set(key, value),
      );
    }
    const query = params.toString();
    return `${getAppBaseUrl()}/chat/${query ? `?${query}` : ""}`;
  };

  const previewChannel = createMemo(() => channel().trim() || "chatyxpreview");
  const previewConfig = createMemo(() => buildConfig(previewChannel()));
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
    const missing = Array.from(new Set([...botNames(), ...allowedChatters()]))
      .filter(
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
    const currentChannel = channel().trim();
    if (!currentChannel) {
      setGeneratedUrl("");
      return;
    }

    setGeneratedUrl(buildChatUrl(buildConfig(currentChannel)));
  });

  createEffect(() => {
    const cfg = previewConfig(); // read synchronously so SolidJS tracks the dependency
    const timer = window.setTimeout(() => {
      const nextPreviewUrl = buildChatUrl(cfg, {
        preview: "true",
        refresh: String(Date.now()),
      });

      // Set via ref to avoid about:blank flash — just swap src directly
      if (iframeRef) {
        iframeRef.src = nextPreviewUrl;
      } else {
        setPreviewUrl(nextPreviewUrl);
      }
    }, 180);

    onCleanup(() => {
      window.clearTimeout(timer);
    });
  });

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl());
      alert("Ссылка скопирована в буфер обмена");
    } catch (err) {
      console.error("Ошибка копирования:", err);
    }
  };

  const appearanceRows: ControlRow[] = [
    {
      label: "Размер сообщений",
      control: (
        <select
          value={size()}
          onChange={(e) => setSize(e.currentTarget.value)}
          style={styles.input}
        >
          <option value="1">Маленький</option>
          <option value="2">Средний</option>
          <option value="3">Большой</option>
        </select>
      ),
    },
    {
      label: "Шрифт",
      control: (
        <select
          value={font()}
          onChange={(e) => setFont(e.currentTarget.value)}
          style={styles.input}
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
        </select>
      ),
    },
    {
      label: "Название своего шрифта",
      hint: "Работает, когда выше выбран пункт «Свой шрифт».",
      control: (
        <input
          type="text"
          value={fontCustom()}
          onInput={(e) => setFontCustom(e.currentTarget.value)}
          placeholder="Например: Comic Sans MS"
          disabled={font() !== "0"}
          style={{
            ...styles.input,
            opacity: font() === "0" ? "1" : "0.5",
          }}
        />
      ),
    },
    {
      label: "Размер эмотов",
      control: (
        <SetupNumberField
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
      control: (
        <select
          value={shadow()}
          onChange={(e) => setShadow(e.currentTarget.value)}
          style={styles.input}
        >
          <option value="0">Выкл</option>
          <option value="1">Маленькая</option>
          <option value="2">Средняя</option>
          <option value="3">Большая</option>
        </select>
      ),
    },
    {
      label: "Обводка текста",
      control: (
        <select
          value={stroke()}
          onChange={(e) => setStroke(e.currentTarget.value)}
          style={styles.input}
        >
          <option value="0">Выкл</option>
          <option value="1">Тонкая</option>
          <option value="2">Средняя</option>
          <option value="3">Толстая</option>
          <option value="4">Очень толстая</option>
        </select>
      ),
    },
    {
      label: "Скрывать сообщения через",
      hint: "В секундах. 0 — сообщения остаются на экране.",
      control: (
        <SetupNumberField
          value={fade()}
          onChange={setFade}
          min={0}
          placeholder="30"
        />
      ),
    },
    {
      label: "Фон сообщений",
      control: (
        <ColorPickerField
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
      control: (
        <SetupNumberField
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
      control: (
        <SetupNumberField
          value={overlayBorderOpacity()}
          onChange={setOverlayBorderOpacity}
          min={0}
          max={100}
          step={1}
        />
      ),
    },
  ];

  const behaviorToggles: ToggleRow[] = [
    {
      label: "Анимировать новые сообщения",
      checked: animate,
      onChange: setAnimate,
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
      label: "Скрыть сторонние бейджи",
      checked: hideSpecialBadges,
      onChange: setHideSpecialBadges,
    },
    {
      label: "Показывать Homies-бейджи",
      checked: showHomies,
      onChange: setShowHomies,
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
        style={styles.botChip}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Backspace" || event.key === "Delete") {
            event.preventDefault();
            remove(login);
          }
        }}
      >
        {avatarUrl() ? (
          <img
            src={avatarUrl()}
            alt=""
            style={styles.botAvatar}
            loading="lazy"
          />
        ) : (
          <span style={styles.botAvatarFallback}>{botFallbackName(login)}</span>
        )}
        <span style={styles.botText}>
          <span style={styles.botDisplayName}>{displayName()}</span>
          {displayName().toLowerCase() !== login && (
            <span style={styles.botLogin}>@{login}</span>
          )}
        </span>
        <button
          type="button"
          style={styles.botRemoveButton}
          onClick={() => remove(login)}
          aria-label={`${ariaLabel}: ${displayName()}`}
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <>
      <Title>ChatYX • настройка</Title>

      <style>
        {`
          .setup-main-grid {
            grid-template-columns: minmax(0, 1.15fr) minmax(360px, 440px);
          }

          @media (max-width: 1100px) {
            .setup-main-grid {
              grid-template-columns: 1fr;
            }

            .setup-preview-sticky {
              position: static !important;
            }
          }

          @media (max-width: 720px) {
            .setup-control-row,
            .setup-bot-row,
            .setup-role-merge {
              grid-template-columns: 1fr !important;
            }

            .setup-toggle-row {
              grid-template-columns: 1fr auto !important;
            }

            .setup-role-pills {
              grid-template-columns: 1fr !important;
            }
          }

          @keyframes preview-ambient-shift {
            0%   { background-position: 0% 50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }

          .preview-ambient {
            position: absolute;
            inset: 0;
            background: linear-gradient(
              -45deg,
              #06080f,
              #0a1220,
              #0e1a30,
              #0c1528,
              #110d22,
              #0a0e1a,
              #081018,
              #0d1a2e
            );
            background-size: 400% 400%;
            animation: preview-ambient-shift 14s ease infinite;
          }

          .preview-ambient::after {
            content: '';
            position: absolute;
            inset: 0;
            background:
              radial-gradient(ellipse 60% 40% at 20% 80%, rgba(59, 130, 246, 0.07) 0%, transparent 70%),
              radial-gradient(ellipse 50% 35% at 80% 20%, rgba(139, 92, 246, 0.06) 0%, transparent 70%),
              radial-gradient(ellipse 40% 30% at 50% 50%, rgba(16, 185, 129, 0.03) 0%, transparent 70%);
          }
        `}
      </style>

      <div style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.title}>Настройка чат-оверлея</div>

          <div style={styles.channelCard}>
            <div style={styles.channelRow}>
              <input
                type="text"
                value={channel()}
                onInput={(e) => setChannel(e.currentTarget.value)}
                placeholder="Ник Twitch-канала, например linaryx"
                style={styles.channelInput}
              />
            </div>
          </div>

          <div class="setup-main-grid" style={styles.mainGrid}>
            <div style={styles.leftPane}>
              <section style={styles.sectionCard}>
                <h3 style={styles.sectionTitle}>Текст и размер</h3>
                <div style={styles.sectionHint}>
                  Настрой, насколько крупно и каким шрифтом будет выглядеть чат.
                </div>
                {renderControlRows(appearanceRows, {
                  controlRow: { ...styles.controlRow },
                  controlLabelWrap: styles.controlLabelWrap,
                  controlSlot: styles.controlSlot,
                  settingLabel: styles.settingLabel,
                  settingHint: styles.settingHint,
                })}
              </section>

              <section style={styles.sectionCard}>
                <h3 style={styles.sectionTitle}>Внешний вид</h3>
                <div style={styles.sectionHint}>
                  Фон сообщений, тень, обводка и время жизни строк на экране.
                </div>
                {renderControlRows(stylingRows, {
                  controlRow: { ...styles.controlRow },
                  controlLabelWrap: styles.controlLabelWrap,
                  controlSlot: styles.controlSlot,
                  settingLabel: styles.settingLabel,
                  settingHint: styles.settingHint,
                })}
              </section>

              <section style={styles.sectionCard}>
                <h3 style={styles.sectionTitle}>Поведение сообщений</h3>
                <div style={styles.sectionHint}>
                  Управляет анимацией, переносами, порядком и форматом
                  сообщений.
                </div>
                {renderToggleRows(behaviorToggles, {
                  toggleRow: { ...styles.toggleRow },
                  toggleLabelWrap: styles.toggleLabelWrap,
                  settingLabel: styles.settingLabel,
                  settingHint: styles.settingHint,
                })}
              </section>

              <section style={styles.sectionCard}>
                <h3 style={styles.sectionTitle}>Контент и бейджи</h3>
                <div style={styles.sectionHint}>
                  Выбери, какие сообщения, эмоуты и бейджи попадут в оверлей.
                </div>
                {renderToggleRows(contentToggles, {
                  toggleRow: { ...styles.toggleRow },
                  toggleLabelWrap: styles.toggleLabelWrap,
                  settingLabel: styles.settingLabel,
                  settingHint: styles.settingHint,
                })}

                <div class="setup-role-merge" style={styles.roleMergeCard}>
                  <div style={styles.roleMergeHeader}>
                    <div style={styles.roleMergeTitle}>
                      Объединять bot badge с role badge
                    </div>
                    <div style={styles.roleMergeHint}>
                      Выбери роли, у которых FFZ-бот-бейдж будет показываться
                      рядом с Twitch-бейджем роли.
                    </div>
                  </div>
                  <div class="setup-role-pills" style={styles.rolePillGroup}>
                    <For each={roleBadgeMergeOptions}>
                      {(option) => {
                        const active = () => option.checked();

                        return (
                          <button
                            type="button"
                            style={{
                              ...styles.rolePill,
                              ...(active() ? styles.rolePillActive : {}),
                            }}
                            onClick={() => option.onChange(!active())}
                            aria-pressed={active()}
                          >
                            <span style={styles.roleBadgePreview}>
                              <span
                                style={{
                                  ...styles.roleBadgeIcon,
                                  background: option.badgeColor,
                                }}
                              >
                                <img
                                  src={ffzBotBadgePreviewUrl}
                                  alt=""
                                  style={styles.roleBadgeImage}
                                  loading="lazy"
                                />
                              </span>
                            </span>
                            <span style={styles.rolePillLabel}>
                              {option.label}
                            </span>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </section>

              <section style={styles.sectionCard}>
                <h3 style={styles.sectionTitle}>Боты и фильтры</h3>
                <div style={styles.sectionHint}>
                  Спрячь ботов, команды или оставь сообщения только выбранных
                  пользователей.
                </div>

                <div class="setup-bot-row" style={styles.botHeader}>
                  <div style={styles.botLabelWrap}>
                    <div style={styles.settingLabel}>Ники ботов</div>
                    <div style={styles.botSwitchRow}>
                      <SetupSwitch checked={bots()} onChange={setBots} />
                      <span>Не фильтровать ботов</span>
                    </div>
                  </div>
                  <div style={styles.botChipField}>
                    <div style={styles.botChipList}>
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
                        type="text"
                        value={botInput()}
                        onInput={(event) => setBotInput(event.currentTarget.value)}
                        onKeyDown={handleBotInputKeyDown}
                        onBlur={() => {
                          addBotNames(botInput());
                          setBotInput("");
                        }}
                        placeholder="Введите никнейм и нажмите Enter"
                        style={styles.botInput}
                      />
                    </div>
                  </div>
                </div>

                <div class="setup-control-row" style={styles.controlRow}>
                  <div style={styles.controlLabelWrap}>
                    <div style={styles.settingLabel}>
                      Показывать только этих зрителей
                    </div>
                    <div style={styles.settingHint}>
                      Если список не пустой, остальные сообщения будут скрыты.
                    </div>
                  </div>
                  <div style={styles.controlSlot}>
                    <div style={styles.botChipField}>
                      <div style={styles.botChipList}>
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
                          style={styles.botInput}
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </section>
            </div>

            <div style={styles.previewPane}>
              <div class="setup-preview-sticky" style={styles.previewSticky}>
                <div style={styles.previewLabel}>Живое превью</div>
                <div style={styles.previewScreen}>
                  <div class="preview-ambient" />
                  <div style={styles.previewOverlay} />
                  <iframe
                    ref={iframeRef}
                    src={previewUrl()}
                    style={styles.previewFrame}
                    title="Chat preview"
                    scrolling="no"
                  />
                </div>
              </div>
            </div>
          </div>

          {generatedUrl() && (
            <div style={styles.resultCard}>
              <div style={styles.sectionTitle}>Ссылка для OBS готова</div>
              <div style={styles.resultBody}>{generatedUrl()}</div>
              <div style={styles.resultActions}>
                <button onClick={copyToClipboard} style={styles.primaryButton}>
                  Скопировать ссылку
                </button>
                <a
                  href={generatedUrl()}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.secondaryButton}
                >
                  Открыть оверлей
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
