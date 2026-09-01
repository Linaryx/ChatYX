import type { TwitchEvent } from "~/services/chat";

const CSS_COLOR_PATTERN =
  /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|[a-zA-Z]{1,30})$/;

type ChatEventStyleInput = {
  readonly event: TwitchEvent | undefined;
  readonly fallbackAccent: string;
  readonly backgroundOpacity: number;
};

export type ChatEventStyleVariables = Readonly<Record<string, string>>;

function safeCssColor(color: string, fallback: string): string {
  return CSS_COLOR_PATTERN.test(color) ? color : fallback;
}

export function getChatEventStyleVariables(
  input: ChatEventStyleInput,
): ChatEventStyleVariables {
  const fallbackAccent = safeCssColor(input.fallbackAccent, "#9146ff");
  const opacity = Number.isFinite(input.backgroundOpacity)
    ? Math.min(Math.max(input.backgroundOpacity, 0), 100)
    : 0;
  const variables: Record<string, string> = {
    "--chat-event-fallback-accent": fallbackAccent,
    "--chat-event-background-opacity": `${opacity}%`,
  };

  if (input.event?.type === "announcement") {
    variables["--chat-event-accent"] = safeCssColor(
      input.event.color || fallbackAccent,
      fallbackAccent,
    );
  }

  return variables;
}
