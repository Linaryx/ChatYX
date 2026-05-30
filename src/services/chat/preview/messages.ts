import { emoteService } from "~/services/chat";
import { PREVIEW_USERNAME_BASES } from "~/config/previewUsernames";
import type { TwitchMessage, ChatISIntegrationService } from "~/services/chat";
import { previewRealUsers, type PreviewRealUser } from "./userPool";

const PREVIEW_MESSAGES = [
  "Это я - твой единственный зритель. Я на протяжении многих лет создавал иллюзию того, что тебя смотрят много людей, но это был я. Сейчас напишу это сообщение со всех аккаунтов.",
];

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

export function nextPreviewMessage(
  channel: string,
  service: ChatISIntegrationService,
  channelId: string,
): TwitchMessage {
  const index = messageCounter++;

  let username: string;
  let displayName: string;
  let isBroadcaster: boolean;
  let isModerator: boolean;
  let isVip: boolean;
  let isFounder: boolean;
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

  const mentionTarget = lastUsername || username;
  const template = PREVIEW_MESSAGES[index % PREVIEW_MESSAGES.length];
  const availableEmotes = emoteService.getAllEmoteNames(channelId);
  const emoteOnly =
    availableEmotes.length > 0 && previewRandom(index + 500) < 0.2;
  const selectedEmotes: string[] = [];

  if (availableEmotes.length > 0) {
    const count = emoteOnly ? 1 + (index % 2) : 1;
    for (let ei = 0; ei < count; ei++) {
      const name =
        availableEmotes[
          Math.floor(previewRandom(index + 600 + ei) * availableEmotes.length)
        ];
      if (name) selectedEmotes.push(name);
    }
  }

  const messageText =
    emoteOnly && selectedEmotes.length > 0
      ? selectedEmotes.join(" ")
      : (() => {
          let text = template;
          if (previewRandom(index + 20) < 0.3) text += ` @${mentionTarget}`;
          if (selectedEmotes.length > 0 && previewRandom(index + 700) < 0.7)
            text += ` ${selectedEmotes.join(" ")}`;
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

  lastUsername = username;

  const message: TwitchMessage = {
    id: `preview-live-${Date.now()}-${index}`,
    username,
    displayName,
    message: messageText,
    color,
    badges,
    emotes: {},
    userType: "",
    isModerator,
    isSubscriber,
    timestamp: new Date(),
    userId: String(2000 + index),
  };
  message.emoteSnapshot = buildEmoteSnapshot(messageText, channelId, username);
  return message;
}

export function createPreviewMessages(
  channel: string,
  service: ChatISIntegrationService,
  channelId: string,
  count = 6,
): TwitchMessage[] {
  resetMessageState();
  return Array.from({ length: count }, () =>
    nextPreviewMessage(channel, service, channelId),
  ).map((msg, i, list) => ({
    ...msg,
    id: `preview-${i + 1}`,
    timestamp: new Date(Date.now() - (list.length - i) * 1800),
  }));
}
