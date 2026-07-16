// Сервис для подключения к Twitch IRC

import { log, LOG_CATEGORIES } from "../../utils/logger";
import type { ReplyThread } from "../../types/replyThread";
import { parseReplyThread } from "../../utils/chat/replyParser";
import type { MessageTokenSnapshot } from "../../utils/chat/emojiUtils";

export type TwitchEventType =
  | "first-message"
  | "raid"
  | "subscription"
  | "highlighted-message"
  | "reward"
  | "power-up"
  | "announcement";

export type TwitchEvent = {
  type: TwitchEventType;
  label: string;
  detail?: string;
  level?: string;
  count?: number;
  color?: string;
};

const ANNOUNCEMENT_COLORS: Record<string, string> = {
  PRIMARY: "#9147ff",
  BLUE: "#1f69ff",
  GREEN: "#00c800",
  ORANGE: "#ff7621",
  PURPLE: "#9900fe",
};

export interface TwitchMessage {
  id: string;
  username: string;
  displayName: string;
  message: string;
  color: string;
  badges: string[];
  emotes: any;
  userType: string;
  isModerator: boolean;
  isSubscriber: boolean;
  timestamp: Date;
  userId?: string;
  reply?: ReplyThread;
  msgId?: string;
  customRewardId?: string;
  channelPointReward?: {
    id: string;
    title: string;
    prompt: string;
    cost: number;
  };
  platform?: "twitch" | "youtube";
  platformBadges?: Array<{
    url: string;
    title?: string;
  }>;
  isGigantifiedEmote?: boolean;
  // Cheer события
  bits?: number;
  cheerPrefix?: string;
  // Snapshot of emotes at message creation time (to prevent updates when emote sets change)
  emoteSnapshot?: Map<string, any>;
  tokenSnapshot?: MessageTokenSnapshot;
  sourceChannel?: string;
  twitchEvent?: TwitchEvent;
}

function getPrivMsgEvent(tags: Record<string, string>): TwitchEvent | undefined {
  if (tags["msg-id"] === "highlighted-message") {
    return {
      type: "highlighted-message",
      label: "Выделенное сообщение",
    };
  }

  if (tags["msg-id"] === "gigantified-emote-message") {
    const bits = Number.parseInt(tags.bits || "", 10);
    return {
      type: "power-up",
      label: "Гигантский эмоут",
      count: Number.isFinite(bits) ? bits : undefined,
    };
  }

  if (tags["custom-reward-id"]) {
    return { type: "reward", label: "Награда" };
  }

  if (tags["first-msg"] === "1") {
    return { type: "first-message", label: "Впервые в чате" };
  }

  return undefined;
}

function getUserNoticeEvent(
  msgId: string | undefined,
  tags: Record<string, string>,
  displayName: string,
): TwitchEvent | undefined {
  if (!msgId) return undefined;

  if (msgId === "raid") {
    const raider = tags["msg-param-displayName"] || displayName;
    const viewers = Number.parseInt(tags["msg-param-viewerCount"] || "", 10);
    return {
      type: "raid",
      label: "Рейд",
      detail: raider,
      count: Number.isFinite(viewers) ? viewers : undefined,
    };
  }

  if (msgId === "sub") {
    return {
      type: "subscription",
      label: "Новая подписка",
      detail: `${displayName} оформил(а) подписку`,
    };
  }

  if (msgId === "resub") {
    const months = tags["msg-param-cumulative-months"] || tags["msg-param-months"];
    return {
      type: "subscription",
      label: "Продление подписки",
      detail: months
        ? `${displayName} подписан(а) уже ${months} мес.`
        : `${displayName} продлил(а) подписку`,
    };
  }

  if (msgId === "subgift" || msgId === "anonsubgift") {
    const sender = msgId === "anonsubgift" ? "Аноним" : displayName;
    const recipient = tags["msg-param-recipient-display-name"];
    return {
      type: "subscription",
      label: "Подарочная подписка",
      detail: recipient
        ? `${sender} подарил(а) подписку для ${recipient}`
        : `${sender} подарил(а) подписку`,
    };
  }

  if (msgId === "submysterygift") {
    const count = tags["msg-param-mass-gift-count"] || "несколько";
    return {
      type: "subscription",
      label: "Подарки подписок",
      detail: `${displayName} подарил(а) ${count} подписок`,
    };
  }

  if (msgId === "giftpaidupgrade" || msgId === "rewardgift") {
    return {
      type: "subscription",
      label: "Подарочная подписка",
      detail: `${displayName} продолжил(а) подарочную подписку`,
    };
  }

  if (msgId === "announcement") {
    const level = (tags["msg-param-color"] || "PRIMARY").toUpperCase();
    return {
      type: "announcement",
      label: "Объявление",
      level,
      color: ANNOUNCEMENT_COLORS[level] || ANNOUNCEMENT_COLORS.PRIMARY,
    };
  }

  return undefined;
}

export class TwitchService {
  private static readonly TWITCH_COLORS = [
    "#FF0000", // Red
    "#0000FF", // Blue
    "#00FF00", // Green
    "#B22222", // FireBrick
    "#FF7F50", // Coral
    "#9ACD32", // YellowGreen
    "#FF4500", // OrangeRed
    "#2E8B57", // SeaGreen
    "#DAA520", // GoldenRod
    "#D2691E", // Chocolate
    "#5F9EA0", // CadetBlue
    "#1E90FF", // DodgerBlue
    "#FF69B4", // HotPink
    "#8A2BE2", // BlueViolet
    "#00FF7F", // SpringGreen
  ];
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private channel: string = "";
  private additionalChannels: string[] = [];
  private nick: string = "justinfan12345";
  private onMessageCallback: ((message: TwitchMessage) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onMessageDeleteCallback: ((messageId: string) => void) | null = null;
  private onUserBanCallback: ((username: string) => void) | null = null;
  private onChatClearCallback: (() => void) | null = null;
  private intentionallyDisconnected = false;
  private reconnectTimer: number | null = null;
  private readyFallbackTimer: number | null = null;
  private readySignaled = false;
  private joinAck = false;
  private names353Ack = false;
  private names366Ack = false;
  private roomstateAck = false;

  constructor() {
    // Инициализация
  }

  public connect(
    channel: string,
    onMessage: (message: TwitchMessage) => void,
    onConnect?: () => void,
    onDisconnect?: () => void,
    onMessageDelete?: (messageId: string) => void,
    onUserBan?: (username: string) => void,
    onChatClear?: () => void,
    additionalChannels: string[] = [],
  ) {
    // Проверяем, не подключены ли уже
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.intentionallyDisconnected = false;
    this.clearReconnectTimer();
    this.channel = channel.toLowerCase();
    this.additionalChannels = additionalChannels
      .map((value) => value.trim().replace(/^#/, "").toLowerCase())
      .filter((value) => value && value !== this.channel);
    this.onMessageCallback = onMessage;
    this.onConnectCallback = onConnect || null;
    this.onDisconnectCallback = onDisconnect || null;
    this.onMessageDeleteCallback = onMessageDelete || null;
    this.onUserBanCallback = onUserBan || null;
    this.onChatClearCallback = onChatClear || null;

    this.connectToTwitch();
  }

  private connectToTwitch() {
    try {
      this.resetReadyState();
      log.ws(LOG_CATEGORIES.TWITCH_IRC, "connect", { channel: this.channel });
      // Подключаемся к Twitch IRC через WebSocket
      this.ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

      this.ws.onopen = () => {
        log.info(LOG_CATEGORIES.TWITCH_IRC, "Connected successfully");
        this.authenticate();
        this.readyFallbackTimer = window.setTimeout(() => {
          this.signalReady("fallback timeout");
        }, 5000);
      };

      this.ws.onmessage = (event) => {
        log.ws(LOG_CATEGORIES.TWITCH_IRC, "receive", {
          data: event.data.substring(0, 100),
        });
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        log.ws(LOG_CATEGORIES.TWITCH_IRC, "disconnect", {});
        if (this.intentionallyDisconnected) {
          return;
        }
        this.onDisconnectCallback?.();
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        log.ws(LOG_CATEGORIES.TWITCH_IRC, "error", error);
      };
    } catch (error) {
      log.error(LOG_CATEGORIES.TWITCH_IRC, "Failed to connect to Twitch IRC", error);
      log.error(LOG_CATEGORIES.TWITCH_IRC, "Failed to connect", error);
      this.handleReconnect();
    }
  }

  private authenticate() {
    if (!this.ws) return;

    // Отправляем аутентификацию (анонимный доступ)
    this.ws.send(
      "CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands",
    );
    this.ws.send(`NICK ${this.nick}`);
    this.ws.send(`USER ${this.nick} 8 * :${this.nick}`);

    // Присоединяемся к каналу
    this.ws.send(`JOIN #${this.channel}`);
    for (const additionalChannel of this.additionalChannels) {
      this.ws.send(`JOIN #${additionalChannel}`);
    }
  }

  private handleMessage(data: string) {
    const lines = data.split("\r\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      this.trackReadyState(line);

      // Обрабатываем PING
      if (line.startsWith("PING")) {
        this.ws?.send("PONG :tmi.twitch.tv");
        continue;
      }

      const sourceChannel = this.parseSourceChannel(line);
      if (sourceChannel && sourceChannel !== this.channel) {
        if (
          this.additionalChannels.includes(sourceChannel) &&
          line.includes("PRIVMSG")
        ) {
          const message = this.parsePrivMsg(line);
          if (message) this.onMessageCallback?.(message);
        }
        continue;
      }

      // Обрабатываем CLEARMSG (удаление одного сообщения)
      if (line.includes("CLEARMSG")) {
        const tags = this.parseTagsFromLine(line);
        const targetMsgId = tags["target-msg-id"];
        if (targetMsgId) {
          log.event(LOG_CATEGORIES.TWITCH_IRC, "CLEARMSG", {
            messageId: targetMsgId,
          });
          this.onMessageDeleteCallback?.(targetMsgId);
        }
      }

      // Обрабатываем CLEARCHAT (бан/таймаут пользователя)
      if (line.includes("CLEARCHAT")) {
        const match = line.match(/CLEARCHAT #[^\s]+(?: :(.+))?$/);
        if (match?.[1]) {
          const username = match[1].trim();
          log.event(LOG_CATEGORIES.TWITCH_IRC, "CLEARCHAT", { username });
          this.onUserBanCallback?.(username);
        } else {
          log.event(LOG_CATEGORIES.TWITCH_IRC, "CLEARCHAT", { all: true });
          this.onChatClearCallback?.();
        }
      }

      // Обрабатываем PRIVMSG (сообщения чата)
      if (line.includes("PRIVMSG")) {
        const message = this.parsePrivMsg(line);
        if (message) {
          log.event(LOG_CATEGORIES.TWITCH_IRC, "PRIVMSG", {
            username: message.username,
            message: message.message,
          });
          this.onMessageCallback?.(message);
        }
      }

      // Обрабатываем USERNOTICE (включая Cheer события)
      if (line.includes("USERNOTICE")) {
        const message = this.parseUserNotice(line);
        if (message) {
          log.event(LOG_CATEGORIES.TWITCH_IRC, "USERNOTICE", {
            username: message.username,
            bits: message.bits,
          });
          this.onMessageCallback?.(message);
        }
      }

      // Обрабатываем JOIN
      if (line.includes("JOIN")) {
        const normalized = line.toLowerCase();
        const nick = this.nick.toLowerCase();
        const channel = `#${this.channel}`.toLowerCase();
        if (
          normalized.startsWith(`:${nick}!`) &&
          normalized.includes(` join ${channel}`)
        ) {
          log.info(
            LOG_CATEGORIES.TWITCH_IRC,
            `Successfully joined channel: ${this.channel}`,
          );
        }
      }
    }
  }

  private resetReadyState() {
    if (this.readyFallbackTimer !== null) {
      window.clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
    this.readySignaled = false;
    this.joinAck = false;
    this.names353Ack = false;
    this.names366Ack = false;
    this.roomstateAck = false;
  }

  private trackReadyState(line: string) {
    if (this.readySignaled) return;

    const normalized = line.toLowerCase();
    const channel = `#${this.channel}`.toLowerCase();
    const nick = this.nick.toLowerCase();

    if (!this.joinAck) {
      if (
        normalized.startsWith(`:${nick}!`) &&
        normalized.includes(` join ${channel}`)
      ) {
        this.joinAck = true;
      }
    }

    if (!this.names353Ack) {
      if (
        normalized.includes(` 353 ${nick} `) &&
        normalized.includes(channel)
      ) {
        this.names353Ack = true;
      }
    }

    if (!this.names366Ack) {
      if (
        normalized.includes(` 366 ${nick} `) &&
        normalized.includes(channel)
      ) {
        this.names366Ack = true;
      }
    }

    if (!this.roomstateAck) {
      if (normalized.includes(` roomstate ${channel}`)) {
        this.roomstateAck = true;
      }
    }

    if (
      this.joinAck &&
      this.names353Ack &&
      this.names366Ack &&
      this.roomstateAck
    ) {
      this.signalReady("JOIN+353+366+ROOMSTATE");
    }
  }

  private signalReady(reason: string) {
    if (this.readySignaled || this.intentionallyDisconnected) return;

    if (this.readyFallbackTimer !== null) {
      window.clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }

    this.readySignaled = true;
    this.reconnectAttempts = 0;
    log.info(LOG_CATEGORIES.TWITCH_IRC, `Channel join ready (${reason})`);
    this.onConnectCallback?.();
  }

  public parseMessageLine(line: string): TwitchMessage | null {
    if (line.includes("PRIVMSG")) {
      return this.parsePrivMsg(line);
    }

    if (line.includes("USERNOTICE")) {
      return this.parseUserNotice(line);
    }

    return null;
  }

  private parsePrivMsg(line: string): TwitchMessage | null {
    try {
      // Парсим IRC сообщение с правильным regex
      const match = line.match(
        /^@([^ ]+) (?:[^ ]+ )?PRIVMSG #([A-Za-z0-9_]+) :?(.+)$/,
      );
      if (!match) return null;

      const tags = this.parseTags(match[1]);
      const tagMap = new Map(Object.entries(tags));
      const sourceChannel = match[2].toLowerCase();
      const message = match[3];

      // Извлекаем username из IRC формата
      const usernameMatch = line.match(/:([^!]+)!/);
      const username = usernameMatch
        ? usernameMatch[1]
        : tags.username || tags["display-name"] || "unknown";

      // Очищаем username от лишних символов (только буквы, цифры и подчеркивания)
      const cleanUsername = username.replace(/[^\w]/g, "");

      // Дополнительная проверка - если username слишком длинный, берем из tags
      const finalUsername =
        cleanUsername.length > 50
          ? tags.username || tags["display-name"] || "unknown"
          : cleanUsername;

      const color =
        tags.color && tags.color.length > 0
          ? tags.color
          : this.getFallbackColor(finalUsername);
      const badges = this.parseBadges(tags.badges || "");

      return {
        id: tags.id || Date.now().toString(),
        username: finalUsername,
        displayName: tags["display-name"] || finalUsername,
        message: message,
        color,
        badges,
        emotes: this.parseEmotes(tags.emotes || ""),
        userType: tags["user-type"] || "",
        isModerator: tags.mod === "1",
        isSubscriber: tags.subscriber === "1",
        timestamp: new Date(),
        userId: tags["user-id"] || undefined,
        reply: parseReplyThread(tagMap) || undefined,
        msgId: tags["msg-id"] || undefined,
        customRewardId: tags["custom-reward-id"] || undefined,
        platform: "twitch",
        isGigantifiedEmote: tags["msg-id"] === "gigantified-emote-message",
        sourceChannel,
        twitchEvent: getPrivMsgEvent(tags),
      };
    } catch (error) {
      log.error(LOG_CATEGORIES.IRC, "Error parsing PRIVMSG", error);
      return null;
    }
  }

  private parseUserNotice(line: string): TwitchMessage | null {
    try {
      // Парсим USERNOTICE сообщения (включая Cheer события)
      const match = line.match(
        /^@([^ ]+) (?:[^ ]+ )?USERNOTICE #([A-Za-z0-9_]+)(?: :(.+))?$/,
      );
      if (!match) return null;

      const tags = this.parseTags(match[1]);
      const sourceChannel = match[2].toLowerCase();
      const message = match[3] || "";

      // Извлекаем username из IRC формата
      const usernameMatch = line.match(/:([^!]+)!/);
      const username = usernameMatch
        ? usernameMatch[1]
        : tags.login || tags["display-name"] || "twitch";

      // Очищаем username от лишних символов
      const cleanUsername = username.replace(/[^\w]/g, "");
      const finalUsername =
        cleanUsername.length > 50
          ? tags.username || tags["display-name"] || "unknown"
          : cleanUsername;

      // Проверяем, является ли это Cheer событием
      const msgId = tags["msg-id"];
      let bits: number | undefined;
      let cheerPrefix: string | undefined;

      if (msgId === "bitsbadgetier" || msgId?.startsWith("cheer")) {
        bits = parseInt(tags.bits || "0");
        cheerPrefix =
          tags["msg-param-celebration-display-name"] ||
          tags["msg-param-threshold"];
      }

      const color =
        tags.color && tags.color.length > 0
          ? tags.color
          : this.getFallbackColor(finalUsername);
      const displayName = tags["display-name"] || finalUsername;

      return {
        id: tags.id || Date.now().toString(),
        username: finalUsername,
        displayName,
        message: message,
        color,
        badges: this.parseBadges(tags.badges || ""),
        emotes: this.parseEmotes(tags.emotes || ""),
        userType: tags["user-type"] || "",
        isModerator: tags.mod === "1",
        isSubscriber: tags.subscriber === "1",
        timestamp: new Date(),
        userId: tags["user-id"] || undefined,
        msgId,
        customRewardId: tags["custom-reward-id"] || undefined,
        platform: "twitch",
        isGigantifiedEmote: msgId === "gigantified-emote-message",
        bits: bits,
        cheerPrefix: cheerPrefix,
        sourceChannel,
        twitchEvent: getUserNoticeEvent(msgId, tags, displayName),
      };
    } catch (error) {
      log.error(LOG_CATEGORIES.IRC, "Error parsing USERNOTICE", error);
      return null;
    }
  }

  private parseTags(tagsString: string): Record<string, string> {
    const tags: Record<string, string> = {};
    const pairs = tagsString.split(";");

    for (const pair of pairs) {
      const [key, value] = pair.split("=");
      if (key && value !== undefined) {
        tags[key] = this.unescapeTagValue(value);
      }
    }

    return tags;
  }

  private unescapeTagValue(value: string): string {
    return value.replace(/\\([snr:\\])/g, (_, escaped: string) => {
      switch (escaped) {
        case "s":
          return " ";
        case "n":
          return "\n";
        case "r":
          return "\r";
        case ":":
          return ";";
        case "\\":
          return "\\";
        default:
          return escaped;
      }
    });
  }

  private getFallbackColor(username: string): string {
    if (!username) {
      return TwitchService.TWITCH_COLORS[0];
    }
    const first = username.charCodeAt(0);
    const last = username.charCodeAt(username.length - 1);
    const index = (first + last) % TwitchService.TWITCH_COLORS.length;
    return TwitchService.TWITCH_COLORS[index];
  }

  private parseTagsFromLine(line: string): Record<string, string> {
    // Извлекаем теги из начала строки (до первого пробела)
    const match = line.match(/^@([^ ]+)/);
    if (!match) return {};
    return this.parseTags(match[1]);
  }

  private parseSourceChannel(line: string): string {
    return (
      line.match(/\b(?:PRIVMSG|USERNOTICE|CLEARMSG|CLEARCHAT|ROOMSTATE|JOIN) #([A-Za-z0-9_]+)/i)?.[1]?.toLowerCase() ||
      ""
    );
  }

  private parseBadges(badgesString: string): string[] {
    if (!badgesString) return [];

    const badges: string[] = [];
    const pairs = badgesString.split(",");

    for (const pair of pairs) {
      const [badgeType, badgeVersion] = pair.split("/");
      if (badgeType && badgeVersion) {
        badges.push(`${badgeType}/${badgeVersion}`);
      }
    }

    return badges;
  }

  private parseEmotes(emotesString: string): any {
    if (!emotesString) return {};

    // Простой парсинг эмодзи
    const emotes: Record<string, string[]> = {};
    const pairs = emotesString.split("/");

    for (const pair of pairs) {
      const [emoteId, positions] = pair.split(":");
      if (emoteId && positions) {
        emotes[emoteId] = positions.split(",");
      }
    }

    return emotes;
  }

  private handleReconnect() {
    if (this.intentionallyDisconnected) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      this.clearReconnectTimer();
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        if (!this.intentionallyDisconnected) {
          this.connectToTwitch();
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      log.error(LOG_CATEGORIES.TWITCH_IRC, "Max reconnection attempts reached");
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.readyFallbackTimer !== null) {
      window.clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
  }

  public disconnect() {
    this.intentionallyDisconnected = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.resetReadyState();
    this.reconnectAttempts = 0;
    this.channel = "";
    this.onMessageCallback = null;
    this.onConnectCallback = null;
    this.onDisconnectCallback = null;
    this.onMessageDeleteCallback = null;
    this.onUserBanCallback = null;
    this.onChatClearCallback = null;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
