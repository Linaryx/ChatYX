import { emoteService } from "~/services/chat";
import { PREVIEW_USERNAME_BASES } from "~/config/previewUsernames";
import type { TwitchMessage, ChatPresentationService } from "~/services/chat";
import { previewRealUsers, type PreviewRealUser } from "./userPool";

const PREVIEW_MESSAGES = [
  "Всем привет! Как настроение?",
  "Вот это сейчас было красиво",
  "Первый раз на стриме, мне уже нравится",
  "Расписание на неделю: https://example.com/schedule",
  "Идеальный момент для клипа",
  "Сегодня чат особенно активный",
  "Спасибо за отличный эфир!",
  "Кажется, мы нашли новую стратегию",
  "Можно ещё раз, но теперь специально?",
  "Не ожидал такого поворота",
];

const PREVIEW_REPLY_BODY =
  "Это старое сообщение, на которое сейчас отвечают, и оно специально длинное, чтобы проверить обрезку reply в одну строку.";

export type PreviewDemoKind = "pasta" | "emote";

const PREVIEW_COLORS = [
  "#FF0000",
  "#0000FF",
  "#00FF00",
  "#B22222",
  "#FF7F50",
  "#9ACD32",
  "#FF4500",
  "#2E8B57",
  "#DAA520",
  "#D2691E",
  "#5F9EA0",
  "#1E90FF",
  "#FF69B4",
  "#8A2BE2",
  "#00FF7F",
];

const PREVIEW_SUB_MONTHS = [1, 2, 3, 6, 12, 24, 36];

let messageCounter = 0;
let lastUsername = "";
let shuffledOrder: number[] = [];
let shufflePos = 0;

export function resetMessageState() {
  messageCounter = 0;
  lastUsername = "";
  shuffledOrder = [];
  shufflePos = 0;
}

function previewRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function pickNextUser(): PreviewRealUser | null {
  if (previewRealUsers.length === 0) return null;
  if (shufflePos >= shuffledOrder.length) {
    const order = previewRealUsers.map((_, i) => i);
    const timeSeed = Date.now() % 999983;
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(
        previewRandom(timeSeed + i * 7 + shuffledOrder.length) * (i + 1),
      );
      [order[i], order[j]] = [order[j], order[i]];
    }
    const lastUsed = shuffledOrder[shuffledOrder.length - 1];
    if (order.length > 1 && order[0] === lastUsed) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    shuffledOrder = order;
    shufflePos = 0;
  }
  const idx = shuffledOrder[shufflePos++];
  return previewRealUsers[idx] ?? null;
}

function buildEmoteSnapshot(text: string, channelId: string, username: string) {
  const snapshot = new Map<string, any>();
  for (const part of text.split(/(\s+)/)) {
    if (!part || /^\s+$/.test(part)) continue;
    const name = part.replace(/__EMOJI\d+__/g, "");
    if (!name) continue;
    const emote = emoteService.getEmoteForUser(name, username, channelId);
    if (emote) snapshot.set(name, { ...emote });
  }
  return snapshot;
}

function pickRandomEmoteNames(
  channelId: string,
  index: number,
  count: number,
): string[] {
  const availableEmotes = emoteService.getAllEmoteNames(channelId);
  if (availableEmotes.length === 0) return [];

  const selected: string[] = [];
  for (let offset = 0; offset < availableEmotes.length; offset += 1) {
    const name =
      availableEmotes[
        Math.floor(
          previewRandom(index + 600 + offset * 37) * availableEmotes.length,
        )
      ];
    if (name && !selected.includes(name)) selected.push(name);
    if (selected.length >= count) break;
  }

  return selected;
}

function pickRandomEmoteName(channelId: string, index: number): string {
  return pickRandomEmoteNames(channelId, index, 1)[0] || "Kappa";
}

function getPreviewTwitchEvent(
  index: number,
  displayName: string,
): TwitchMessage["twitchEvent"] {
  switch (index % 14) {
    case 0:
      return { type: "first-message", label: "Впервые в чате" };
    case 2:
      return {
        type: "highlighted-message",
        label: "Выделенное сообщение",
      };
    case 4:
      return {
        type: "reward",
        label: "Награда",
        detail: "Выделить сообщение",
        count: 5000,
      };
    case 6:
      return {
        type: "power-up",
        label: "Гигантский эмоут",
        count: 100,
      };
    case 8:
      return {
        type: "subscription",
        label: "Продление подписки",
        detail: `${displayName} подписан(а) уже 3 мес.`,
      };
    case 10:
      return {
        type: "raid",
        label: "Рейд",
        detail: displayName,
        count: 423,
      };
    case 12:
      return {
        type: "announcement",
        label: "Объявление",
        level: "ORANGE",
        color: "#ff7621",
      };
    default:
      return undefined;
  }
}

export function nextPreviewMessage(
  channel: string,
  service: ChatPresentationService,
  channelId: string,
  demoKind: PreviewDemoKind = "pasta",
): TwitchMessage {
  const index = messageCounter++;

  let username: string;
  let displayName: string;
  let isBroadcaster: boolean;
  let isModerator: boolean;
  let isVip: boolean;
  let isFounder: boolean;
  let realUserId: string | undefined;
  let realUserColor: string | undefined;
  let realUserBadges: string[] | undefined;

  const realUser = pickNextUser();
  if (realUser) {
    username = realUser.username;
    displayName = realUser.displayName;
    isBroadcaster = realUser.role === "broadcaster";
    isModerator = realUser.role === "moderator";
    isVip = realUser.role === "vip";
    isFounder = realUser.role === "founder";
    realUserId = realUser.userId;
    realUserColor = realUser.color;
    realUserBadges = realUser.badges;
  } else {
    const baseLen = PREVIEW_USERNAME_BASES.length;
    const base =
      PREVIEW_USERNAME_BASES[Math.floor(previewRandom(index + 900) * baseLen)];
    const num = Math.floor(previewRandom(index + 800) * 999999);
    username = `${base}${num}`;
    displayName = username;
    isBroadcaster = index > 0 && previewRandom(index + 100) < 0.08;
    isModerator = !isBroadcaster && previewRandom(index + 200) < 0.18;
    isVip = !isBroadcaster && !isModerator && previewRandom(index + 250) < 0.1;
    isFounder = false;
  }

  const messageText =
    demoKind === "emote"
        ? pickRandomEmoteName(channelId, index)
        : (() => {
          const mentionTarget = lastUsername || username;
          let text = PREVIEW_MESSAGES[index % PREVIEW_MESSAGES.length];
          const selectedEmotes = pickRandomEmoteNames(
            channelId,
            index,
            1 + Math.floor(previewRandom(index + 710) * 3),
          );
          if (previewRandom(index + 20) < 0.3) text += ` @${mentionTarget}`;
          if (selectedEmotes.length > 0) text += ` ${selectedEmotes.join(" ")}`;
          return text;
        })();

  let badges: string[];
  let isSubscriber: boolean;
  if (realUserBadges && realUserBadges.length > 0) {
    badges = realUserBadges;
    isSubscriber = badges.some(
      (b) => b.startsWith("subscriber/") || b.startsWith("founder/"),
    );
  } else {
    isSubscriber = isFounder || previewRandom(index + 350) < 0.55;
    const subMonths = PREVIEW_SUB_MONTHS[index % PREVIEW_SUB_MONTHS.length];
    badges = [];
    if (isBroadcaster) badges.push("broadcaster/1");
    if (isModerator) badges.push("moderator/1");
    if (isVip) badges.push("vip/1");
    if (isFounder) badges.push("founder/0");
    else if (isSubscriber) badges.push(`subscriber/${subMonths}`);
  }

  const color =
    realUserColor ??
    PREVIEW_COLORS[
      Math.floor(previewRandom(index + 300) * PREVIEW_COLORS.length)
    ];
  const twitchEvent = getPreviewTwitchEvent(index, displayName);
  const replyTarget = lastUsername || channel;
  const canReply =
    !twitchEvent ||
    twitchEvent.type === "first-message" ||
    twitchEvent.type === "highlighted-message";

  const message: TwitchMessage = {
    id: `preview-live-${Date.now()}-${index}`,
    username,
    displayName,
    message: twitchEvent?.type === "raid" ? "" : messageText,
    color,
    badges,
    emotes: {},
    userType: "",
    isModerator,
    isSubscriber,
    timestamp: new Date(),
    userId: realUserId || String(2000 + index),
    twitchEvent,
    msgId:
      twitchEvent?.type === "highlighted-message"
        ? "highlighted-message"
        : twitchEvent?.type === "power-up"
          ? "gigantified-emote-message"
          : undefined,
    isGigantifiedEmote: twitchEvent?.type === "power-up",
    channelPointReward:
      twitchEvent?.type === "reward"
        ? {
            id: `preview-reward-${index}`,
            title: "Выделить сообщение",
            prompt: "",
            cost: 5000,
          }
        : undefined,
    reply:
      demoKind === "pasta" &&
      canReply &&
      index > 0 &&
      previewRandom(index + 470) < 0.45
        ? {
            parentMsgId: `preview-parent-${index}`,
            parentDisplayName: replyTarget,
            parentUserLogin: replyTarget,
            parentMsgBody: PREVIEW_REPLY_BODY,
            parentUserId: String(1000 + index),
          }
        : undefined,
  };
  lastUsername = username;
  message.emoteSnapshot = buildEmoteSnapshot(messageText, channelId, username);
  return message;
}

export function createPreviewMessages(
  channel: string,
  service: ChatPresentationService,
  channelId: string,
  demoKind: PreviewDemoKind = "pasta",
  count = 6,
): TwitchMessage[] {
  resetMessageState();
  return Array.from({ length: count }, () =>
    nextPreviewMessage(channel, service, channelId, demoKind),
  ).map((msg, i, list) => ({
    ...msg,
    id: `preview-${i + 1}`,
    timestamp: new Date(Date.now() - (list.length - i) * 1800),
  }));
}
