/**
 * `!chat test` sample messages. The generator keeps the shape of a real chat
 * batch: short chat lines, registrable nicknames, a random role/sub mix and
 * emotes drawn from several providers, so a streamer can check rendering
 * without waiting for a live audience.
 */
import { PREVIEW_USERNAME_BASES } from "~/config/previewUsernames";
import {
  buildSampleLine,
  pickSampleEmotes,
  type SampleEmotePools,
} from "~/config/sampleEmotes";
import type { TwitchMessage } from "~/services/chat/twitch/twitchService";

export type TestMessageOptions = {
  readonly count: number;
  readonly emotes: SampleEmotePools;
  /**
   * Injected randomness keeps batches testable and reproducible; the runtime
   * passes the platform default.
   */
  readonly random?: () => number;
};

const TEST_MESSAGE_TEXTS = [
  "привет всем",
  "это база",
  "го ещё",
  "имба",
  "плюсую",
  "как дела?",
  "ахахах",
  "ну это сильно",
  "согласен",
  "первый раз тут",
  "классный стрим",
  "GG",
  "хорош",
  "ждём ещё",
  "ору",
  "погнали",
  "красиво",
  "вот это да",
];

const TEST_MESSAGE_COLORS = [
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

const SUB_MONTHS = [1, 2, 3, 6, 12, 24, 36];

export function createTestMessages(options: TestMessageOptions): TwitchMessage[] {
  const random = options.random ?? Math.random;
  const total = Math.max(0, Math.floor(options.count));
  const texts = shuffle(TEST_MESSAGE_TEXTS, random);
  const usedEmotes = new Set<string>();
  const usernames = new Set<string>();
  const messages: TwitchMessage[] = [];

  for (let index = 0; index < total; index += 1) {
    const isBroadcaster = index > 0 && random() < 0.08;
    const isModerator = !isBroadcaster && random() < 0.18;
    const isVip = !isBroadcaster && !isModerator && random() < 0.1;
    const isSubscriber = random() < 0.55;
    const isFounder = isSubscriber && random() < 0.15;

    const badges: string[] = [];
    if (isBroadcaster) badges.push("broadcaster/1");
    if (isModerator) badges.push("moderator/1");
    if (isVip) badges.push("vip/1");
    if (isFounder) badges.push("founder/0");
    else if (isSubscriber) badges.push(`subscriber/${pick(SUB_MONTHS, random) ?? 1}`);

    const pickedEmotes = pickSampleEmotes(
      options.emotes,
      index,
      1 + Math.floor(random() * 3),
      random,
      usedEmotes,
    );
    const line = buildSampleLine(texts[index % texts.length], pickedEmotes);

    const username = pickUsername(usernames, random);
    messages.push({
      id: `chatyx-test-${Date.now()}-${index}`,
      platform: "twitch",
      username,
      displayName: username,
      message: line.message,
      color: pick(TEST_MESSAGE_COLORS, random) ?? "#FF0000",
      badges,
      emotes: line.emotes,
      userType: isModerator ? "mod" : isVip ? "vip" : "",
      isModerator,
      isSubscriber: isSubscriber || isFounder,
      timestamp: new Date(),
    });
  }

  return messages;
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1)) % (index + 1);
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

function pick<T>(values: readonly T[], random: () => number): T | undefined {
  if (values.length === 0) return undefined;
  return values[Math.floor(random() * values.length) % values.length];
}

function pickUsername(used: Set<string>, random: () => number): string {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const base = pick(PREVIEW_USERNAME_BASES, random) ?? "viewer";
    const candidate = `${base}${100 + Math.floor(random() * 99900)}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }

  const fallback = `viewer${100 + used.size}`;
  used.add(fallback);
  return fallback;
}
