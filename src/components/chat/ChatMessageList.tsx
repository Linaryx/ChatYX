import { For, Show } from "solid-js";
import type { ChatConfig } from "~/utils/chat";
import type { TwitchMessage, ChatISIntegrationService } from "~/services/chat";
import { ChatMessage } from "~/components/chat/ChatMessage";

type ChatMessageListProps = {
  messages: TwitchMessage[];
  config: ChatConfig | null;
  service: ChatISIntegrationService | null;
  animatedIds: Set<string>;
  animationDurationMs: number;
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
            animated={props.animatedIds.has(message.id)}
            animationDurationMs={props.animationDurationMs}
          />
        )}
      </For>
    </Show>
  );
};
