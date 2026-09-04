import { createMemo, For, Show, onCleanup, onMount } from "solid-js";
import type { ChatConfig } from "~/utils/chat";
import type { TwitchMessage, ChatPresentationService } from "~/services/chat";
import { ChatMessage } from "~/components/chat/ChatMessage";
import { installMessageImageFallback } from "~/utils/chat/messageImageFallback";
import { shouldHideLinkedReward } from "~/utils/chat/linkUtils";

type ChatMessageListProps = {
  messages: TwitchMessage[];
  config: ChatConfig | null;
  service: ChatPresentationService | null;
  animationDurationMs: number;
  onMessageExpired?: (messageId: string) => void;
};

export const ChatMessageList = (props: ChatMessageListProps) => {
  let cleanupImageFallback: (() => void) | undefined;
  const orderedMessages = createMemo(() => {
    const config = props.config;
    if (!config) return props.messages;

    const messages = props.messages.filter(
      (message) => !shouldHideLinkedReward(message, config),
    );
    const useFlowStack =
      config.animation === "flow" &&
      !config.horizontal &&
      !config.reverseLineOrder;
    return config.reverseLineOrder || useFlowStack ? messages.reverse() : messages;
  });

  onMount(() => {
    const container = document.getElementById("chat_container");
    if (!container) return;

    cleanupImageFallback = installMessageImageFallback(container);
  });

  onCleanup(() => {
    cleanupImageFallback?.();
  });

  return (
    <Show when={props.config && props.service}>
      <For each={orderedMessages()}>
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
