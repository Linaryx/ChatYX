import {
  createMemo,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
  type JSX,
} from "solid-js";
import type { ChatConfig } from "~/utils/chat";
import { normalizeFontWeight } from "~/config/chatUrlParams";
import {
  sevenTVCosmeticsService,
  type TwitchMessage,
  type ChatPresentationService,
} from "~/services/chat";
import { getFontFamily } from "~/styles/chatStyles";
import { hasMessageEntryAnimation } from "~/utils/ui/animationUtils";
import { ChatBadges } from "~/components/chat/ChatBadges";
import { ChatNick } from "~/components/chat/ChatNick";
import { ChatText } from "~/components/chat/ChatText";
import {
  decodeParentMessageBody,
  formatReplyPreview,
} from "~/utils/chat/replyParser";

type ChatMessageProps = {
  message: TwitchMessage;
  config: ChatConfig;
  service: ChatPresentationService;
  animationDurationMs: number;
  onExpired?: (messageId: string) => void;
};

const CSS_COLOR_PATTERN =
  /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|[a-zA-Z]{1,30})$/;

function safeCssColor(color: string, fallback = "#e6eef7") {
  return CSS_COLOR_PATTERN.test(color) ? color : fallback;
}

function hexToRgba(color: string, opacity: number): string {
  const normalized = color.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "rgba(145, 70, 255, 0.22)";

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const alpha = Math.min(Math.max(opacity, 0), 100) / 100;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function formatEventCount(value: number | undefined): string {
  if (!Number.isFinite(value)) return "";
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function EventStar() {
  return (
    <svg
      class="chat-event-icon chat-event-star"
      viewBox="0 0 20 20"
      aria-label="Событие"
      role="img"
    >
      <path d="m10 1.5 2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8L10 1.5Z" />
    </svg>
  );
}

function stripLeadingMention(text: string) {
  return text.replace(/^@[\w][\w]{0,24}[\s,:]+/i, "").trimStart();
}

function getReplyText(message: TwitchMessage) {
  const reply = message.reply;
  if (!reply) return null;

  const author = reply.parentDisplayName || reply.parentUserLogin;
  const body = formatReplyPreview(
    stripLeadingMention(decodeParentMessageBody(reply.parentMsgBody)),
    180,
  );
  if (!author && !body) return null;

  return `В ответ ${author ? `@${author}` : ""}${body ? `: ${body}` : ""}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripReplyMention(message: TwitchMessage, text: string) {
  const reply = message.reply;
  if (!reply) return text;

  const names = [reply.parentUserLogin, reply.parentDisplayName]
    .filter(Boolean)
    .map((name) => escapeRegExp(name.trim()));
  if (names.length === 0) return text;

  const mentionPattern = new RegExp(`^@(?:${names.join("|")})[\\s,:]+`, "i");
  return text.replace(mentionPattern, "");
}

export const ChatMessage = (props: ChatMessageProps) => {
  const { message, service } = props;
  let rootRef: HTMLDivElement | undefined;
  let animationTimer: number | undefined;

  const actionPrefix = "\x01ACTION";
  const actionSuffix = "\x01";
  const isAction =
    message.message.startsWith(actionPrefix) &&
    message.message.endsWith(actionSuffix);
  let processedMessage = message.message;
  if (isAction) {
    processedMessage = processedMessage
      .slice(actionPrefix.length, -actionSuffix.length)
      .trim();
  }
  processedMessage = stripReplyMention(message, processedMessage);

  const integrationPaint = message.userId
    ? service.getUserPaint(message.userId, message.username)
    : null;

  const paintCSS =
    integrationPaint || sevenTVCosmeticsService.calculatePaintCSS(message.username);
  const userColor = safeCssColor(message.color || "#e6eef7");
  const visibleTwitchEvent = createMemo(() => {
    const event = message.twitchEvent;
    if (!event) return undefined;
    if (
      event.type === "highlighted-message" &&
      !props.config.showHighlightedMessages
    ) {
      return undefined;
    }
    if (event.type === "reward" && !props.config.showChannelPointRewards) {
      return undefined;
    }
    if (event.type === "power-up" && !props.config.showGigantifiedEmotes) {
      return undefined;
    }
    return event;
  });
  const styledTwitchEvent = createMemo(() => {
    const event = visibleTwitchEvent();
    return event?.type === "highlighted-message" ? undefined : event;
  });
  const fontWeight = createMemo(() => {
    const weight = normalizeFontWeight(props.config.fontWeight);
    return String(styledTwitchEvent() && props.config.twitchEventBold ? 900 : weight);
  });
  const nickFontWeight = createMemo(() =>
    String(
      styledTwitchEvent() && props.config.twitchEventBold
        ? 900
        : normalizeFontWeight(props.config.nickFontWeight),
    ),
  );
  const eventColor = createMemo(() =>
    safeCssColor(
      visibleTwitchEvent()?.color || props.config.twitchEventColor,
      "#9146ff",
    ),
  );

  const messageStyle = createMemo<JSX.CSSProperties>(() => ({
    "font-family": getFontFamily(props.config),
    "font-weight": fontWeight(),
    "word-wrap": "break-word",
    "--chat-message-enter-duration": `${props.animationDurationMs}ms`,
    "--chat-event-color": eventColor(),
    "--chat-event-background": hexToRgba(
      eventColor(),
      props.config.twitchEventBackgroundOpacity,
    ),
    "--chat-link-color": safeCssColor(props.config.linkColor, "#53b7ff"),
    "font-style": styledTwitchEvent() && props.config.twitchEventItalic
      ? "italic"
      : "normal",
  }));

  let nickStyle = "";
  let paintClasses = "";
  let paintAttributes: Record<string, string> = {};

  if (paintCSS && typeof paintCSS === "object" && paintCSS.useGlobalCSS) {
    paintClasses = "chatyx-seventv-paint";
    paintAttributes["data-seventv-paint-id"] = (paintCSS as { paintId: string }).paintId;
  } else if (integrationPaint) {
    nickStyle += ` ${integrationPaint}`;
  } else {
    nickStyle += ` color: ${userColor};`;
  }

  const has7tvPaint =
    Boolean(integrationPaint) ||
    (typeof paintCSS === "object" &&
      paintCSS !== null &&
      "useGlobalCSS" in paintCSS &&
      (paintCSS as { useGlobalCSS?: boolean }).useGlobalCSS);

  const messageTextColor = isAction ? userColor : "white";
  const replyText = createMemo(() => getReplyText(message));
  const showPlatformMarker = createMemo(() =>
    Boolean(props.config.channel.trim() && props.config.youtubeChannel.trim()),
  );

  onMount(() => {
    if (!rootRef) return;

    if (message.id) {
      props.service.scheduleMessageFade(rootRef, () => {
        if (props.onExpired) {
          props.onExpired(message.id);
        } else {
          rootRef?.remove();
        }
      });
    }

    if (hasMessageEntryAnimation(props.config.animation)) {
      rootRef.classList.add("message-enter");
      animationTimer = window.setTimeout(() => {
        rootRef?.classList.remove("message-enter");
        animationTimer = undefined;
      }, props.animationDurationMs + 40);
    }
  });

  onCleanup(() => {
    if (animationTimer !== undefined) window.clearTimeout(animationTimer);
    if (rootRef) props.service.cancelMessageFade(rootRef);
  });

  return (
    <div
      ref={(element) => {
        rootRef = element;
      }}
      class="chat_line"
      classList={{
        "gigantified-emote": Boolean(
          message.isGigantifiedEmote && props.config.showGigantifiedEmotes,
        ),
        "platform-marked": showPlatformMarker(),
        "chat-event": Boolean(visibleTwitchEvent()),
        "chat-event-highlight": Boolean(
          visibleTwitchEvent() && props.config.highlightTwitchEvents,
        ),
        [`chat-event-${visibleTwitchEvent()?.type}`]: Boolean(visibleTwitchEvent()),
      }}
      style={messageStyle()}
      data-nick={message.username}
      data-user-id={message.userId || ""}
      data-time={message.timestamp.getTime()}
      data-id={message.id}
      data-platform={message.platform || "twitch"}
      data-event={visibleTwitchEvent()?.type || undefined}
    >
      {replyText() && (
        <div class="reply_line" title={replyText() || undefined}>
          <svg
            class="reply_icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M9 10h2v2H9v-2Zm6 0h-2v2h2v-2Z" />
            <path
              fill-rule="evenodd"
              d="m12 22-3-3H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4l-3 3Zm-2.172-5L12 19.172 14.172 17H19V5H5v12h4.828Z"
              clip-rule="evenodd"
            />
          </svg>
          <span class="reply_text">{replyText()}</span>
        </div>
      )}
      <Show
        when={
          visibleTwitchEvent()?.type === "first-message" ||
          visibleTwitchEvent()?.type === "highlighted-message" ||
          visibleTwitchEvent()?.type === "power-up" ||
          visibleTwitchEvent()?.type === "announcement"
            ? undefined
            : visibleTwitchEvent()
        }
      >
        {(event) => (
          <span class="chat-event-summary">
            <Switch
              fallback={
                <>
                  <EventStar />
                  <span class="chat-event-label">{event().label}</span>
                  <Show when={event().detail}>
                    <span class="chat-event-detail">{event().detail}</span>
                  </Show>
                </>
              }
            >
              <Match when={event().type === "subscription"}>
                <EventStar />
              </Match>
              <Match when={event().type === "raid"}>
                <img
                  class="chat-event-icon"
                  src="https://static-cdn.jtvnw.net/emoticons/v2/62836/default/dark/3.0"
                  alt="Рейд"
                />
                <span class="chat-event-label">
                  {event().detail || event().label}
                </span>
                <span class="chat-event-detail">
                  проводит рейд
                  {event().count !== undefined
                    ? ` в компании ${formatEventCount(event().count)}`
                    : ""}
                  .
                </span>
              </Match>
              <Match when={event().type === "reward"}>
                <svg
                  class="chat-event-icon"
                  viewBox="0 0 24 24"
                  aria-label="Награда за баллы"
                  role="img"
                >
                  <path d="M12 7.2a4.8 4.8 0 0 1 4.8 4.8h-2.4a2.4 2.4 0 0 0-2.4-2.4V7.2Z" />
                  <path fill-rule="evenodd" d="M21.6 12A9.6 9.6 0 1 1 2.4 12a9.6 9.6 0 0 1 19.2 0Zm-2.4 0a7.2 7.2 0 1 1-14.4 0 7.2 7.2 0 0 1 14.4 0Z" clip-rule="evenodd" />
                </svg>
                <Show when={event().count !== undefined}>
                  <span class="chat-event-detail">
                    {formatEventCount(event().count)}
                  </span>
                </Show>
                <span class="chat-event-label">
                  {event().detail || event().label}
                </span>
              </Match>
            </Switch>
          </span>
        )}
      </Show>
      <Show when={!visibleTwitchEvent() || processedMessage.trim()}>
        <ChatBadges message={message} config={props.config} service={service} />
        <ChatNick
          message={message}
          nickStyle={nickStyle}
          fontWeight={nickFontWeight()}
          paintClasses={paintClasses}
          paintAttributes={paintAttributes}
          colonColor={has7tvPaint ? "#fff" : userColor}
          isAction={isAction}
          uppercase={props.config.smallCaps}
        />
        <ChatText
          message={{
            ...message,
            message: processedMessage,
            isGigantifiedEmote:
              message.isGigantifiedEmote && props.config.showGigantifiedEmotes,
          }}
          config={props.config}
          service={service}
          color={messageTextColor}
          fontWeight={fontWeight()}
        />
      </Show>
    </div>
  );
};
