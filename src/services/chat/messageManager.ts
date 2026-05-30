/**
 * Message Management Service
 * Handles message deletion, timeouts, and bans
 */

import { log, LOG_CATEGORIES } from "../../utils/logger";

export interface MessageDeletionEvent {
  messageId: string;
  username: string;
  channelName: string;
  timestamp: Date;
}

export interface UserTimeoutEvent {
  username: string;
  duration: number; // seconds, 0 = permanent ban
  channelName: string;
  timestamp: Date;
  reason?: string;
}

export interface ChatClearEvent {
  channelName: string;
  timestamp: Date;
}

export type MessageManagerCallback = () => void;

export class MessageManager {
  private deletedMessages: Set<string> = new Set();
  private timedOutUsers: Map<string, Date> = new Map(); // username -> timeout end time
  private bannedUsers: Set<string> = new Set();

  private onMessageDeleteCallbacks: Array<
    (event: MessageDeletionEvent) => void
  > = [];
  private onUserTimeoutCallbacks: Array<(event: UserTimeoutEvent) => void> = [];
  private onChatClearCallbacks: Array<(event: ChatClearEvent) => void> = [];

  /**
   * Handle CLEARCHAT command (user timeout/ban or full chat clear)
   * Format: @ban-duration=<seconds>;room-id=<id>;target-user-id=<id>;tmi-sent-ts=<ts> :tmi.twitch.tv CLEARCHAT #channel :username
   * Or for full clear: :tmi.twitch.tv CLEARCHAT #channel
   */
  handleCLEARCHAT(
    tags: Record<string, string>,
    channel: string,
    username?: string,
  ): void {
    const channelName = channel.replace("#", "");

    if (!username) {
      // Full chat clear
      log.info(LOG_CATEGORIES.TWITCH_IRC, `Chat cleared in ${channelName}`);
      const event: ChatClearEvent = {
        channelName,
        timestamp: new Date(),
      };
      this.triggerChatClear(event);
      return;
    }

    // User timeout or ban
    const banDuration = tags["ban-duration"];
    const duration = banDuration ? parseInt(banDuration, 10) : 0;

    if (duration === 0) {
      // Permanent ban
      this.bannedUsers.add(username.toLowerCase());
      log.info(
        LOG_CATEGORIES.TWITCH_IRC,
        `User banned: ${username} in ${channelName}`,
      );
    } else {
      // Timeout
      const timeoutEnd = new Date(Date.now() + duration * 1000);
      this.timedOutUsers.set(username.toLowerCase(), timeoutEnd);
      log.info(
        LOG_CATEGORIES.TWITCH_IRC,
        `User timed out: ${username} for ${duration}s in ${channelName}`,
      );
    }

    const event: UserTimeoutEvent = {
      username,
      duration,
      channelName,
      timestamp: new Date(),
      reason: tags["ban-reason"],
    };

    this.triggerUserTimeout(event);
  }

  /**
   * Handle CLEARMSG command (single message deletion)
   * Format: @login=<username>;room-id=<>;target-msg-id=<id>;tmi-sent-ts=<ts> :tmi.twitch.tv CLEARMSG #channel :message text
   */
  handleCLEARMSG(tags: Record<string, string>, channel: string): void {
    const messageId = tags["target-msg-id"];
    const username = tags["login"];

    if (!messageId) {
      log.warn(LOG_CATEGORIES.TWITCH_IRC, "CLEARMSG without target-msg-id");
      return;
    }

    this.deletedMessages.add(messageId);

    const channelName = channel.replace("#", "");
    log.info(
      LOG_CATEGORIES.TWITCH_IRC,
      `Message deleted: ${messageId} from ${username} in ${channelName}`,
    );

    const event: MessageDeletionEvent = {
      messageId,
      username: username || "unknown",
      channelName,
      timestamp: new Date(),
    };

    this.triggerMessageDelete(event);
  }

  /**
   * Check if a message is deleted
   */
  isMessageDeleted(messageId: string): boolean {
    return this.deletedMessages.has(messageId);
  }

  /**
   * Check if a user is currently timed out
   */
  isUserTimedOut(username: string): boolean {
    const timeoutEnd = this.timedOutUsers.get(username.toLowerCase());
    if (!timeoutEnd) {
      return false;
    }

    // Check if timeout has expired
    if (new Date() > timeoutEnd) {
      this.timedOutUsers.delete(username.toLowerCase());
      return false;
    }

    return true;
  }

  /**
   * Check if a user is banned
   */
  isUserBanned(username: string): boolean {
    return this.bannedUsers.has(username.toLowerCase());
  }

  /**
   * Should hide a user's messages (banned or timed out)
   */
  shouldHideUser(username: string): boolean {
    return this.isUserBanned(username) || this.isUserTimedOut(username);
  }

  /**
   * Register callback for message deletion
   */
  onMessageDelete(callback: (event: MessageDeletionEvent) => void): void {
    this.onMessageDeleteCallbacks.push(callback);
  }

  /**
   * Register callback for user timeout/ban
   */
  onUserTimeout(callback: (event: UserTimeoutEvent) => void): void {
    this.onUserTimeoutCallbacks.push(callback);
  }

  /**
   * Register callback for chat clear
   */
  onChatClear(callback: (event: ChatClearEvent) => void): void {
    this.onChatClearCallbacks.push(callback);
  }

  /**
   * Trigger message deletion callbacks
   */
  private triggerMessageDelete(event: MessageDeletionEvent): void {
    this.onMessageDeleteCallbacks.forEach((cb) => {
      try {
        cb(event);
      } catch (error) {
        log.error(
          LOG_CATEGORIES.TWITCH_IRC,
          "Error in message delete callback:",
          error,
        );
      }
    });
  }

  /**
   * Trigger user timeout callbacks
   */
  private triggerUserTimeout(event: UserTimeoutEvent): void {
    this.onUserTimeoutCallbacks.forEach((cb) => {
      try {
        cb(event);
      } catch (error) {
        log.error(
          LOG_CATEGORIES.TWITCH_IRC,
          "Error in user timeout callback:",
          error,
        );
      }
    });
  }

  /**
   * Trigger chat clear callbacks
   */
  private triggerChatClear(event: ChatClearEvent): void {
    this.onChatClearCallbacks.forEach((cb) => {
      try {
        cb(event);
      } catch (error) {
        log.error(
          LOG_CATEGORIES.TWITCH_IRC,
          "Error in chat clear callback:",
          error,
        );
      }
    });
  }

  /**
   * Clear all data (for cleanup)
   */
  clear(): void {
    this.deletedMessages.clear();
    this.timedOutUsers.clear();
    this.bannedUsers.clear();
  }

  clearCallbacks(): void {
    this.onMessageDeleteCallbacks = [];
    this.onUserTimeoutCallbacks = [];
    this.onChatClearCallbacks = [];
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      deletedMessages: this.deletedMessages.size,
      timedOutUsers: this.timedOutUsers.size,
      bannedUsers: this.bannedUsers.size,
    };
  }
}

// Singleton instance
export const messageManager = new MessageManager();
