import type { JSX } from "solid-js";
import type { ChatConfig } from "~/utils/chat";
import type { TwitchMessage, ChatISIntegrationService } from "~/services/chat";
import { renderMessageWithEmotes } from "./renderMessageContent";

type ChatTextProps = {
  message: TwitchMessage;
  config: ChatConfig;
  service: ChatISIntegrationService;
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
      {renderMessageWithEmotes(props.message, props.config, props.service)}
    </span>
  );
};
