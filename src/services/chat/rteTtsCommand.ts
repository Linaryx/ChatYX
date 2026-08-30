export type RteTtsCommand =
  | { readonly kind: "speak"; readonly text: string; readonly voice: string | null }
  | { readonly kind: "skip" }
  | { readonly kind: "stop" }
  | { readonly kind: "clear" }
  | { readonly kind: "invalid" };

const CONTROL_COMMAND = /^(skip|stop|clear)(?:\s|$)/i;
const AZURE_VOICE = /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9]+Neural$/;

export function parseRteTtsCommand(
  provider: RteTtsProvider,
  args: string,
): RteTtsCommand {
  const value = args.trim();
  if (!value) return { kind: "invalid" };

  const control = CONTROL_COMMAND.exec(value);
  if (control) {
    if (control[0].trim().length !== value.length) return { kind: "invalid" };
    const kind = control[1]?.toLowerCase();
    if (kind === "skip") return { kind: "skip" };
    if (kind === "stop") return { kind: "stop" };
    if (kind === "clear") return { kind: "clear" };
    return { kind: "invalid" };
  }

  const voiceFlag =
    provider === "azure"
      ? "(?:-v|-s|--voice|--speaker)"
      : "(?:-s|--speaker)";
  const voiceMatch = new RegExp(
    `^${voiceFlag}\\s+(\\S+)(?:\\s+([\\s\\S]+))?$`,
    "i",
  ).exec(value);
  const trailingVoiceMatch = new RegExp(
    `^([\\s\\S]*?)\\s+${voiceFlag}\\s+(\\S+)$`,
    "i",
  ).exec(value);
  if (trailingVoiceMatch) {
    const text = trailingVoiceMatch[1]?.trim() ?? "";
    const voice = trailingVoiceMatch[2] ?? "";
    if (!text || (provider === "azure" && !AZURE_VOICE.test(voice))) {
      return { kind: "invalid" };
    }
    return { kind: "speak", text, voice };
  }
  if (!voiceMatch) {
    return value.startsWith("-")
      ? { kind: "invalid" }
      : { kind: "speak", text: value, voice: null };
  }

  const voice = voiceMatch[1] ?? "";
  const text = voiceMatch[2]?.trim() ?? "";
  if (!text || (provider === "azure" && !AZURE_VOICE.test(voice))) {
    return { kind: "invalid" };
  }
  return { kind: "speak", text, voice };
}
import type { RteTtsProvider } from "./rteTtsTypes";
