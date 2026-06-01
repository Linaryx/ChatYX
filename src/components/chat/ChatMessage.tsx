import { createMemo, onCleanup, onMount, type JSX } from "solid-js";
import type { ChatConfig } from "~/utils/chat";
import {
  colorService,
  type TwitchMessage,
  type ChatISIntegrationService,
} from "~/services/chat";
import { getFontFamily } from "~/styles/chatStyles";
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
  service: ChatISIntegrationService;
  animationDurationMs: number;
};

const CSS_COLOR_PATTERN =
  /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|[a-zA-Z]{1,30})$/;

function safeCssColor(color: string, fallback = "#e6eef7") {
  return CSS_COLOR_PATTERN.test(color) ? color : fallback;
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
  const { message, config, service } = props;
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
    integrationPaint || colorService.calculatePaintCSS(message.username);
  const userColor = safeCssColor(message.color || "#e6eef7");

  const messageStyle: JSX.CSSProperties = {
    "font-family": getFontFamily(config),
    "word-wrap": "break-word",
    "--chat-message-enter-duration": `${props.animationDurationMs}ms`,
  };

  let nickStyle = "font-weight: 800;";
  let paintClasses = "";
  let paintAttributes: Record<string, string> = {};

  if (paintCSS && typeof paintCSS === "object" && paintCSS.useGlobalCSS) {
    paintClasses = "chatis-seventv-paint";
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

  onMount(() => {
    if (!props.config.animate || !rootRef) return;

    rootRef.classList.add("message-enter");
    animationTimer = window.setTimeout(() => {
      rootRef?.classList.remove("message-enter");
      animationTimer = undefined;
    }, props.animationDurationMs + 40);
  });

  onCleanup(() => {
    if (animationTimer !== undefined) window.clearTimeout(animationTimer);
  });

  return (
    <div
      ref={(element) => {
        rootRef = element;
      }}
      class="chat_line"
      classList={{
        "gigantified-emote": message.isGigantifiedEmote,
      }}
      style={messageStyle}
      data-nick={message.username}
      data-time={message.timestamp.getTime()}
      data-id={message.id}
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
      <ChatBadges message={message} config={config} service={service} />
      <ChatNick
        message={message}
        nickStyle={nickStyle}
        paintClasses={paintClasses}
        paintAttributes={paintAttributes}
        colonColor={has7tvPaint ? "#fff" : userColor}
        isAction={isAction}
        uppercase={config.smallCaps}
      />
      <ChatText
        message={{ ...message, message: processedMessage }}
        config={config}
        service={service}
        color={messageTextColor}
      />
    </div>
  );
};
