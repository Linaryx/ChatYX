export const DEFAULT_BOT_NAMES = [
  "twirapp",
  "streamqbot",
  "nightbot",
  "streamelements",
  "streamlabs",
  "fossabot",
  "wizebot",
  "supibot",
  "moobot",
  "botisimo",
  "coebot",
  "vivbot",
  "ankhbot",
  "ohbot",
  "deepbot",
  "xanbot",
  "phantombot",
  "scriptorex",
  "buttsbot",
  "pokemoncommunitygame",
  "twitchplayspokemon",
  "pajbot",
  "pokemoncommun1tybot",
  "commanderroot",
  "sery_bot",
] as const;

export function formatBotNamesForTextarea(botNames: readonly string[]): string {
  const rows: string[] = [];

  for (let index = 0; index < botNames.length; index += 4) {
    rows.push(botNames.slice(index, index + 4).join(", "));
  }

  return rows.join("\n");
}
