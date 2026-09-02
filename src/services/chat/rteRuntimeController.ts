import type { ChatConfig } from "~/config/chatUrlParams";
import { parseRteTtsCommand } from "./rteTtsCommand";
import { getRteChatSpeechRequest } from "./rteTtsMessagePolicy";
import { resolveRussianTtsVoice } from "./rteTtsVoices";
import type {
  RteTtsConfig,
  RteTtsEnqueueResult,
  RteTtsProvider,
  RteTtsRequest,
  RteTtsUser,
} from "./rteTtsTypes";
import type { TwitchMessage } from "./twitchService";

export interface RteTtsRuntime {
  updateConfig(config: RteTtsConfig): void;
  enqueue(request: RteTtsRequest): RteTtsEnqueueResult;
  skip(): void;
  clear(): void;
  stop(): void;
  cancelMessage(messageId: string): void;
  cancelUser(user: RteTtsUser): void;
  cancelAll(): void;
  destroy(): void;
}

export interface RteRuntime {
  updateConfig(config: ChatConfig): void;
  handleDisplayedMessage(message: TwitchMessage): void;
  handleAuthorizedCommand(args: string, source: TwitchMessage): void;
  cancelMessage(messageId: string): void;
  cancelUser(user: RteTtsUser): void;
  cancelAll(): void;
  destroy(): void;
}

export class RteRuntimeController {
  private config: ChatConfig | null = null;

  constructor(private readonly tts: RteTtsRuntime) {}

  updateConfig(config: ChatConfig): void {
    this.config = config;
    this.tts.updateConfig({
      azureEnabled: config.rteAzureTts,
      chatisEnabled: config.rteChatIsTts,
      azureVoice: config.ttsVoice,
      chatisVoice: config.ttsChatIsVoice,
      volume: config.ttsVolume,
      maxLength: config.ttsMaxLength,
    });
  }

  handleDisplayedMessage(message: TwitchMessage): void {
    if (!this.config) return;
    const request = getRteChatSpeechRequest(this.config, message);
    if (request) this.tts.enqueue(request);
  }

  handleAuthorizedCommand(args: string, source: TwitchMessage): void {
    if (!this.config || (!this.config.rteAzureTts && !this.config.rteChatIsTts)) {
      return;
    }

    const command = parseRteTtsCommand(args);
    switch (command.kind) {
      case "speak": {
        const selectedVoice = command.voice
          ? resolveRussianTtsVoice(command.voice)
          : null;
        const provider: RteTtsProvider = selectedVoice?.provider ?? (
          this.config.rteChatIsTts ? "chatis" : "azure"
        );
        if (provider === "azure" && !this.config.rteAzureTts) return;
        if (provider === "chatis" && !this.config.rteChatIsTts) return;
        this.tts.enqueue(
          this.createCommandRequest(
            source,
            provider,
            command.text,
            selectedVoice?.backendName ?? null,
          ),
        );
        return;
      }
      case "skip":
        this.tts.skip();
        return;
      case "clear":
        this.tts.clear();
        return;
      case "stop":
        this.tts.stop();
        return;
      case "invalid":
        return;
    }
  }

  cancelMessage(messageId: string): void {
    this.tts.cancelMessage(messageId);
  }

  cancelUser(user: RteTtsUser): void {
    this.tts.cancelUser(user);
  }

  cancelAll(): void {
    this.tts.cancelAll();
  }

  destroy(): void {
    this.tts.destroy();
  }

  private createCommandRequest(
    source: TwitchMessage,
    provider: RteTtsProvider,
    text: string,
    voice: string | null,
  ): RteTtsRequest {
    const request = {
      provider,
      messageId: source.id,
      username: source.username,
      text,
    };
    if (source.userId && voice) return { ...request, userId: source.userId, voice };
    if (source.userId) return { ...request, userId: source.userId };
    if (voice) return { ...request, voice };
    return request;
  }
}
