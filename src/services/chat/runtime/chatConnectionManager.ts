import { log, LOG_CATEGORIES } from "~/utils/logger";
import { TwitchService, type TwitchMessage } from "../twitchService";
import { YouTubeChatService } from "../youtubeChatService";

type ChatConnectionManagerOptions = {
  onChatClear: () => void;
  onMessageDelete: (messageId: string) => void;
  onTwitchConnectionChange: (connected: boolean) => void;
  onTwitchMessage: (message: TwitchMessage) => void | Promise<void>;
  onTwitchUserClear: (username: string) => void;
  onYouTubeConnectionChange: (connected: boolean) => void;
  onYouTubeMessage: (message: TwitchMessage) => void | Promise<void>;
  onYouTubeUserBan: (userId: string) => void;
};

export class ChatConnectionManager {
  private readonly twitchService = new TwitchService();
  private readonly youtubeService = new YouTubeChatService();
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

  connectYouTube(channel: string, webSocketUrl: string) {
    if (!channel) return;

    log.info(LOG_CATEGORIES.CHAT, `Connecting to YouTube channel: ${channel}`);
    this.youtubeService.connect(channel, webSocketUrl, {
      onMessage: (message) => this.options.onYouTubeMessage(message),
      onDelete: this.options.onMessageDelete,
      onBan: this.options.onYouTubeUserBan,
      onConnectionChange: (connected) => {
        log.info(
          LOG_CATEGORIES.CHAT,
          `YouTube chat ${connected ? "connected" : "disconnected"}`,
        );
        this.options.onYouTubeConnectionChange(connected);
      },
    });
  }

  parseTwitchMessageLine(line: string) {
    return this.twitchService.parseMessageLine(line);
  }

  destroy() {
    this.twitchService.disconnect();
    this.youtubeService.disconnect();
    this.twitchConnected = false;
  }
}
