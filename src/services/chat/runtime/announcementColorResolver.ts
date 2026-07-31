import { twitchGqlService } from "../twitchGqlService";
import type { TwitchMessage } from "../twitchService";

const RESOLUTION_TIMEOUT_MS = 350;

export class AnnouncementColorResolver {
  private color = "";
  private pendingColor: Promise<string> | null = null;

  constructor(private readonly channel: string) {}

  preload() {
    if (!this.channel.trim() || this.pendingColor) return;

    this.pendingColor = twitchGqlService
      .loadChannelPrimaryColor(this.channel)
      .then((color) => {
        this.color = color;
        return color;
      })
      .catch(() => "");
  }

  async apply(message: TwitchMessage) {
    const event = message.twitchEvent;
    if (event?.type !== "announcement" || event.level !== "PRIMARY") return;

    const color = this.color || (await this.resolve());
    if (color) event.color = color;
  }

  private async resolve(): Promise<string> {
    if (this.color) return this.color;
    this.preload();

    return new Promise<string>((resolve) => {
      const timeout = window.setTimeout(() => resolve(""), RESOLUTION_TIMEOUT_MS);
      this.pendingColor
        ?.then((color) => resolve(color), () => resolve(""))
        .finally(() => window.clearTimeout(timeout));
    });
  }
}
