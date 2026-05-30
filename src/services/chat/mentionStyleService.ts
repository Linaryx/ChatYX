import type { ChatISIntegrationService } from "./chatisIntegration";
import { colorService } from "./colorService";
import type { TwitchMessage } from "./twitchService";

type KnownUserStyle = {
  color: string | null;
  userId: string | null;
};

export type MentionStyle =
  | { kind: "global-paint"; text: string; suffix: string; paintId: string }
  | { kind: "inline-paint"; text: string; suffix: string; css: string }
  | { kind: "color"; text: string; suffix: string; color: string };

class MentionStyleService {
  private readonly knownUsers = new Map<string, KnownUserStyle>();

  registerMessageAuthor(message: TwitchMessage) {
    const username = this.normalizeUsername(message.username);
    if (!username) return;

    this.knownUsers.set(username, {
      color: typeof message.color === "string" && message.color ? message.color : null,
      userId: message.userId || null,
    });
  }

  reset() {
    this.knownUsers.clear();
  }

  resolveMention(token: string, service: ChatISIntegrationService): MentionStyle | null {
    const match = token.match(/^@([A-Za-z0-9_][A-Za-z0-9_.-]*)(.*)$/);
    if (!match) return null;

    const mentionText = `@${match[1]}`;
    const username = this.normalizeUsername(match[1]);
    const suffix = match[2] || "";
    const knownUser = this.knownUsers.get(username);

    const cachedPaint = colorService.calculatePaintCSS(username);
    if (
      cachedPaint &&
      typeof cachedPaint === "object" &&
      cachedPaint.useGlobalCSS &&
      cachedPaint.paintId
    ) {
      return {
        kind: "global-paint",
        text: mentionText,
        suffix,
        paintId: cachedPaint.paintId,
      };
    }

    const paintCss = service.getUserPaint(knownUser?.userId || "", username);
    if (paintCss) {
      return {
        kind: "inline-paint",
        text: mentionText,
        suffix,
        css: paintCss,
      };
    }

    if (knownUser?.color) {
      return {
        kind: "color",
        text: mentionText,
        suffix,
        color: knownUser.color,
      };
    }

    return null;
  }

  private normalizeUsername(username: string) {
    return username.trim().toLowerCase();
  }
}

export const mentionStyleService = new MentionStyleService();
