import { For, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { Title } from "@solidjs/meta";
import { Navigate } from "@solidjs/router";
import { ChatMessage } from "~/components/chat/ChatMessage";
import {
  ChatPresentationService,
  createChatPresentationConfig,
  mentionStyleService,
  type TwitchEvent,
  type TwitchMessage,
} from "~/services/chat";
import {
  DEFAULT_CHAT_CONFIG,
  type ChatConfig,
} from "~/config/chatUrlParams";
import {
  generateShadowStyles,
  generateSizeStyles,
  generateStrokeStyles,
  generateVariantStyles,
} from "~/styles/chatStyles";
import "~/styles/chat.css";
import "./messages.css";

type DevCase = {
  title: string;
  message: TwitchMessage;
};

const DEV_STYLE_ID = "chat-dev-message-style-overrides";
const DEV_SCROLL_CLASS = "message-style-dev-scroll";
const DEV_THEME_CLASS = "dark";
const DEV_EMOTE_URL =
  "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0";

function deterministicEmotes(
  entries: Array<[string, { zero_width?: boolean; width?: number; height?: number }]>,
) {
  return new Map(
    entries.map(([name, dimensions], index) => [
      name,
      {
        id: `dev-emote-${index}`,
        name,
        source: "7tv",
        url: DEV_EMOTE_URL,
        ...dimensions,
      },
    ]),
  );
}

function createDevConfig(patch: Partial<ChatConfig> = {}): ChatConfig {
  return {
    ...DEFAULT_CHAT_CONFIG,
    channel: "chatyxdev",
    fade: false,
    animation: "none",
    overlayBackgroundOpacity: 0,
    showHighlightedMessages: true,
    showChannelPointRewards: true,
    showGigantifiedEmotes: true,
    ...patch,
  };
}

function createMessage(
  id: string,
  username: string,
  text: string,
  patch: Partial<TwitchMessage> = {},
): TwitchMessage {
  return {
    id,
    username,
    displayName: username,
    message: text,
    color: patch.color || "#8A2BE2",
    badges: patch.badges || ["subscriber/12"],
    emotes: {},
    userType: "",
    isModerator: false,
    isSubscriber: true,
    timestamp: new Date(Date.now() + Number(id.replace(/\D/g, "") || 0)),
    userId: patch.userId || id,
    ...patch,
  };
}

function event(type: TwitchEvent["type"], label: string, patch: Partial<TwitchEvent> = {}): TwitchEvent {
  return { type, label, ...patch };
}

function createDevCases(): DevCase[] {
  const reply = {
    parentMsgId: "dev-parent",
    parentDisplayName: "oldviewer",
    parentUserLogin: "oldviewer",
    parentMsgBody:
      "Это старое сообщение для проверки reply-строки и длинной обрезки в превью.",
    parentUserId: "9000",
  };

  return [
    {
      title: "Обычное сообщение",
      message: createMessage("dev-1", "regularViewer", "Всем привет! Обычная строка чата"),
    },
    {
      title: "Ответ",
      message: createMessage("dev-2", "replyViewer", "Отвечаю на старое сообщение", { reply }),
    },
    {
      title: "/me action",
      message: createMessage("dev-3", "actionViewer", "\x01ACTION радуется красивому моменту\x01", {
        color: "#00FF7F",
      }),
    },
    {
      title: "Первое сообщение",
      message: createMessage("dev-4", "firstTimer", "Первый раз на стриме, уже нравится", {
        twitchEvent: event("first-message", "Впервые в чате"),
      }),
    },
    {
      title: "Выделенное сообщение",
      message: createMessage("dev-5", "highlightFan", "Можно ещё раз, но теперь специально?", {
        twitchEvent: event("highlighted-message", "Выделенное сообщение"),
        msgId: "highlighted-message",
      }),
    },
    {
      title: "Награда канала",
      message: createMessage("dev-7", "rewardUser", "Подсветите это сообщение", {
        twitchEvent: event("reward", "Награда", {
          detail: "Выделить сообщение",
          count: 5000,
        }),
        channelPointReward: {
          id: "dev-reward",
          title: "Выделить сообщение",
          prompt: "",
          cost: 5000,
        },
      }),
    },
    {
      title: "Награда канала длинная",
      message: createMessage("dev-7-long", "rewardUser", "Проверяем обрезку длинного названия", {
        twitchEvent: event("reward", "Награда", {
          detail: "Очень длинное название награды канала для проверки обрезки через многоточие",
          count: 5000,
        }),
        channelPointReward: {
          id: "dev-reward-long",
          title: "Очень длинное название награды канала для проверки обрезки через многоточие",
          prompt: "",
          cost: 5000,
        },
      }),
    },
    {
      title: "Подписка",
      message: createMessage("dev-8", "subViewer", "Спасибо за отличный эфир!", {
        twitchEvent: event("subscription", "Продление подписки", {
          detail: "subViewer подписан(а) уже 3 мес.",
        }),
      }),
    },
    {
      title: "Рейд",
      message: createMessage("dev-9", "raidLeader", "", {
        twitchEvent: event("raid", "Рейд", { detail: "raidLeader", count: 423 }),
      }),
    },
    {
      title: "Объявление Primary",
      message: createMessage("dev-10", "announcer", "Основное объявление для всего чата", {
        twitchEvent: event("announcement", "Объявление", {
          level: "PRIMARY",
          color: "#9147ff",
        }),
      }),
    },
    {
      title: "Объявление Blue",
      message: createMessage("dev-10-blue", "announcer", "Синее объявление для всего чата", {
        twitchEvent: event("announcement", "Объявление", {
          level: "BLUE",
          color: "#1f69ff",
        }),
      }),
    },
    {
      title: "Объявление Green",
      message: createMessage("dev-10-green", "announcer", "Зелёное объявление для всего чата", {
        twitchEvent: event("announcement", "Объявление", {
          level: "GREEN",
          color: "#00c800",
        }),
      }),
    },
    {
      title: "Объявление Orange",
      message: createMessage("dev-10-orange", "announcer", "Оранжевое объявление для всего чата", {
        twitchEvent: event("announcement", "Объявление", {
          level: "ORANGE",
          color: "#ff7621",
        }),
      }),
    },
    {
      title: "Объявление Purple",
      message: createMessage("dev-10-purple", "announcer", "Фиолетовое объявление для всего чата", {
        twitchEvent: event("announcement", "Объявление", {
          level: "PURPLE",
          color: "#9900fe",
        }),
      }),
    },
    {
      title: "Серия просмотров",
      message: createMessage("dev-11", "streakUser", "", {
        twitchEvent: event("watch-streak", "Новая серия просмотров!", {
          detail: "streakUser",
          count: 3,
          points: 350,
        }),
      }),
    },
    {
      title: "Серия просмотров + текст",
      message: createMessage("dev-12", "streakUser", "Уже третий стрим подряд здесь", {
        badges: ["moderator/1", "vip/1"],
        twitchEvent: event("watch-streak", "Новая серия просмотров!", {
          detail: "streakUser",
          count: 3,
          points: 350,
        }),
      }),
    },
    {
      title: "Гигантский эмоут",
      message: createMessage("dev-13", "powerUser", "Kappa", {
        emoteSnapshot: deterministicEmotes([["Kappa", { width: 28, height: 28 }]]),
        twitchEvent: event("power-up", "Гигантский эмоут", { count: 100 }),
        msgId: "gigantified-emote-message",
        isGigantifiedEmote: true,
      }),
    },
    {
      title: "Несколько emoji + модификатор",
      message: createMessage("dev-13-emoji", "emojiUser", "w! 😀😂"),
    },
    {
      title: "Поворот с резервом места",
      message: createMessage("dev-13-rotate", "rotateUser", "l! WideKappa", {
        emoteSnapshot: deterministicEmotes([
          ["WideKappa", { width: 56, height: 28 }],
        ]),
      }),
    },
    {
      title: "Модификаторы base + zero-width",
      message: createMessage(
        "dev-13-zw",
        "overlayUser",
        "h! Base p! Overlay",
        {
          emoteSnapshot: deterministicEmotes([
            ["Base", { width: 28, height: 28 }],
            ["Overlay", { zero_width: true, width: 56, height: 28 }],
          ]),
        },
      ),
    },
    {
      title: "Ссылка",
      message: createMessage("dev-14", "linkUser", "Расписание на неделю: https://example.com/schedule"),
    },
    {
      title: "YouTube marker",
      message: createMessage("dev-15", "youtubeUser", "Сообщение с YouTube-маркером", {
        platform: "youtube",
        platformBadges: [{ url: "https://www.youtube.com/s/desktop/3748dff5/img/favicon_32x32.png", title: "YouTube" }],
      }),
    },
  ];
}

function installDevChatStyles(config: ChatConfig) {
  let styleEl = document.getElementById(DEV_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = DEV_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = [
    generateSizeStyles(config.size as 1 | 2 | 3),
    config.shadow ? generateShadowStyles(config.shadow as 1 | 2 | 3) : "",
    config.stroke ? generateStrokeStyles(config.stroke as 1 | 2 | 3 | 4) : "",
    generateVariantStyles(config),
  ].join("\n");
}

export default function MessageStylesDevPage() {
  if (!import.meta.env.DEV) return <Navigate href="/" />;

  let containerRef: HTMLDivElement | undefined;
  let hadThemeClass = false;
  const [size, setSize] = createSignal<1 | 2 | 3>(1);
  const [horizontal, setHorizontal] = createSignal(false);
  const [highlightEvents, setHighlightEvents] = createSignal(true);
  const [showNames, setShowNames] = createSignal(true);
  const cases = createDevCases();
  const messages = cases.map((item) => item.message);
  const config = createMemo(() =>
    createDevConfig({
      size: size(),
      horizontal: horizontal(),
      highlightTwitchEvents: highlightEvents(),
      hideNames: !showNames(),
    }),
  );
  const service = new ChatPresentationService({
    ...createChatPresentationConfig(config()),
    fade: { enabled: false, timeout: 0, fadeOutDuration: 0 },
  });

  createEffect(() => {
    const cfg = config();
    installDevChatStyles(cfg);
    service.updateConfig({
      ...createChatPresentationConfig(cfg),
      fade: { enabled: false, timeout: 0, fadeOutDuration: 0 },
    });
  });

  onMount(() => {
    hadThemeClass = document.documentElement.classList.contains(DEV_THEME_CLASS);
    document.documentElement.classList.add(DEV_SCROLL_CLASS);
    document.body.classList.add(DEV_SCROLL_CLASS);
    document.documentElement.classList.add(DEV_THEME_CLASS);
    mentionStyleService.reset();
    messages.forEach((message) => mentionStyleService.registerMessageAuthor(message));
    if (containerRef) service.initializeLayout(containerRef);
  });

  onCleanup(() => {
    document.documentElement.classList.remove(DEV_SCROLL_CLASS);
    document.body.classList.remove(DEV_SCROLL_CLASS);
    if (!hadThemeClass) document.documentElement.classList.remove(DEV_THEME_CLASS);
    document.getElementById(DEV_STYLE_ID)?.remove();
    void service.cleanup();
  });

  return (
    <main class="message-style-dev">
      <Title>ChatYX • Message Styles</Title>
      <header class="message-style-dev__header">
        <div>
          <p class="message-style-dev__eyebrow">Dev preview</p>
          <h1>Стили сообщений</h1>
          <p>Все основные состояния чата в одном месте, на реальных компонентах оверлея.</p>
        </div>
        <div class="message-style-dev__controls" aria-label="Настройки превью">
          <button classList={{ active: size() === 1 }} onClick={() => setSize(1)}>S1</button>
          <button classList={{ active: size() === 2 }} onClick={() => setSize(2)}>S2</button>
          <button classList={{ active: size() === 3 }} onClick={() => setSize(3)}>S3</button>
          <button classList={{ active: horizontal() }} onClick={() => setHorizontal((value) => !value)}>Horizontal</button>
          <button classList={{ active: highlightEvents() }} onClick={() => setHighlightEvents((value) => !value)}>Event BG</button>
          <button classList={{ active: showNames() }} onClick={() => setShowNames((value) => !value)}>Names</button>
        </div>
      </header>

      <section class="message-style-dev__stage">
        <div class="message-style-dev__chat-shell">
          <div
            id="chat_container"
            ref={(element) => {
              containerRef = element;
            }}
            classList={{
              "layout-horizontal": horizontal(),
              "layout-vertical": !horizontal(),
              "layout-normal": true,
            }}
            data-connected="true"
          >
            <For each={cases}>
              {(item) => (
                <article class="message-style-dev__case">
                  <div class="message-style-dev__case-title">
                    <span>{item.title}</span>
                    <code>{item.message.twitchEvent?.type || "default"}</code>
                  </div>
                  <div class="message-style-dev__case-message">
                    <ChatMessage
                      message={item.message}
                      config={config()}
                      service={service}
                      animationDurationMs={0}
                    />
                  </div>
                </article>
              )}
            </For>
          </div>
        </div>
      </section>
    </main>
  );
}
