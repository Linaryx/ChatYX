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

function currentTransformY(element: HTMLElement): number {
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === "none") return 0;
  try {
    return new DOMMatrixReadOnly(transform).m42 || 0;
  } catch {
    const match = transform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
    const parsed = match ? Number.parseFloat(match[1] ?? "") : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

export const ChatMessageList = (props: ChatMessageListProps) => {
  let cleanupImageFallback: (() => void) | undefined;
  let flowObserver: MutationObserver | undefined;
  let flowReconciliationFrame: number | undefined;
  let flowStartFrame: number | undefined;
  let flowCleanupTimer: number | undefined;
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

    let flowPending: HTMLElement[] = [];

    const playFlow = () => {
      flowReconciliationFrame = undefined;
      const shifted = flowPending;
      flowPending = [];
      if (shifted.length === 0) return;
      flowStartFrame = window.requestAnimationFrame(() => {
        flowStartFrame = undefined;
        for (const element of shifted) {
          if (!element.isConnected) continue;
          element.style.transition = `transform ${props.animationDurationMs}ms cubic-bezier(0.16, 1, 0.3, 1)`;
          element.style.transform = "";
        }

        flowCleanupTimer = window.setTimeout(() => {
          for (const element of shifted) {
            if (element.isConnected) element.style.transition = "";
          }
          flowCleanupTimer = undefined;
        }, props.animationDurationMs + 50);
      });
    };

    const scheduleFlowPlay = () => {
      if (flowReconciliationFrame !== undefined) return;
      flowReconciliationFrame = window.requestAnimationFrame(playFlow);
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

      // Cancel a not-yet-started play so rapid messages accumulate into one.
      if (flowStartFrame !== undefined) {
        window.cancelAnimationFrame(flowStartFrame);
        flowStartFrame = undefined;
      }
      if (flowCleanupTimer !== undefined) {
        window.clearTimeout(flowCleanupTimer);
        flowCleanupTimer = undefined;
      }

      const added = Array.from(
        container.querySelectorAll<HTMLElement>(".chat_line.message-enter"),
      ).filter((element) => element.isConnected);
      if (added.length === 0) return;

      // The new row height is only known after layout, so measure the real
      // inserted rows instead of predicting it. In the reversed flow stack
      // every visible row shifts by exactly this amount.
      const addedHeight = added.reduce((total, element) => {
        const height =
          element.offsetHeight || element.getBoundingClientRect().height || 0;
        return total + height;
      }, 0);
      if (addedHeight < 0.5) return;

      const existing = Array.from(
        container.querySelectorAll<HTMLElement>(".chat_line:not(.message-enter)"),
      ).filter((element) => element.isConnected);
      if (existing.length === 0) return;

      // Run synchronously inside the mutation callback (before paint), so no
      // uncorrected frame is ever rendered.
      for (const element of existing) {
        const remaining = currentTransformY(element);
        element.style.transition = "none";
        element.style.transform = `translate3d(0, ${remaining + addedHeight}px, 0)`;
      }
      flowPending = existing;
      scheduleFlowPlay();
    };

    flowObserver = new MutationObserver(invertFlow);
    flowObserver.observe(container, { childList: true });
  });

  onCleanup(() => {
    cleanupImageFallback?.();
    flowObserver?.disconnect();
    if (flowReconciliationFrame !== undefined) {
      window.cancelAnimationFrame(flowReconciliationFrame);
    }
    if (flowStartFrame !== undefined) {
      window.cancelAnimationFrame(flowStartFrame);
    }
    if (flowCleanupTimer !== undefined) {
      window.clearTimeout(flowCleanupTimer);
    }
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
