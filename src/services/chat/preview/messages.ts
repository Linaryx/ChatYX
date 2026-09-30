import type { ChatPresentationService } from "../chatPresentationService";
import { emoteService } from "../assets/emoteService";
import type { TwitchMessage } from "../twitch/twitchService";
import { PREVIEW_USERNAME_BASES } from "~/config/previewUsernames";
import {
  buildSampleLine,
  collectSampleEmotePools,
  pickSampleEmotes,
  type SampleEmote,
} from "~/config/sampleEmotes";
import { isReplyEligibleEvent } from "~/utils/chat/replyEligibility";
import { previewRealUsers, type PreviewRealUser } from "./userPool";

/**
 * Neutral chat lines for the demo scenario: they read naturally on their own,
 * with a trailing mention and with a trailing emote. The set still contains
 * questions and a link so the demo keeps exercising wrapping and link styling.
 */
const PREVIEW_MESSAGES = [
  "привет всем",
  "как дела?",
  "классный стрим",
  "го ещё",
  "давно смотрю",
  "сегодня много народу",
  "что по расписанию?",
  "первый раз тут",
  "спасибо за эфир",
  "вот это да",
  "ору с этого",
  "гайд тут: https://example.com/guide",
];

const PREVIEW_REPLY_BODY =
  "Думал, что стрим начнётся в семь, но, кажется, всё сдвинулось — кто-нибудь знает точное время?";

/** Keeps the emote scenario useful before any catalogue has loaded. */
const FALLBACK_EMOTE: SampleEmote = { name: "Kappa", id: "25" };

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
let usedEmotes = new Set<string>();

export function resetMessageState() {
  messageCounter = 0;
  lastUsername = "";
  shuffledOrder = [];
  shufflePos = 0;
  usedEmotes = new Set();
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

/**
 * Picks demo emotes per provider, so a batch shows 7TV, FFZ, BTTV and Twitch
 * emotes instead of whatever the merged name list happens to contain.
 */
function pickPreviewEmotes(
  channelId: string,
  index: number,
  count: number,
): SampleEmote[] {
  let seed = index * 1013 + 17;
  return pickSampleEmotes(
    collectSampleEmotePools(emoteService.getAllEmotes(channelId)),
    index,
    count,
    () => previewRandom(seed++),
    usedEmotes,
  );
}

function getPreviewTwitchEvent(
  index: number,
  displayName: string,
): TwitchMessage["twitchEvent"] {
  switch (index % 16) {
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
    case 14:
      return {
        type: "watch-streak",
        label: "Новая серия просмотров!",
        detail: displayName,
        count: 3,
        points: 350,
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
  showGifs = false,
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

  const emoteCount =
    demoKind === "emote" ? 1 : 1 + Math.floor(previewRandom(index + 710) * 3);
  const pickedEmotes = pickPreviewEmotes(channelId, index, emoteCount);
  const selectedEmotes =
    pickedEmotes.length > 0
      ? pickedEmotes
      : demoKind === "emote"
        ? [FALLBACK_EMOTE]
        : [];

  const mentionTarget = lastUsername || username;
  const line =
    demoKind === "emote"
      ? buildSampleLine("", selectedEmotes)
      : buildSampleLine(
          previewRandom(index + 20) < 0.3
            ? `${PREVIEW_MESSAGES[index % PREVIEW_MESSAGES.length]} @${mentionTarget}`
            : PREVIEW_MESSAGES[index % PREVIEW_MESSAGES.length],
          selectedEmotes,
        );
  const messageText = line.message;
  const isGifPreview = showGifs && index % 16 === 1;

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
  const canReply = isReplyEligibleEvent(twitchEvent?.type);
  const hasAuthoredText =
    twitchEvent?.type !== "raid" && twitchEvent?.type !== "watch-streak";

  const message: TwitchMessage = {
    id: `preview-live-${Date.now()}-${index}`,
    platform: "twitch",
    username,
    displayName,
    message: hasAuthoredText
      ? isGifPreview ? "[GIF]" : messageText
      : "",
    color,
    badges,
    emotes: hasAuthoredText && !isGifPreview ? line.emotes : {},
    userType: "",
    isModerator,
    isSubscriber,
    timestamp: new Date(),
    userId: realUserId || String(2000 + index),
    twitchEvent,
    gifs: isGifPreview
      ? [{
          start: 0,
          end: 4,
          id: "preview-gif-1",
          url: "https://media4.giphy.com/media/joSNxeswxuc74Juo8X/giphy.webp",
        }]
      : undefined,
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
      !isGifPreview &&
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
  showGifs = false,
): TwitchMessage[] {
  resetMessageState();
  return Array.from({ length: count }, () =>
    nextPreviewMessage(channel, service, channelId, demoKind, showGifs),
  ).map((msg, i, list) => ({
    ...msg,
    id: `preview-${i + 1}`,
    timestamp: new Date(Date.now() - (list.length - i) * 1800),
  }));
}
