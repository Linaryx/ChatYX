/**
 * `!chat test` sample messages. The generator keeps the shape of a real chat
 * batch: short chat lines, registrable nicknames, a random role/sub mix and
 * emotes drawn from several providers, so a streamer can check rendering
 * without waiting for a live audience.
 */
import { PREVIEW_USERNAME_BASES } from "~/config/previewUsernames";
import type { TwitchMessage } from "~/services/chat/twitch/twitchService";

export type TestMessageTwitchEmote = {
  readonly name: string;
  readonly id: string;
};

/**
 * Twitch emotes carry no name lookup: the renderer builds the CDN URL from the
 * id in `message.emotes` and needs the matching positions, so the generator
 * keeps the ids next to the names. Only ids verified against the public CDN
 * belong here.
 */
export const TWITCH_SAMPLE_EMOTES: readonly TestMessageTwitchEmote[] = [
  { name: "Kappa", id: "25" },
  { name: "Kreygasm", id: "41" },
  { name: "LUL", id: "425618" },
  { name: "4Head", id: "354" },
  { name: "ResidentSleeper", id: "2455" },
  { name: "TriHard", id: "120232" },
  { name: "HeyGuys", id: "30259" },
  { name: "FailFish", id: "33" },
  { name: "DansGame", id: "34" },
  { name: "CoolStoryBob", id: "123171" },
  { name: "WutFace", id: "28087" },
  { name: "NotLikeThis", id: "58765" },
  { name: "SeemsGood", id: "64138" },
  { name: "MrDestructoid", id: "281" },
  { name: "PJSalt", id: "36" },
  { name: "ThunBeast", id: "335" },
  { name: "VoteNay", id: "241" },
];

/** Third-party emotes are words the preparation pipeline resolves by name. */
export type TestMessageEmotes = {
  readonly sevenTv: readonly string[];
  readonly ffz: readonly string[];
  readonly bttv: readonly string[];
  readonly twitch: readonly TestMessageTwitchEmote[];
};

export type TestMessageOptions = {
  readonly count: number;
  readonly emotes: TestMessageEmotes;
  /**
   * Injected randomness keeps batches testable and reproducible; the runtime
   * passes the platform default.
   */
  readonly random?: () => number;
};

const NAME_PROVIDERS = ["sevenTv", "ffz", "bttv"] as const;

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

type TestEmotePick = {
  readonly name: string;
  readonly id?: string;
};

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

/**
 * Groups the loaded emote catalogue into the per-provider pools the generator
 * rotates through. Cheer emotes are skipped: they belong to the bits renderer,
 * not to a chat line.
 */
export function collectTestMessageEmotes(
  emotes: Iterable<{ readonly name: string; readonly source: string }>,
  twitch: readonly TestMessageTwitchEmote[] = TWITCH_SAMPLE_EMOTES,
): TestMessageEmotes {
  const pools: Record<(typeof NAME_PROVIDERS)[number], string[]> = {
    sevenTv: [],
    ffz: [],
    bttv: [],
  };
  const seen = new Set<string>();

  for (const emote of emotes) {
    if (!emote.name || seen.has(emote.name)) continue;
    seen.add(emote.name);
    if (emote.source === "7tv") pools.sevenTv.push(emote.name);
    else if (emote.source === "ffz") pools.ffz.push(emote.name);
    else if (emote.source === "bttv") pools.bttv.push(emote.name);
  }

  return { ...pools, twitch };
}

export function createTestMessages(options: TestMessageOptions): TwitchMessage[] {
  const random = options.random ?? Math.random;
  const total = Math.max(0, Math.floor(options.count));
  const texts = shuffle(TEST_MESSAGE_TEXTS, random);
  const usernames = new Set<string>();
  const messages: TwitchMessage[] = [];

  const providers = (
    [
      options.emotes.sevenTv.map((name) => ({ name })),
      options.emotes.ffz.map((name) => ({ name })),
      options.emotes.bttv.map((name) => ({ name })),
      options.emotes.twitch.map((emote) => ({ name: emote.name, id: emote.id })),
    ] as const
  )
    .filter((pool) => pool.length > 0)
    .map((pool) => ({ pool, used: new Set<string>() }));

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

    const pickedEmotes: TestEmotePick[] = [];
    if (providers.length > 0) {
      const emoteTotal = Math.min(providers.length, 1 + Math.floor(random() * 3));
      for (let step = 0; step < emoteTotal; step += 1) {
        // Rotating the starting provider spreads the batch across providers.
        const provider = providers[(index + step) % providers.length];
        const emote = pickUnusedEmote(provider.pool, provider.used, random);
        if (emote) pickedEmotes.push(emote);
      }
    }

    const tokens: Array<{ text: string; id?: string }> = [
      { text: texts[index % texts.length] },
      ...pickedEmotes.map((emote) => ({ text: emote.name, id: emote.id })),
    ];

    // Twitch positions use code points in the final text.
    const twitchEmotes: Record<string, string[]> = {};
    let cursor = 0;
    for (const token of tokens) {
      const length = [...token.text].length;
      if (token.id) {
        (twitchEmotes[token.id] ??= []).push(`${cursor}-${cursor + length - 1}`);
      }
      cursor += length + 1;
    }

    const username = pickUsername(usernames, random);
    messages.push({
      id: `chatyx-test-${Date.now()}-${index}`,
      platform: "twitch",
      username,
      displayName: username,
      message: tokens.map((token) => token.text).join(" "),
      color: pick(TEST_MESSAGE_COLORS, random) ?? "#FF0000",
      badges,
      emotes: twitchEmotes,
      userType: isModerator ? "mod" : isVip ? "vip" : "",
      isModerator,
      isSubscriber: isSubscriber || isFounder,
      timestamp: new Date(),
    });
  }

  return messages;
}

function pickUnusedEmote(
  pool: readonly TestEmotePick[],
  used: Set<string>,
  random: () => number,
): TestEmotePick | undefined {
  const unused = pool.filter((emote) => !used.has(emote.name));
  const emote = pick(unused.length > 0 ? unused : pool, random);
  if (emote) used.add(emote.name);
  return emote;
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
