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
import { getChatEventStyleVariables } from "~/styles/chatEventStyles";
import { networkClient } from "~/services/network/networkClient";
import { hasMessageEntryAnimation } from "~/utils/ui/animationUtils";
import { ChatBadges } from "~/components/chat/ChatBadges";
import { ChatNick } from "~/components/chat/ChatNick";
import { ChatText } from "~/components/chat/ChatText";
import {
  decodeParentMessageBody,
  formatReplyPreview,
} from "~/utils/chat/replyParser";
import { isReplyEligibleEvent } from "~/utils/chat/replyEligibility";

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

function formatEventCount(value: number | undefined): string {
  if (!Number.isFinite(value)) return "";
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function getSubscriptionMonths(detail: string | undefined): string | null {
  return detail?.match(/(\d+)\s*мес/i)?.[1] || null;
}

function formatWatchStreakCount(value: number | undefined): string {
  if (value === undefined) return "смотрит подряд";

  const abs = Math.abs(value);
  const lastTwo = abs % 100;
  const last = abs % 10;
  const unit = lastTwo >= 11 && lastTwo <= 14
    ? "стримов"
    : last === 1
      ? "стрим"
      : last >= 2 && last <= 4
        ? "стрима"
        : "стримов";

  return `${formatEventCount(value)} ${unit} подряд`;
}

function formatRaidViewers(value: number | undefined): string {
  if (value === undefined) return "";

  const abs = Math.abs(value);
  const lastTwo = abs % 100;
  const last = abs % 10;
  const unit = lastTwo >= 11 && lastTwo <= 14
    ? "зрителей"
    : last === 1
      ? "зрителем"
      : last >= 2 && last <= 4
        ? "зрителями"
        : "зрителями";

  return ` с ${formatEventCount(value)} ${unit}`;
}

function EventStar() {
  return (
    <svg
      class="chat-event-icon chat-event-star"
      viewBox="0 0 20 20"
      aria-hidden="true"
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
  let onEntryAnimationEnd: ((event: AnimationEvent) => void) | undefined;

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
  const normalizedFontWeight = createMemo(() =>
    normalizeFontWeight(props.config.fontWeight),
  );
  const fontWeight = createMemo(() => String(normalizedFontWeight()));
  const nickFontWeight = createMemo(() =>
    String(normalizeFontWeight(props.config.nickFontWeight)),
  );
  const eventFontWeight = createMemo(() =>
    String(
      styledTwitchEvent() && props.config.twitchEventBold
        ? Math.min(1000, normalizedFontWeight() + 100)
        : normalizedFontWeight(),
    ),
  );
  const messageStyle = createMemo<JSX.CSSProperties>(() => ({
    "font-family": getFontFamily(props.config),
    "font-weight": fontWeight(),
    "word-wrap": "break-word",
    "--chat-message-enter-duration": `${props.animationDurationMs}ms`,
    ...getChatEventStyleVariables({
      event: visibleTwitchEvent(),
      fallbackAccent: props.config.twitchEventColor,
      backgroundOpacity: props.config.twitchEventBackgroundOpacity,
    }),
    "--chat-event-font-weight": eventFontWeight(),
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
  const replyText = createMemo(() =>
    isReplyEligibleEvent(message.twitchEvent?.type)
      ? getReplyText(message)
      : null,
  );
  const hasEventMessageText = createMemo(() =>
    Boolean(visibleTwitchEvent() && processedMessage.trim()),
  );
  const eventSummary = createMemo(() => {
    const event = visibleTwitchEvent();
    if (!event) return undefined;
    if (!hasEventMessageText() || event.type === "watch-streak") return event;
    return undefined;
  });
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
      const clearEntryAnimation = () => {
        rootRef?.classList.remove("message-enter");
        rootRef?.removeEventListener("animationend", onEntryAnimationEnd!);
        animationTimer = undefined;
      };
      onEntryAnimationEnd = (event) => {
        if (event.target === rootRef) clearEntryAnimation();
      };
      rootRef.addEventListener("animationend", onEntryAnimationEnd);
      animationTimer = window.setTimeout(
        clearEntryAnimation,
        props.animationDurationMs + 100,
      );
    }
  });

  onCleanup(() => {
    if (animationTimer !== undefined) window.clearTimeout(animationTimer);
    if (rootRef && onEntryAnimationEnd) {
      rootRef.removeEventListener("animationend", onEntryAnimationEnd);
    }
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
          visibleTwitchEvent() &&
            props.config.highlightTwitchEvents &&
            !(message.isGigantifiedEmote && props.config.showGigantifiedEmotes),
        ),
        "chat-event-with-message": hasEventMessageText(),
        "chat-event-authored": hasEventMessageText(),
        "chat-event-notice": Boolean(
          visibleTwitchEvent() && !hasEventMessageText(),
        ),
        [`chat-event-${visibleTwitchEvent()?.type}`]: Boolean(visibleTwitchEvent()),
        [`chat-event-announcement-${visibleTwitchEvent()?.level?.toLowerCase()}`]:
          visibleTwitchEvent()?.type === "announcement" &&
          Boolean(visibleTwitchEvent()?.level),
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
      <Show when={eventSummary()}>
        {(event) => (
          <span class="chat-event-summary">
            <Switch
              fallback={
                <>
                  <EventStar />
                  <Show when={event().detail}>
                    <span class="chat-event-detail">{event().detail}</span>
                  </Show>
                </>
              }
            >
              <Match when={event().type === "subscription"}>
                <EventStar />
                <Show when={getSubscriptionMonths(event().detail)}>
                  {(months) => (
                    <span class="chat-subscription-months">{months()}</span>
                  )}
                </Show>
                <Show when={!hasEventMessageText() && event().detail}>
                  <span class="chat-event-detail">{event().detail}</span>
                </Show>
              </Match>
              <Match when={event().type === "watch-streak"}>
                <span class="chat-watch-streak">
                  <svg
                    class="chat-event-icon chat-watch-streak-gem"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 7.2a4.8 4.8 0 0 1 4.8 4.8h-2.4a2.4 2.4 0 0 0-2.4-2.4V7.2Z" />
                    <path
                      fill-rule="evenodd"
                      d="M21.6 12A9.6 9.6 0 1 1 2.4 12a9.6 9.6 0 0 1 19.2 0Zm-2.4 0a7.2 7.2 0 1 1-14.4 0 7.2 7.2 0 0 1 14.4 0Z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <Show when={event().points !== undefined}>
                    <span
                      class="chat-watch-streak-points"
                      title={`${formatEventCount(event().points)} баллов канала`}
                    >
                      +{formatEventCount(event().points)}
                    </span>
                  </Show>
                  <span class="chat-watch-streak-copy">
                    <Show
                      when={hasEventMessageText()}
                      fallback={
                        <>
                          <span
                            class="chat-watch-streak-user"
                            style={{ color: userColor }}
                          >
                            {message.displayName || event().detail}
                          </span>
                          {` · ${formatWatchStreakCount(event().count)}`}
                        </>
                      }
                    >
                      {`${event().points !== undefined ? " · " : ""}${formatWatchStreakCount(event().count)}`}
                    </Show>
                  </span>
                </span>
              </Match>
              <Match when={event().type === "raid"}>
                <img
                  class="chat-event-icon"
                  src={networkClient.resolveHttpUrl(
                    "https://static-cdn.jtvnw.net/emoticons/v2/62836/default/dark/3.0",
                    "rte",
                  )}
                  alt="Рейд"
                />
                <span class="chat-event-fact">
                  {event().detail || event().label}
                </span>
                <span class="chat-event-detail">
                  {`проводит рейд${formatRaidViewers(event().count)}!`}
                </span>
              </Match>
              <Match when={event().type === "reward"}>
                <svg
                  class="chat-event-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 7.2a4.8 4.8 0 0 1 4.8 4.8h-2.4a2.4 2.4 0 0 0-2.4-2.4V7.2Z" />
                  <path
                    fill-rule="evenodd"
                    d="M21.6 12A9.6 9.6 0 1 1 2.4 12a9.6 9.6 0 0 1 19.2 0Zm-2.4 0a7.2 7.2 0 1 1-14.4 0 7.2 7.2 0 0 1 14.4 0Z"
                    clip-rule="evenodd"
                  />
                </svg>
                <Show when={event().count !== undefined}>
                  <span class="chat-event-detail">
                    {formatEventCount(event().count)}
                  </span>
                </Show>
                <Show when={event().count !== undefined && event().detail}>
                  <span class="chat-event-separator">•</span>
                </Show>
                <Show when={event().detail}>
                  <span class="chat-event-fact">{event().detail}</span>
                </Show>
              </Match>
              <Match when={event().type === "announcement"}>
                <svg
                  class="chat-event-icon chat-event-announcement-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M3 9v6h4l2 4h3l-2-4h2l7 3V6l-7 3H3Zm2 2h7l5-2v6l-5-2H5v-2Z" />
                </svg>
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
