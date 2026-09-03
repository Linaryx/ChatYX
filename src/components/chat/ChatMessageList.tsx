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
  let flowResizeObserver: ResizeObserver | undefined;
  let flowFrame: number | undefined;
  let flowResizeTimeout: number | undefined;
  let flowPositions = new Map<HTMLElement, { left: number; top: number }>();
  const flowAnimations = new Map<HTMLElement, Animation>();
  const orderedMessages = createMemo(() => {
    const config = props.config;
    if (!config) return props.messages;

    const messages = props.messages.filter(
      (message) => !shouldHideLinkedReward(message, config),
    );
    return config.reverseLineOrder ? messages.reverse() : messages;
  });

  onMount(() => {
    const container = document.getElementById("chat_container");
    if (container) {
      cleanupImageFallback = installMessageImageFallback(container);
      const observedMessages = new Set<HTMLElement>();
      const capturePositions = () =>
        new Map(
          Array.from(observedMessages)
            .filter((element) => element.isConnected)
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return [element, { left: rect.left, top: rect.top }] as const;
            }),
        );

      const syncObservedMessages = () => {
        const messages = new Set(
          container.querySelectorAll<HTMLElement>(".chat_line"),
        );
        for (const element of observedMessages) {
          if (!messages.has(element)) {
            flowResizeObserver?.unobserve(element);
            observedMessages.delete(element);
          }
        }
        for (const element of messages) {
          if (!observedMessages.has(element)) {
            flowResizeObserver?.observe(element);
            observedMessages.add(element);
          }
        }
      };

      const scheduleFlowReconciliation = () => {
        if (flowFrame !== undefined) return;
        flowFrame = window.requestAnimationFrame(() => {
          flowFrame = undefined;
          const visualPositions = capturePositions();

          for (const animation of flowAnimations.values()) animation.cancel();
          const animatedElements = new Set(flowAnimations.keys());
          flowAnimations.clear();

          const nextPositions = capturePositions();
          if (props.config?.animation === "flow") {
            for (const [element, next] of nextPositions) {
              const previous = animatedElements.has(element)
                ? visualPositions.get(element)
                : flowPositions.get(element);
              if (!previous || typeof element.animate !== "function") continue;

              const x = previous.left - next.left;
              const y = previous.top - next.top;
              if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) continue;

              const animation = element.animate(
                [
                  { transform: `translate(${x}px, ${y}px)` },
                  { transform: "translate(0, 0)" },
                ],
                {
                  duration: props.animationDurationMs,
                  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                },
              );
              flowAnimations.set(element, animation);
              const forgetAnimation = () => {
                if (flowAnimations.get(element) === animation) {
                  flowAnimations.delete(element);
                }
              };
              animation.onfinish = forgetAnimation;
              animation.oncancel = forgetAnimation;
            }
          }

          flowPositions = nextPositions;
        });
      };

      syncObservedMessages();
      flowPositions = capturePositions();
      if ("ResizeObserver" in window) {
        flowResizeObserver = new ResizeObserver(() => {
          if (props.config?.animation !== "flow") return;
          if (flowResizeTimeout !== undefined) {
            window.clearTimeout(flowResizeTimeout);
          }
          flowResizeTimeout = window.setTimeout(() => {
            flowResizeTimeout = undefined;
            scheduleFlowReconciliation();
          }, 80);
        });
        for (const element of observedMessages) flowResizeObserver.observe(element);
      }
      flowObserver = new MutationObserver(() => {
        syncObservedMessages();
        scheduleFlowReconciliation();
      });
      flowObserver.observe(container, { childList: true });
    }
  });

  onCleanup(() => {
    cleanupImageFallback?.();
    flowObserver?.disconnect();
    flowResizeObserver?.disconnect();
    if (flowFrame !== undefined) window.cancelAnimationFrame(flowFrame);
    if (flowResizeTimeout !== undefined) window.clearTimeout(flowResizeTimeout);
    for (const animation of flowAnimations.values()) animation.cancel();
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
