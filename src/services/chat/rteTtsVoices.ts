import type { RteTtsProvider } from "./rteTtsTypes";

export const RUSSIAN_TTS_VOICES = [
  { name: "Maxim", provider: "chatis", backendName: "Maxim" },
  { name: "Tatyana", provider: "chatis", backendName: "Tatyana" },
  {
    name: "Dmitriy",
    provider: "azure",
    backendName: "ru-RU-DmitryNeural",
  },
  {
    name: "Dmitry",
    provider: "azure",
    backendName: "ru-RU-DmitryNeural",
  },
  {
    name: "Svetlana",
    provider: "azure",
    backendName: "ru-RU-SvetlanaNeural",
  },
] as const satisfies ReadonlyArray<{
  name: string;
  provider: RteTtsProvider;
  backendName: string;
}>;

export type RussianTtsVoice = (typeof RUSSIAN_TTS_VOICES)[number]["name"];

const LEGACY_VOICE_NAMES: Readonly<Record<string, RussianTtsVoice>> = {
  "ru-ru-dmitryneural": "Dmitriy",
  "ru-ru-svetlananeural": "Svetlana",
};

export function resolveRussianTtsVoice(
  value: string,
): (typeof RUSSIAN_TTS_VOICES)[number] | null {
  const normalized = value.trim().toLowerCase();
  const legacyName = LEGACY_VOICE_NAMES[normalized];
  const name = legacyName ?? value.trim();
  return (
    RUSSIAN_TTS_VOICES.find(
      (voice) => voice.name.toLowerCase() === name.toLowerCase(),
    ) ?? null
  );
}

export function resolveBackendTtsVoice(
  provider: RteTtsProvider,
  value: string,
): string {
  const voice = resolveRussianTtsVoice(value);
  return voice?.provider === provider ? voice.backendName : value;
}
