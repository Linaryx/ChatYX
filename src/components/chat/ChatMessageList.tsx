import { For, Show, onCleanup, onMount } from "solid-js";
import type { ChatConfig } from "~/utils/chat";
import type { TwitchMessage, ChatPresentationService } from "~/services/chat";
import { ChatMessage } from "~/components/chat/ChatMessage";
import { installMessageImageFallback } from "~/utils/chat/messageImageFallback";

type ChatMessageListProps = {
  messages: TwitchMessage[];
  config: ChatConfig | null;
  service: ChatPresentationService | null;
  animationDurationMs: number;
  onMessageExpired?: (messageId: string) => void;
};

export const ChatMessageList = (props: ChatMessageListProps) => {
  let cleanupImageFallback: (() => void) | undefined;

  onMount(() => {
    const container = document.getElementById("chat_container");
    if (container) {
      cleanupImageFallback = installMessageImageFallback(container);
    }
  });

  onCleanup(() => cleanupImageFallback?.());

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
