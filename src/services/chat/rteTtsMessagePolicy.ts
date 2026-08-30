import { parseBotNames, type ChatConfig } from "~/config/chatUrlParams";
import { BotFilterService } from "~/utils/botFilter";
import type { RteTtsProvider, RteTtsRequest } from "./rteTtsTypes";
import type { TwitchMessage } from "./twitchService";

export function getRteChatSpeechRequest(
  config: ChatConfig,
  message: TwitchMessage,
): RteTtsRequest | null {
  if ((!config.rteAzureTts && !config.rteChatIsTts) || !config.ttsReadChat) {
    return null;
  }

  const filter = new BotFilterService(parseBotNames(config.botNames));
  if (filter.isCommand(message.message)) return null;
  if (!config.ttsReadBots && filter.isBot(message.username)) return null;

  const text = message.message.trim();
  if (!text) return null;

  const provider: RteTtsProvider = config.rteChatIsTts ? "chatis" : "azure";
  const request = {
    provider,
    messageId: message.id,
    username: message.username,
    text,
  };
  return message.userId ? { ...request, userId: message.userId } : request;
}
