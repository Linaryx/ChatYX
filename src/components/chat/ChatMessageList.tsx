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
  let flowPlayFrame: number | undefined;
  let flowCleanupTimer: number | undefined;
  const knownMessageIds = new Set<string>();
  // Badge/asset refreshes recreate a row with the same id; each id animates once.
  const animatedMessageIds = new Set<string>();
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
      const shifted = flowPending;
      flowPending = [];
      if (shifted.length === 0) return;
      flowPlayFrame = window.requestAnimationFrame(() => {
        flowPlayFrame = undefined;
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

    // Runs synchronously inside the mutation callback (before paint), so no
    // uncorrected frame is ever rendered: old rows are already held at their
    // prior visual position when the browser paints the new row.
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

      const newIds = orderedMessages()
        .filter((message) => message.restored !== true)
        .map((m) => m.id)
        .filter((id) => !knownMessageIds.has(id));
      // Asset/badge refreshes recreate a row with the same id: no new row,
      // no shift. A parked play keeps its scheduled start below.
      if (newIds.length === 0) return;

      // Seed the initial bulk too: without this every later arrival looks
      // new next to unseeded history and the shift below never runs.
      for (const id of newIds) knownMessageIds.add(id);

      const addedHeight = newIds.reduce((total, id) => {
        const el = container.querySelector<HTMLElement>(`[data-id="${id}"]`);
        return total + (el?.offsetHeight || el?.getBoundingClientRect().height || 0);
      }, 0);
      if (addedHeight < 0.5) return;

      const existing = Array.from(
        container.querySelectorAll<HTMLElement>(".chat_line"),
      ).filter((el) => el.isConnected && !newIds.includes(el.dataset.id ?? ""));
      if (existing.length === 0) return;

      // A new arrival during a running shift folds in: keep the remaining
      // offset so rows never jump backwards. Only now is it safe to drop
      // the previous cleanup timer.
      if (flowCleanupTimer !== undefined) {
        window.clearTimeout(flowCleanupTimer);
        flowCleanupTimer = undefined;
      }
      // A parked (not yet started) play is superseded by this larger shift.
      if (flowPlayFrame !== undefined) {
        window.cancelAnimationFrame(flowPlayFrame);
        flowPlayFrame = undefined;
      }
      for (const element of existing) {
        const remaining = currentTransformY(element);
        element.style.transition = "none";
        element.style.transform = `translate3d(0, ${remaining + addedHeight}px, 0)`;
      }
      flowPending = existing;
      playFlow();
    };

    flowObserver = new MutationObserver(invertFlow);
    flowObserver.observe(container, { childList: true });
  });

  onCleanup(() => {
    cleanupImageFallback?.();
    flowObserver?.disconnect();
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
          // Refreshes replace the message object (new identity), so Solid
          // recreates the row: replaying the entry slide there would push it
          // over its neighbour, so each id animates only on first arrival.
          const animateEntry = firstBatchDone && !animatedMessageIds.has(message.id);
          animatedMessageIds.add(message.id);
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
