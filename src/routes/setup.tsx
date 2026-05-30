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
import {
  DEFAULT_BOT_NAMES,
  formatBotNamesForTextarea,
} from "~/config/botNames";
import {
  DEFAULT_CHAT_CONFIG,
  chatConfigToSearchParams,
  normalizeBotNames,
  type ChatConfig,
} from "~/config/chatUrlParams";

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

function renderToggleRows(rows: ToggleRow[], styles: Record<string, JSX.CSSProperties>) {
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

function renderControlRows(rows: ControlRow[], styles: Record<string, JSX.CSSProperties>) {
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

function appBaseUrl(): string {
  const basePath = import.meta.env.BASE_URL;
  const baseUrl = new URL(basePath, window.location.origin);
  return baseUrl.toString().replace(/\/$/, "");
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
  const [botNames, setBotNames] = createSignal(
    formatBotNamesForTextarea(DEFAULT_BOT_NAMES),
  );
  const [singleChatter, setSingleChatter] = createSignal("");
  const [show7tvUnlisted, setShow7tvUnlisted] = createSignal(
    DEFAULT_CHAT_CONFIG.show7tvUnlisted,
  );
  const [smallCaps, setSmallCaps] = createSignal(DEFAULT_CHAT_CONFIG.smallCaps);
  const [nlAfterName, setNlAfterName] = createSignal(
    DEFAULT_CHAT_CONFIG.nlAfterName,
  );
  const [hideNames, setHideNames] = createSignal(DEFAULT_CHAT_CONFIG.hideNames);
  const [lastEmoteBackground, setLastEmoteBackground] = createSignal(
    DEFAULT_CHAT_CONFIG.lastEmoteBackground,
  );
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
  const [overlayBackgroundOpacity, setOverlayBackgroundOpacity] =
    createSignal(String(DEFAULT_CHAT_CONFIG.overlayBackgroundOpacity));
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
    botNames: normalizeBotNames(botNames()),
    singleChatter: singleChatter(),
    show7tvUnlisted: show7tvUnlisted(),
    smallCaps: smallCaps(),
    nlAfterName: nlAfterName(),
    hideNames: hideNames(),
    lastEmoteBackground: lastEmoteBackground(),
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
      Object.entries(extraParams).forEach(([key, value]) => params.set(key, value));
    }
    const query = params.toString();
    return `${appBaseUrl()}/chat${query ? `?${query}` : ""}`;
  };

  const previewChannel = createMemo(() => channel().trim() || "chatyxpreview");
  const previewConfig = createMemo(() => buildConfig(previewChannel()));

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
      alert("URL скопирован в буфер обмена!");
    } catch (err) {
      console.error("Ошибка копирования:", err);
    }
  };

  const appearanceRows: ControlRow[] = [
    {
      label: "Размер",
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
          <option value="0">[Custom]</option>
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
      label: "Кастомный шрифт",
      hint: "Активен только когда выбран [Custom]",
      control: (
        <input
          type="text"
          value={fontCustom()}
          onInput={(e) => setFontCustom(e.currentTarget.value)}
          placeholder="Название шрифта"
          disabled={font() !== "0"}
          style={{
            ...styles.input,
            opacity: font() === "0" ? "1" : "0.5",
          }}
        />
      ),
    },
    {
      label: "Масштаб эмодзи",
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
      label: "Тень",
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
      label: "Обводка",
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
      label: "Исчезновение (сек)",
      hint: "0 выключает fade",
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
      label: "Цвет фона",
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
      label: "Скругление фона (px)",
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
      label: "Прозрачность рамки (%)",
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
    { label: "Анимация", checked: animate, onChange: setAnimate },
    {
      label: "Small Caps ники",
      checked: smallCaps,
      onChange: setSmallCaps,
    },
    {
      label: "Перенос после ника",
      checked: nlAfterName,
      onChange: setNlAfterName,
    },
    { label: "Скрыть ники", checked: hideNames, onChange: setHideNames },
    {
      label: "Фон последнего эмоута",
      checked: lastEmoteBackground,
      onChange: setLastEmoteBackground,
    },
    {
      label: "Реверс порядка строк",
      checked: reverseLineOrder,
      onChange: setReverseLineOrder,
    },
    {
      label: "Горизонтальный режим",
      checked: horizontal,
      onChange: setHorizontal,
    },
  ];

  const contentToggles: ToggleRow[] = [
    {
      label: "Показывать команды",
      checked: commands,
      onChange: setCommands,
    },
    {
      label: "7TV unlisted эмоуты",
      checked: show7tvUnlisted,
      onChange: setShow7tvUnlisted,
    },
    {
      label: "Скрыть спец. бейджи",
      checked: hideSpecialBadges,
      onChange: setHideSpecialBadges,
    },
    {
      label: "Homies бейджи",
      checked: showHomies,
      onChange: setShowHomies,
    },
  ];

  const ffzToggles: ToggleRow[] = [
    {
      label: "Broadcaster",
      checked: ffzBotMixBroadcaster,
      onChange: setFfzBotMixBroadcaster,
    },
    {
      label: "Moderator",
      checked: ffzBotMixModerator,
      onChange: setFfzBotMixModerator,
    },
    { label: "VIP", checked: ffzBotMixVip, onChange: setFfzBotMixVip },
  ];

  return (
    <>
      <Title>ChatYX • Setup</Title>

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
            .setup-bot-row {
              grid-template-columns: 1fr !important;
            }

            .setup-toggle-row {
              grid-template-columns: 1fr auto !important;
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
          <div style={styles.title}>ChatYX Setup</div>

          <div style={styles.channelCard}>
            <div style={styles.channelRow}>
              <input
                type="text"
                value={channel()}
                onInput={(e) => setChannel(e.currentTarget.value)}
                placeholder="Введите название канала"
                style={styles.channelInput}
              />
            </div>
          </div>

          <div class="setup-main-grid" style={styles.mainGrid}>
            <div style={styles.leftPane}>
              <section style={styles.sectionCard}>
                <h3 style={styles.sectionTitle}>Typography</h3>
                <div style={styles.sectionHint}>
                  Размер, шрифт и базовый масштаб элементов сообщения.
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
                <h3 style={styles.sectionTitle}>Overlay Style</h3>
                <div style={styles.sectionHint}>
                  Визуальное оформление контейнера, fade и stroke/shadow.
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
                <h3 style={styles.sectionTitle}>Message Behavior</h3>
                <div style={styles.sectionHint}>
                  Анимация, переносы, направление и общее поведение строк.
                </div>
                {renderToggleRows(behaviorToggles, {
                  toggleRow: { ...styles.toggleRow },
                  toggleLabelWrap: styles.toggleLabelWrap,
                  settingLabel: styles.settingLabel,
                  settingHint: styles.settingHint,
                })}
              </section>

              <section style={styles.sectionCard}>
                <h3 style={styles.sectionTitle}>Content & Badges</h3>
                <div style={styles.sectionHint}>
                  Что показывать в сообщениях и какие типы badge/emote-данных включать.
                </div>
                {renderToggleRows(contentToggles, {
                  toggleRow: { ...styles.toggleRow },
                  toggleLabelWrap: styles.toggleLabelWrap,
                  settingLabel: styles.settingLabel,
                  settingHint: styles.settingHint,
                })}
              </section>

              <section style={styles.sectionCard}>
                <h3 style={styles.sectionTitle}>Bots & Filters</h3>
                <div style={styles.sectionHint}>
                  Список известных ботов можно править прямо здесь, как в генераторе-панели.
                </div>

                <div class="setup-bot-row" style={styles.botHeader}>
                  <div style={styles.botLabelWrap}>
                    <div style={styles.settingLabel}>Список ботов</div>
                    <div style={styles.botSwitchRow}>
                      <SetupSwitch checked={bots()} onChange={setBots} />
                      <span>Показывать ботов</span>
                    </div>
                  </div>
                  <textarea
                    value={botNames()}
                    onInput={(e) => setBotNames(e.currentTarget.value)}
                    placeholder={"bot1, bot2\nbot3 bot4"}
                    style={styles.textarea}
                  />
                </div>

                <div class="setup-control-row" style={styles.controlRow}>
                  <div style={styles.controlLabelWrap}>
                    <div style={styles.settingLabel}>Только один чаттер</div>
                    <div style={styles.settingHint}>
                      Оставить в overlay только сообщения одного пользователя.
                    </div>
                  </div>
                  <div style={styles.controlSlot}>
                    <input
                      type="text"
                      value={singleChatter()}
                      onInput={(e) => setSingleChatter(e.currentTarget.value)}
                      placeholder="username"
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.sectionHint}>FFZ bot + Twitch badge</div>
                {renderToggleRows(ffzToggles, {
                  toggleRow: { ...styles.toggleRow },
                  toggleLabelWrap: styles.toggleLabelWrap,
                  settingLabel: styles.settingLabel,
                  settingHint: styles.settingHint,
                })}
              </section>
            </div>

            <div style={styles.previewPane}>
              <div class="setup-preview-sticky" style={styles.previewSticky}>
                <div style={styles.previewLabel}>Превью</div>
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
              <div style={styles.sectionTitle}>Ваш URL готов</div>
              <div style={styles.resultBody}>{generatedUrl()}</div>
              <div style={styles.resultActions}>
                <button
                  onClick={copyToClipboard}
                  style={styles.primaryButton}
                >
                  Копировать URL
                </button>
                <a
                  href={generatedUrl()}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.secondaryButton}
                >
                  Открыть чат
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
