import { log, LOG_CATEGORIES } from "~/utils/logger";
import { TwitchService, type TwitchMessage } from "../twitchService";
import { ExternalChatService } from "../externalChatService";
import type { ChatPlatform } from "../message";

type ChatConnectionManagerOptions = {
  onChatClear: () => void;
  onMessageDelete: (messageId: string) => void;
  onTwitchConnectionChange: (connected: boolean) => void;
  onTwitchMessage: (message: TwitchMessage) => void | Promise<void>;
  onTwitchUserClear: (username: string) => void;
  onExternalConnectionChange: (
    platform: Exclude<ChatPlatform, "twitch">,
    connected: boolean,
  ) => void;
  onExternalMessage: (message: TwitchMessage) => void | Promise<void>;
  onExternalHistory: (messages: TwitchMessage[]) => void | Promise<void>;
  onExternalUserBan: (userId: string) => void;
};

export class ChatConnectionManager {
  private readonly twitchService = new TwitchService();
  private readonly youtubeService = new ExternalChatService();
  private readonly kickService = new ExternalChatService();
  private twitchConnected = false;

  constructor(private readonly options: ChatConnectionManagerOptions) {}

  connectTwitch(channel: string, ignoredChannels: string[] = []) {
    if (this.twitchConnected || this.twitchService.isConnected()) return;

    log.info(LOG_CATEGORIES.TWITCH_IRC, `Connecting to channel: ${channel}`);
    this.twitchService.connect(
      channel,
      (message) => this.options.onTwitchMessage(message),
      () => {
        this.twitchConnected = true;
        this.options.onTwitchConnectionChange(true);
      },
      () => {
        this.twitchConnected = false;
        this.options.onTwitchConnectionChange(false);
      },
      this.options.onMessageDelete,
      this.options.onTwitchUserClear,
      this.options.onChatClear,
      ignoredChannels,
    );
    log.info(LOG_CATEGORIES.TWITCH_IRC, "Twitch IRC connection initialized");
  }

  connectExternal(
    platform: Exclude<ChatPlatform, "twitch">,
    channel: string,
    webSocketUrl: string,
  ) {
    if (!channel) return;

    const service = platform === "youtube" ? this.youtubeService : this.kickService;
    log.info(LOG_CATEGORIES.CHAT, `Connecting to ${platform} channel: ${channel}`);
    service.connect(platform, channel, webSocketUrl, {
      onMessage: (message) => this.options.onExternalMessage(message),
      onHistory: (messages) => this.options.onExternalHistory(messages),
      onDelete: this.options.onMessageDelete,
      onBan: this.options.onExternalUserBan,
      onConnectionChange: (connected) => {
        log.info(
          LOG_CATEGORIES.CHAT,
          `${platform} chat ${connected ? "connected" : "disconnected"}`,
        );
        this.options.onExternalConnectionChange(platform, connected);
      },
    });
  }

  parseTwitchMessageLine(line: string) {
    return this.twitchService.parseMessageLine(line);
  }

  destroy() {
    this.twitchService.disconnect();
    this.youtubeService.disconnect();
    this.kickService.disconnect();
    this.twitchConnected = false;
  }
}
