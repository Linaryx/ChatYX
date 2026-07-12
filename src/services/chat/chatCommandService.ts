import type { TwitchMessage } from "./twitchService";
import { CHAT_COMMAND_DEVELOPER } from "~/config/chatCommands";

export type ChatCommandRole =
  | "viewer"
  | "moderator"
  | "lead_moderator"
  | "broadcaster";

export type ChatCommandName =
  | "refresh"
  | "reload"
  | "show"
  | "hide"
  | "clear"
  | "ping"
  | "test";

export type ParsedChatCommand = {
  name: ChatCommandName;
  args: string;
  targetChannels: string[];
};

const COMMAND_ALIASES: Record<string, ChatCommandName> = {
  refresh: "refresh",
  reload: "reload",
  show: "show",
  hide: "hide",
  clear: "clear",
  ping: "ping",
  test: "test",
};

function badgeNames(message: TwitchMessage): Set<string> {
  return new Set(
    message.badges.map((badge) => badge.split("/", 1)[0].toLowerCase()),
  );
}

export function resolveChatCommandRole(message: TwitchMessage): ChatCommandRole {
  const badges = badgeNames(message);
  if (badges.has("broadcaster")) return "broadcaster";
  if (badges.has("lead_moderator")) return "lead_moderator";
  if (badges.has("moderator") || message.isModerator) return "moderator";
  return "viewer";
}

export function parseChatCommand(input: string): ParsedChatCommand | null {
  const text = input.trim();

  if (/^!refreshoverlay(?:\s|$)/i.test(text)) {
    return buildParsedCommand("refresh", text.slice("!refreshoverlay".length));
  }
  if (/^!reloadchat(?:\s|$)/i.test(text)) {
    return buildParsedCommand("reload", text.slice("!reloadchat".length));
  }

  const match = text.match(/^!(?:chat|chatis|chatyx)\s+(\S+)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;

  const name = COMMAND_ALIASES[match[1].toLowerCase()];
  return name ? buildParsedCommand(name, match[2] || "") : null;
}

export function getAuthorizedChatCommand(
  message: TwitchMessage,
  activeChannel: string,
): ParsedChatCommand | null {
  const command = parseChatCommand(message.message);
  if (!command) return null;

  const normalizedActiveChannel = normalizeChannel(activeChannel);
  const fromDeveloperChannel =
    normalizeChannel(message.sourceChannel || "") === CHATYX_DEVELOPER_CHANNEL &&
    normalizedActiveChannel !== CHATYX_DEVELOPER_CHANNEL;

  if (fromDeveloperChannel) {
    const isDeveloper =
      message.username.toLowerCase() === CHATYX_DEVELOPER_LOGIN &&
      message.userId === CHATYX_DEVELOPER_USER_ID;
    if (!isDeveloper || command.targetChannels.length === 0) return null;
    return targetsChannel(command.targetChannels, normalizedActiveChannel)
      ? command
      : null;
  }

  if (
    command.targetChannels.length > 0 &&
    !targetsChannel(command.targetChannels, normalizedActiveChannel)
  ) {
    return null;
  }
  if (resolveChatCommandRole(message) === "viewer") return null;
  return command;
}

export function isDeveloperChatMessage(
  message: TwitchMessage,
  activeChannel: string,
): boolean {
  return (
    normalizeChannel(message.sourceChannel || "") === CHATYX_DEVELOPER_CHANNEL &&
    normalizeChannel(activeChannel) !== CHATYX_DEVELOPER_CHANNEL
  );
}

export const CHATYX_DEVELOPER_CHANNEL = CHAT_COMMAND_DEVELOPER.channel;
const CHATYX_DEVELOPER_LOGIN = CHAT_COMMAND_DEVELOPER.login;
const CHATYX_DEVELOPER_USER_ID = CHAT_COMMAND_DEVELOPER.userId;

function buildParsedCommand(
  name: ChatCommandName,
  rawArgs: string,
): ParsedChatCommand {
  const targetMatch = rawArgs.match(/(?:^|\s)-c\s+([^\s]+)/i);
  const targetChannels = targetMatch
    ? targetMatch[1]
        .split(",")
        .map(normalizeChannel)
        .filter(Boolean)
    : [];
  const args = targetMatch
    ? `${rawArgs.slice(0, targetMatch.index)} ${rawArgs.slice((targetMatch.index || 0) + targetMatch[0].length)}`.trim()
    : rawArgs.trim();

  return { name, args, targetChannels };
}

function normalizeChannel(value: string): string {
  return value.trim().replace(/^#|^@/, "").toLowerCase();
}

function targetsChannel(targets: string[], activeChannel: string): boolean {
  return targets.includes("all") || targets.includes(activeChannel);
}

export function parseTestMessageCount(args: string): number {
  const count = Number.parseInt(args, 10);
  return Number.isFinite(count) && count > 0 ? Math.min(count, 50) : 5;
}

export class ChatCommandFeedback {
  private noticeElement: HTMLDivElement | null = null;
  private noticeTimer: number | null = null;

  showNotice(text: string, durationMs = 2500): void {
    if (typeof document === "undefined") return;
    this.clearNotice();

    const notice = document.createElement("div");
    notice.textContent = text;
    Object.assign(notice.style, {
      position: "fixed",
      left: "50%",
      bottom: "24px",
      transform: "translateX(-50%)",
      zIndex: "10001",
      padding: "10px 16px",
      borderRadius: "10px",
      background: "rgba(8, 8, 12, 0.86)",
      color: "#fff",
      font: "600 14px/1.3 system-ui, sans-serif",
      pointerEvents: "none",
    });
    document.body.append(notice);
    this.noticeElement = notice;
    this.noticeTimer = window.setTimeout(() => this.clearNotice(), durationMs);
  }

  destroy(): void {
    this.clearNotice();
  }

  private clearNotice(): void {
    if (this.noticeTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.noticeTimer);
    }
    this.noticeTimer = null;
    this.noticeElement?.remove();
    this.noticeElement = null;
  }
}
