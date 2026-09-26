import type { TwitchEvent } from "~/services/chat";
import {
  DEFAULT_EVENT_COLORS,
  getEventColorField,
  normalizeEventColor,
  type EventColorConfig,
} from "~/config/eventColors";

type ChatEventStyleInput = {
  readonly event: TwitchEvent | undefined;
  readonly colors: EventColorConfig;
  readonly opacity: number;
};

export type ChatEventStyleVariables = Readonly<Record<string, string>>;

export function getChatEventStyleVariables(
  input: ChatEventStyleInput,
): ChatEventStyleVariables {
  const field = getEventColorField(input.event);
  return {
    "--chat-event-color": normalizeEventColor(
      input.colors[field],
      DEFAULT_EVENT_COLORS[field],
    ),
    "--chat-event-opacity": `${Math.min(Math.max(input.opacity, 0), 100)}%`,
  };
}
