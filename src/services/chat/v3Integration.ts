/**
 * V3 Integration Service
 * Integrates all new v2 features into v3 chat
 */

import { log, LOG_CATEGORIES } from "../../utils/logger";

// Services
import { bitsService } from "./bitsService";
import { messageManager } from "./messageManager";
import { ffzapBadgeService } from "../badges/ffzapBadgeService";
import { bttvBadgeService } from "../badges/bttvBadgeService";
import { chatterinoBadgeService } from "../badges/chatterinoBadgeService";
import { chatisBadgeService } from "../badges/chatisBadgeService";
import { sevenTVEventApi } from "./sevenTVEventApi";

// Utils
import {
  isActionMessage,
  parseActionMessage,
} from "../../utils/chat/actionMessages";
import { parseReplyThread } from "../../utils/chat/replyParser";
import { parseUserNotice } from "../../utils/chat/userNoticeParser";
import { sanitizeHtml } from "../../utils/chat/sanitize";
import { linkifyURLs } from "../../utils/chat/urlParser";
import { emojifyText } from "../../utils/chat/emojiRenderer";
import { parseMarkdown } from "../../utils/chat/markdownParser";
import { layoutManager } from "../../utils/ui/layoutManager";

export interface V3IntegrationOptions {
  // Badge options
  showFFZAPBadges: boolean;
  showBTTVBadges: boolean;
  showChatterinoBadges: boolean;
  showChatisBadges: boolean;

  // Feature toggles
  enableBits: boolean;
  enableReplies: boolean;
  enableActionMessages: boolean;
  enableUserNotices: boolean;
  enableURLLinking: boolean;
  enableEmojis: boolean;
  enableMarkdown: boolean;

  // Layout options
  reverseLineOrder: boolean;
  singleChatter?: string;
  lastEmoteBackground: boolean;

  // 7TV EventAPI
  enable7TVEventAPI: boolean;
}

/**
 * V3 Integration Service
 * Orchestrates all new features
 */
export class V3IntegrationService {
  private options: V3IntegrationOptions;
  private initialized: boolean = false;

  constructor(options: Partial<V3IntegrationOptions> = {}) {
    // Default options
    this.options = {
      showFFZAPBadges: true,
      showBTTVBadges: true,
      showChatterinoBadges: true,
      showChatisBadges: true,
      enableBits: true,
      enableReplies: true,
      enableActionMessages: true,
      enableUserNotices: true,
      enableURLLinking: true,
      enableEmojis: true,
      enableMarkdown: false,
      reverseLineOrder: false,
      lastEmoteBackground: false,
      enable7TVEventAPI: true,
      ...options,
    };
  }

  /**
   * Initialize all services
   */
  async initialize(channelId: string): Promise<void> {
    if (this.initialized) {
      log.warn(
        LOG_CATEGORIES.INTEGRATION,
        "V3 Integration already initialized",
      );
      return;
    }

    log.info(LOG_CATEGORIES.INTEGRATION, "Initializing V3 Integration...");

    try {
      // Load badge services
      await Promise.all([
        this.options.showFFZAPBadges
          ? ffzapBadgeService.loadBadges()
              .catch((err) => log.error(LOG_CATEGORIES.INTEGRATION, "Failed to load FFZAP badges", err))
          : Promise.resolve(),
        this.options.showBTTVBadges
          ? bttvBadgeService.loadBadges()
              .catch((err) => log.error(LOG_CATEGORIES.INTEGRATION, "Failed to load BTTV badges", err))
          : Promise.resolve(),
        this.options.showChatterinoBadges
          ? chatterinoBadgeService.loadBadges()
              .catch((err) => log.error(LOG_CATEGORIES.INTEGRATION, "Failed to load Chatterino badges", err))
          : Promise.resolve(),
        this.options.showChatisBadges
          ? chatisBadgeService.loadBadges()
              .catch((err) => log.error(LOG_CATEGORIES.INTEGRATION, "Failed to load ChatIS badges", err))
          : Promise.resolve(),
      ]);

      // Load bits service
      if (this.options.enableBits) {
        await bitsService
          .loadCheers(channelId)
          .catch((err) =>
            log.error(LOG_CATEGORIES.INTEGRATION, "Failed to load bits service", err),
          );
      }

      // Setup message manager callbacks
      this.setupMessageManager();

      // Connect 7TV EventAPI
      if (this.options.enable7TVEventAPI) {
        await this.connect7TVEventAPI(channelId);
      }

      // Apply layout options
      layoutManager.setOptions({
        reverseLineOrder: this.options.reverseLineOrder,
        singleChatter: this.options.singleChatter,
        lastEmoteBackground: this.options.lastEmoteBackground,
      });

      this.initialized = true;
      log.info(
        LOG_CATEGORIES.INTEGRATION,
        "V3 Integration initialized successfully",
      );
    } catch (error) {
      log.error(
        LOG_CATEGORIES.INTEGRATION,
        "Failed to initialize V3 Integration:",
        error,
      );
      throw error;
    }
  }

  /**
   * Setup message manager callbacks
   */
  private setupMessageManager(): void {
    messageManager.clearCallbacks();

    // Message deleted callback
    messageManager.onMessageDelete((event) => {
      log.debug(
        LOG_CATEGORIES.INTEGRATION,
        `Message deleted: ${event.messageId}`,
      );
      // Emit event for UI to handle
      window.dispatchEvent(
        new CustomEvent("chatis:message-deleted", {
          detail: { messageId: event.messageId },
        }),
      );
    });

    // User timed out callback
    messageManager.onUserTimeout((event) => {
      log.debug(
        LOG_CATEGORIES.INTEGRATION,
        `User timed out: ${event.username} for ${event.duration}s`,
      );
      window.dispatchEvent(
        new CustomEvent("chatis:user-timeout", {
          detail: { username: event.username, duration: event.duration },
        }),
      );
    });

    // Chat cleared callback
    messageManager.onChatClear(() => {
      log.debug(LOG_CATEGORIES.INTEGRATION, "Chat cleared");
      window.dispatchEvent(new CustomEvent("chatis:chat-cleared"));
    });
  }

  /**
   * Connect to 7TV EventAPI
   * NOTE: 7TV EventAPI requires numeric Twitch channel ID, not username
   */
  private async connect7TVEventAPI(channelId: string): Promise<void> {
    // Проверяем что channelId - это число, а не username
    if (!/^\d+$/.test(channelId)) {
      log.warn(
        LOG_CATEGORIES.INTEGRATION,
        "7TV EventAPI requires numeric channel ID, skipping (got username instead)",
      );
      log.warn(LOG_CATEGORIES.INTEGRATION, `7TV EventAPI requires numeric channel ID, got: ${channelId}`);
      return;
    }

    try {
      await sevenTVEventApi.connect(channelId, (event) => {
        log.debug(LOG_CATEGORIES.SEVENTV_API, `EventAPI event: ${event.type}`);

        // Emit event for UI to handle
        window.dispatchEvent(
          new CustomEvent("chatis:7tv-event", {
            detail: event,
          }),
        );
      });

      log.info(LOG_CATEGORIES.INTEGRATION, "7TV EventAPI connected");
    } catch (error) {
      log.error(LOG_CATEGORIES.INTEGRATION, "Failed to connect 7TV EventAPI", error);
      log.error(
        LOG_CATEGORIES.INTEGRATION,
        "Failed to connect 7TV EventAPI:",
        error,
      );
    }
  }

  /**
   * Process IRC message with all features
   */
  processIRCMessage(rawMessage: string, tags: Map<string, string>): any {
    const result: any = {
      raw: rawMessage,
      tags,
      enhanced: {},
    };

    try {
      // Parse reply thread
      if (this.options.enableReplies) {
        const reply = parseReplyThread(tags);
        if (reply) {
          result.enhanced.reply = reply;
        }
      }

      // Detect action message
      if (this.options.enableActionMessages) {
        const messageText = tags.get("message") || "";
        if (isActionMessage(messageText)) {
          result.enhanced.isAction = true;
          result.enhanced.actionText = parseActionMessage(messageText);
        }
      }

      // Detect bits/cheers
      if (this.options.enableBits) {
        const messageText = tags.get("message") || "";
        const cheers = bitsService.detectCheers(messageText);
        if (cheers.length > 0) {
          result.enhanced.cheers = cheers;
          result.enhanced.totalBits = bitsService.calculateTotalBits(cheers);
        }
      }

      // Check message manager
      const messageId = tags.get("id");
      if (messageId && messageManager.isMessageDeleted(messageId)) {
        result.enhanced.isDeleted = true;
      }

      const username = tags.get("login");
      if (username && messageManager.shouldHideUser(username)) {
        result.enhanced.isHidden = true;
      }
    } catch (error) {
      log.error(
        LOG_CATEGORIES.INTEGRATION,
        "Error processing IRC message:",
        error,
      );
    }

    return result;
  }

  /**
   * Process USERNOTICE message
   */
  processUserNotice(rawMessage: string): any {
    if (!this.options.enableUserNotices) {
      return null;
    }

    try {
      return parseUserNotice(rawMessage);
    } catch (error) {
      log.error(
        LOG_CATEGORIES.INTEGRATION,
        "Error processing USERNOTICE:",
        error,
      );
      return null;
    }
  }

  /**
   * Enhance message text with all features
   */
  enhanceMessageText(text: string): string {
    let enhanced = text;

    try {
      // Sanitize HTML
      enhanced = sanitizeHtml(enhanced);

      // Parse markdown
      if (this.options.enableMarkdown) {
        enhanced = parseMarkdown(enhanced);
      }

      // Linkify URLs
      if (this.options.enableURLLinking) {
        enhanced = linkifyURLs(enhanced);
      }

      // Emojify
      if (this.options.enableEmojis) {
        enhanced = emojifyText(enhanced);
      }
    } catch (error) {
      log.error(
        LOG_CATEGORIES.INTEGRATION,
        "Error enhancing message text:",
        error,
      );
      return text;
    }

    return enhanced;
  }

  /**
   * Get all badges for user
   */
  getUserBadges(username: string, userId: string): any[] {
    const badges: any[] = [];

    try {
      // ChatIS badges
      if (this.options.showChatisBadges) {
        const chatisBadges = chatisBadgeService.getUserBadges(username);
        badges.push(...chatisBadges.map((b) => ({ source: "chatis", ...b })));
      }

      // FFZ:AP badges
      if (this.options.showFFZAPBadges) {
        const ffzBadges = ffzapBadgeService.getUserBadges(userId);
        badges.push(...ffzBadges.map((b) => ({ source: "ffzap", ...b })));
      }

      // BTTV badges
      if (this.options.showBTTVBadges) {
        const bttvBadges = bttvBadgeService.getUserBadges(userId);
        badges.push(...bttvBadges.map((b) => ({ source: "bttv", ...b })));
      }

      // Chatterino badges
      if (this.options.showChatterinoBadges) {
        const chatBadges = chatterinoBadgeService.getUserBadges(username);
        badges.push(...chatBadges.map((b) => ({ source: "chatterino", ...b })));
      }
    } catch (error) {
      log.error(
        LOG_CATEGORIES.INTEGRATION,
        "Error getting user badges:",
        error,
      );
    }

    return badges;
  }

  /**
   * Update options
   */
  setOptions(options: Partial<V3IntegrationOptions>): void {
    this.options = { ...this.options, ...options };

    // Update layout manager
    layoutManager.setOptions({
      reverseLineOrder: this.options.reverseLineOrder,
      singleChatter: this.options.singleChatter,
      lastEmoteBackground: this.options.lastEmoteBackground,
    });
  }

  /**
   * Get 7TV EventAPI instance for accessing cosmetics
   */
  get7TVEventAPI() {
    return sevenTVEventApi;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    sevenTVEventApi.disconnect();
    messageManager.clearCallbacks();
    messageManager.clear();
    this.initialized = false;

    log.info(LOG_CATEGORIES.INTEGRATION, "V3 Integration destroyed");
  }
}

// Singleton instance
export const v3Integration = new V3IntegrationService();
