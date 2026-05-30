import { createMemo, type JSX } from "solid-js";
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

type ChatMessageProps = {
  message: TwitchMessage;
  config: ChatConfig;
  service: ChatISIntegrationService;
  animated: boolean;
  animationDurationMs: number;
};

const CSS_COLOR_PATTERN =
  /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|[a-zA-Z]{1,30})$/;

function safeCssColor(color: string, fallback = "#e6eef7") {
  return CSS_COLOR_PATTERN.test(color) ? color : fallback;
}

export const ChatMessage = (props: ChatMessageProps) => {
  const { message, config, service } = props;

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
  const isAnimated = createMemo(() => props.config.animate && props.animated);

  return (
    <div
      class="chat_line"
      classList={{ "message-enter": isAnimated() }}
      style={messageStyle}
      data-nick={message.username}
      data-time={message.timestamp.getTime()}
      data-id={message.id}
    >
      <ChatBadges message={message} config={config} service={service} />
      <ChatNick
        message={message}
        nickStyle={nickStyle}
        paintClasses={paintClasses}
        paintAttributes={paintAttributes}
        colonColor={has7tvPaint ? "#fff" : userColor}
        isAction={isAction}
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
