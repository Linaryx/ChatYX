import type { JSX } from "solid-js";
import type { ChatConfig } from "~/config/chatUrlParams";
import type { TwitchMessage, ChatPresentationService } from "~/services/chat";
import { renderMessageWithEmotes } from "./renderMessageContent";
import { networkClient } from "~/services/network/networkClient";

type ChatTextProps = {
  message: TwitchMessage;
  displayText?: string;
  config: ChatConfig;
  service: ChatPresentationService;
  color: string;
  fontWeight?: string;
};

export const ChatText = (props: ChatTextProps): JSX.Element => {
  return (
    <span
      class="message"
      style={{
        color: props.color,
        "font-weight": props.fontWeight ?? "800",
      }}
    >
      {renderMessageWithEmotes(props.message, props.config, props.service, {
        displayText: props.displayText,
        resolveUrl: networkClient.resolveHttpUrl,
      })}
    </span>
  );
};
