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
  let flowFrame: number | undefined;
  let scrollFrame: number | undefined;
  let scrollStart: number | undefined;
  let scrollTarget: number | undefined;
  let scrollStartTime: number | undefined;
  const orderedMessages = createMemo(() => {
    const config = props.config;
    if (!config) return props.messages;

    const messages = props.messages.filter(
      (message) => !shouldHideLinkedReward(message, config),
    );
    return config.reverseLineOrder ? messages.reverse() : messages;
  });

  const stopScrollAnimation = () => {
    if (scrollFrame !== undefined) {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = undefined;
    }
    scrollStart = undefined;
    scrollTarget = undefined;
    scrollStartTime = undefined;
  };

  const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

  const animateScroll = (
    container: HTMLElement,
    delta: number,
    duration: number,
  ) => {
    const reverse = props.config?.reverseLineOrder ?? false;
    if (reverse || props.config?.horizontal) return;

    const now = performance.now();
    const currentTarget = scrollTarget ?? container.scrollTop;

    scrollStart = container.scrollTop;
    scrollTarget = Math.max(
      0,
      Math.min(
        currentTarget + delta,
        container.scrollHeight - container.clientHeight,
      ),
    );
    scrollStartTime = now;

    if (scrollFrame !== undefined) return;

    const step = () => {
      if (
        scrollStart === undefined ||
        scrollTarget === undefined ||
        scrollStartTime === undefined
      ) {
        scrollFrame = undefined;
        return;
      }

      const elapsed = performance.now() - scrollStartTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const value = scrollStart + (scrollTarget - scrollStart) * eased;
      container.scrollTop = value;

      if (progress < 1) {
        scrollFrame = window.requestAnimationFrame(step);
      } else {
        stopScrollAnimation();
      }
    };

    scrollFrame = window.requestAnimationFrame(step);
  };

  onMount(() => {
    const container = document.getElementById("chat_container");
    if (!container) return;

    cleanupImageFallback = installMessageImageFallback(container);

    const isFlow = () => props.config?.animation === "flow";
    const reduceMotion = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scheduleFlow = () => {
      if (flowFrame !== undefined) return;
      flowFrame = window.requestAnimationFrame(() => {
        flowFrame = undefined;
        if (!isFlow() || reduceMotion()) return;

        const added = Array.from(
          container.querySelectorAll<HTMLElement>(".chat_line.message-enter"),
        ).at(-1);
        if (!added) return;

        const addedRect = added.getBoundingClientRect();
        const addedHeight = added.offsetHeight;
        const containerRect = container.getBoundingClientRect();
        const isAtBottom =
          container.scrollTop + container.clientHeight >=
          container.scrollHeight - 2;

        if (
          isAtBottom &&
          addedRect.bottom > containerRect.top &&
          addedRect.top < containerRect.bottom
        ) {
          animateScroll(container, addedHeight, props.animationDurationMs);
        }
      });
    };

    flowObserver = new MutationObserver(scheduleFlow);
    flowObserver.observe(container, { childList: true });
  });

  onCleanup(() => {
    cleanupImageFallback?.();
    flowObserver?.disconnect();
    if (flowFrame !== undefined) window.cancelAnimationFrame(flowFrame);
    stopScrollAnimation();
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
