import { For, Show } from "solid-js";
import type { ChatConfig } from "~/utils/chat";
import type { TwitchMessage, ChatISIntegrationService } from "~/services/chat";
import { ChatMessage } from "~/components/chat/ChatMessage";

type ChatMessageListProps = {
  messages: TwitchMessage[];
  config: ChatConfig | null;
  service: ChatISIntegrationService | null;
  animationDurationMs: number;
  onMessageExpired?: (messageId: string) => void;
};

export const ChatMessageList = (props: ChatMessageListProps) => {
  return (
    <Show when={props.config && props.service}>
      <For each={props.messages}>
        {(message) => (
          <ChatMessage
            message={message}
            config={props.config!}
            service={props.service!}
            animationDurationMs={props.animationDurationMs}
            onExpired={props.onMessageExpired}
          />
        )}
      </For>
    </Show>
  );
};
