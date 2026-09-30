/**
 * Curated emote material for generated chat lines: the setup preview demo and
 * the `!chat test` command. Third-party emote names come from the channel's own
 * catalogue at generation time; the Twitch emotes are a fixed table because
 * they carry no name lookup — the renderer builds the CDN URL from the id and
 * the positions in `message.emotes`, so only ids verified against the public
 * CDN belong here.
 */

export type SampleTwitchEmote = {
  readonly name: string;
  readonly id: string;
};

export const TWITCH_SAMPLE_EMOTES: readonly SampleTwitchEmote[] = [
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

export type SampleEmotePools = {
  readonly sevenTv: readonly string[];
  readonly ffz: readonly string[];
  readonly bttv: readonly string[];
  readonly twitch: readonly SampleTwitchEmote[];
};

export type SampleEmote = {
  readonly name: string;
  readonly id?: string;
};

export type SampleChatLine = {
  readonly message: string;
  readonly emotes: Record<string, string[]>;
};

const NAME_PROVIDERS = ["sevenTv", "ffz", "bttv"] as const;

/**
 * Groups a loaded emote catalogue into per-provider pools. Cheer emotes are
 * skipped: they belong to the bits renderer, not to a chat line.
 */
export function collectSampleEmotePools(
  emotes: Iterable<{ readonly name: string; readonly source: string }>,
  twitch: readonly SampleTwitchEmote[] = TWITCH_SAMPLE_EMOTES,
): SampleEmotePools {
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

/**
 * Picks up to `count` emotes from distinct providers. `index` rotates the first
 * provider so one batch covers the whole catalogue, and `used` keeps a name
 * from repeating while untouched names remain.
 */
export function pickSampleEmotes(
  pools: SampleEmotePools,
  index: number,
  count: number,
  random: () => number,
  used: Set<string> = new Set(),
): SampleEmote[] {
  const providers: readonly (readonly SampleEmote[])[] = [
    pools.sevenTv.map((name) => ({ name })),
    pools.ffz.map((name) => ({ name })),
    pools.bttv.map((name) => ({ name })),
    pools.twitch.map((emote) => ({ name: emote.name, id: emote.id })),
  ].filter((pool) => pool.length > 0);
  if (providers.length === 0 || count <= 0) return [];

  const picked: SampleEmote[] = [];
  const total = Math.min(providers.length, count);
  for (let step = 0; step < total; step += 1) {
    const pool = providers[(index + step) % providers.length];
    const unused = pool.filter((emote) => !used.has(emote.name));
    const emote = pickOne(unused.length > 0 ? unused : pool, random);
    if (!emote) continue;
    used.add(emote.name);
    picked.push(emote);
  }

  return picked;
}

/**
 * Joins a chat phrase with emote tokens and returns the Twitch `emotes` tag
 * positions the renderer needs for the emotes Twitch itself owns. Third-party
 * names need no positions: the preparation pipeline resolves them from the
 * text.
 */
export function buildSampleLine(
  phrase: string,
  emotes: readonly SampleEmote[] = [],
): SampleChatLine {
  const tokens: Array<{ text: string; id?: string }> = phrase.trim()
    ? [{ text: phrase }]
    : [];
  tokens.push(...emotes.map((emote) => ({ text: emote.name, id: emote.id })));

  const twitchEmotes: Record<string, string[]> = {};
  let cursor = 0;
  for (const token of tokens) {
    const length = [...token.text].length;
    if (token.id) {
      (twitchEmotes[token.id] ??= []).push(`${cursor}-${cursor + length - 1}`);
    }
    cursor += length + 1;
  }

  return {
    message: tokens.map((token) => token.text).join(" "),
    emotes: twitchEmotes,
  };
}

function pickOne<T>(values: readonly T[], random: () => number): T | undefined {
  if (values.length === 0) return undefined;
  return values[Math.floor(random() * values.length) % values.length];
}
