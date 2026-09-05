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
  let flowObserver: MutationObserver | undefined;
  let flowInvertFrame: number | undefined;
  let flowPlayFrame: number | undefined;
  let flowCleanupTimer: number | undefined;
  const knownMessageIds = new Set<string>();
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

    const playFlow = (pending: HTMLElement[]) => {
      if (pending.length === 0) return;
      flowPlayFrame = window.requestAnimationFrame(() => {
        flowPlayFrame = undefined;
        for (const element of pending) {
          if (!element.isConnected) continue;
          element.style.transition = `transform ${props.animationDurationMs}ms cubic-bezier(0.16, 1, 0.3, 1)`;
          element.style.transform = "";
        }
        flowCleanupTimer = window.setTimeout(() => {
          for (const element of pending) {
            if (element.isConnected) element.style.transition = "";
          }
          flowCleanupTimer = undefined;
        }, props.animationDurationMs + 50);
      });
    };

    const invertFlow = () => {
      const config = props.config;
      if (
        config?.animation !== "flow" ||
        config.horizontal ||
        config.reverseLineOrder ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      if (flowInvertFrame !== undefined) {
        window.cancelAnimationFrame(flowInvertFrame);
      }
      if (flowPlayFrame !== undefined) {
        window.cancelAnimationFrame(flowPlayFrame);
        flowPlayFrame = undefined;
      }
      if (flowCleanupTimer !== undefined) {
        window.clearTimeout(flowCleanupTimer);
        flowCleanupTimer = undefined;
      }

      flowInvertFrame = window.requestAnimationFrame(() => {
        flowInvertFrame = undefined;

        const newIds = orderedMessages()
          .map((m) => m.id)
          .filter((id) => !knownMessageIds.has(id));
        if (newIds.length === 0) return;

        const addedHeight = newIds.reduce((total, id) => {
          const el = container.querySelector<HTMLElement>(`[data-id="${id}"]`);
          return total + (el?.offsetHeight || el?.getBoundingClientRect().height || 0);
        }, 0);
        if (addedHeight < 0.5) return;

        const existing = Array.from(
          container.querySelectorAll<HTMLElement>(".chat_line"),
        ).filter((el) => el.isConnected && !newIds.includes(el.dataset.id ?? ""));
        if (existing.length === 0) return;

        for (const id of newIds) knownMessageIds.add(id);

        for (const element of existing) {
          element.style.transition = "none";
          element.style.transform = `translate3d(0, ${addedHeight}px, 0)`;
        }
        playFlow(existing);
      });
    };

    flowObserver = new MutationObserver(invertFlow);
    flowObserver.observe(container, { childList: true });
  });

  onCleanup(() => {
    cleanupImageFallback?.();
    flowObserver?.disconnect();
    if (flowInvertFrame !== undefined) {
      window.cancelAnimationFrame(flowInvertFrame);
    }
    if (flowPlayFrame !== undefined) {
      window.cancelAnimationFrame(flowPlayFrame);
    }
    if (flowCleanupTimer !== undefined) {
      window.clearTimeout(flowCleanupTimer);
    }
  });

  // Restored history and the initial preview batch arrive as one bulk flush.
  // They render without an entry animation; the flag flips in a microtask so
  // every item created in the same synchronous flush sees the same value.
  let firstBatchDone = false;
  let firstBatchScheduled = false;

  return (
    <Show when={props.config && props.service}>
      <For each={orderedMessages()}>
        {(message) => {
          const animateEntry = firstBatchDone;
          if (!firstBatchDone && !firstBatchScheduled) {
            firstBatchScheduled = true;
            queueMicrotask(() => {
              firstBatchScheduled = false;
              firstBatchDone = true;
            });
          }
          return (
            <ChatMessage
              message={message}
              config={props.config!}
              service={props.service!}
              animationDurationMs={props.animationDurationMs}
              onExpired={props.onMessageExpired}
              animateEntry={animateEntry}
            />
          );
        }}
      </For>
    </Show>
  );
};
