import { emoteService } from "./emoteService";
import { log, LOG_CATEGORIES } from "../../utils/logger";

// 7TV EventAPI v3 WebSocket service for real-time updates
// https://github.com/SevenTV/EventAPI

export interface SevenTVEmoteSet {
  id: string;
  name: string;
  emotes: SevenTVActiveEmote[];
}

export interface SevenTVActiveEmote {
  id: string;
  name: string;
  flags: number;
  data: {
    id: string;
    name: string;
    flags: number;
    host: {
      url: string;
      files: Array<{ name: string; format: string; width: number }>;
    };
    listed: boolean;
  };
}

export interface SevenTVCosmetic {
  id: string;
  kind: "BADGE" | "PAINT";
  name?: string;
  tooltip?: string;
  host?: {
    url: string;
    files: Array<{ name: string }>;
  };
  data?: {
    name: string;
    function: string;
    color: number | null;
    stops: Array<{ at: number; color: number }>;
    shadows: Array<{
      x_offset: number;
      y_offset: number;
      radius: number;
      color: number;
    }>;
  };
}

export interface SevenTVEventDispatch {
  type: string;
  body: {
    id: string;
    kind: string;
    actor: { id: string; username: string };
    added?: any[];
    removed?: any[];
    updated?: any[];
    object?: any;
    pulled?: any[];
    pushed?: any[];
  };
}

type EventCallback = (event: SevenTVEventDispatch) => void;

// Opcodes for 7TV EventAPI
const OPS = {
  DISPATCH: 0,
  HELLO: 1,
  HEARTBEAT: 2,
  RECONNECT: 4,
  ACK: 5,
  ERROR: 6,
  END_OF_STREAM: 7,
  IDENTIFY: 33,
  RESUME: 34,
  SUBSCRIBE: 35,
  UNSUBSCRIBE: 36,
  SIGNAL: 37,
};

export class SevenTVEventApiService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private ackCount: number = 0;
  private heartbeatInterval: number | null = null;
  private heartbeatIntervalMs: number = 41250; // Store the interval value
  private heartbeatTimeoutId: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private intentionallyDisconnected = false;
  private suppressCloseReconnectFor: WebSocket | null = null;
  private channelId: string = "";
  private channelUserId: string = ""; // 7TV user ID of the streamer
  private channelEmoteSetId: string = "";
  private onEventCallback: EventCallback | null = null;

  public cosmetics: Map<string, any> = new Map();
  public userCosmetics: Map<string, string[]> = new Map();
  public userEmoteSets: Map<string, string> = new Map();

  // Cache для actor_id → username (как в v2)
  private actorIdToUsername: Map<string, string> = new Map();

  constructor() {}

  public async connect(channelId: string, onEvent: EventCallback) {
    this.intentionallyDisconnected = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.channelId = channelId;
    this.onEventCallback = onEvent;

    // Fetch channel emote set ID and user ID
    try {
      const response = await fetch(
        `https://7tv.io/v3/users/twitch/${channelId}`,
      );
      const data = await response.json();
      // data.user.id is the 7TV user ID, data.id might be connection ID
      this.channelUserId = data.user?.id || data.id || "";
      this.channelEmoteSetId = data.emote_set?.id || "";
      // Connected successfully

      if (!this.channelUserId) {
        log.warn(LOG_CATEGORIES.SEVENTV_API, "Failed to get 7TV user ID from response");
      }
    } catch (error) {
      log.error(LOG_CATEGORIES.SEVENTV_API, "Failed to fetch channel data", error);
    }

    this.connectWs();
  }

  private connectWs() {
    if (
      this.intentionallyDisconnected ||
      (this.ws &&
        (this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING))
    ) {
      return;
    }

    const ws = new WebSocket("wss://events.7tv.io/v3");
    this.ws = ws;

    ws.onopen = () => {};

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (error) {
        log.error(LOG_CATEGORIES.SEVENTV_API, "Failed to parse WebSocket message", error);
      }
    };

    ws.onclose = () => {
      const suppressReconnect = this.suppressCloseReconnectFor === ws;
      if (suppressReconnect) {
        this.suppressCloseReconnectFor = null;
      }
      if (this.ws === ws) {
        this.cleanup(false);
      }
      if (this.intentionallyDisconnected || suppressReconnect) {
        return;
      }
      this.scheduleReconnect();
    };

    ws.onerror = (error) => {
      if (this.intentionallyDisconnected) return;
      log.error(LOG_CATEGORIES.SEVENTV_API, "WebSocket error", error);
      this.reconnectNow();
    };
  }

  private handleMessage(msg: any) {
    const { op, d } = msg;

    switch (op) {
      case OPS.HELLO:
        this.sessionId = d.session_id;
        this.startHeartbeat(d.heartbeat_interval);
        this.subscribe();
        break;

      case OPS.DISPATCH:
        this.handleDispatch(d);
        if (this.onEventCallback) {
          this.onEventCallback(d);
        }
        break;

      case OPS.HEARTBEAT:
        // Server sent heartbeat, acknowledge we're alive
        this.gotHeartbeat();
        break;

      case OPS.RECONNECT:
        this.reconnectNow();
        break;

      case OPS.ACK:
        this.ackCount++;
        break;

      case OPS.ERROR:
        log.error(LOG_CATEGORIES.SEVENTV_API, "Received ERROR", d);
        // Reconnect on error
        this.reconnectNow();
        break;

      case OPS.END_OF_STREAM:
        this.ws?.close();
        break;

      default:
        break;
    }
  }

  private subscribe() {
    const subscriptions: any[] = [];

    // Subscribe to 7TV user (for emote set changes via user.update)
    // Only subscribe if we have a valid 7TV user ID (not Twitch ID)
    if (this.channelUserId && this.channelUserId !== this.channelId) {
      subscriptions.push({
        type: "user.*",
        condition: { object_id: this.channelUserId },
      });
    }

    // Subscribe to specific emote set by ID (for emote add/remove in set)
    if (this.channelEmoteSetId) {
      subscriptions.push({
        type: "emote_set.*",
        condition: { object_id: this.channelEmoteSetId },
      });
    }

    // Subscribe to channel emote_set events (for any emote set changes on channel)
    if (this.channelId) {
      subscriptions.push({
        type: "emote_set.*",
        condition: {
          ctx: "channel",
          platform: "TWITCH",
          id: this.channelId,
        },
      });
    }

    // Subscribe to channel cosmetics and entitlements
    if (this.channelId) {
      subscriptions.push(
        {
          type: "cosmetic.*",
          condition: {
            ctx: "channel",
            platform: "TWITCH",
            id: this.channelId,
          },
        },
        {
          type: "entitlement.*",
          condition: {
            ctx: "channel",
            platform: "TWITCH",
            id: this.channelId,
          },
        },
      );
    }

    // В v2 каждая подписка отправляется отдельным сообщением
    subscriptions.forEach((subscription) => {
      this.sendMessage(OPS.SUBSCRIBE, subscription);
    });
  }

  private sendMessage(op: number, d: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op, d, t: Date.now() }));
    }
  }

  private startHeartbeat(interval: number) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
    }

    this.heartbeatIntervalMs = interval;

    // Setup timeout - if we don't get heartbeat from server, reconnect
    // In v2, client does NOT send heartbeats, only receives them from server
    this.heartbeatTimeoutId = setTimeout(
      () => {
        this.reconnectNow();
      },
      3 * (this.heartbeatIntervalMs + 1000),
    );
  }

  private gotHeartbeat() {
    // Reset the timeout when we receive heartbeat from server
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
    }

    // Use stored interval
    this.heartbeatTimeoutId = setTimeout(
      () => {
        this.reconnectNow();
      },
      3 * (this.heartbeatIntervalMs + 1000),
    );
  }

  private async handleDispatch(data: SevenTVEventDispatch) {
    switch (data.type) {
      case "user.update": {
        // Handle user changes (like emote set change)
        const updated = data.body?.updated;
        if (Array.isArray(updated)) {
          for (const change of updated) {
            if (change.key === "connections") {
              const connections = change.value;
              if (Array.isArray(connections)) {
                for (const conn of connections) {
                  if (conn.key === "emote_set") {
                    const newSetId = conn.value?.id;
                    if (newSetId && newSetId !== this.channelEmoteSetId) {
                      this.channelEmoteSetId = newSetId;

                      // Resubscribe to new set
                      this.sendMessage(OPS.SUBSCRIBE, {
                        type: "emote_set.*",
                        condition: { object_id: newSetId },
                      });

                      // Reload emotes with new set ID
                      await emoteService.reload7TVEmotes(newSetId);
                    }
                  }
                }
              }
            }
          }
        }
        break;
      }

      case "emote_set.update": {
        // Handle channel AND personal emote set changes (add/remove emotes)
        const emoteSetId = data.body?.id;
        const isPersonalSet = emoteSetId !== this.channelEmoteSetId;

        // Найти владельца personal set
        let personalSetOwner: string | null = null;
        if (isPersonalSet && emoteSetId) {
          for (const [username, setId] of this.userEmoteSets.entries()) {
            if (setId === emoteSetId) {
              personalSetOwner = username;
              break;
            }
          }
        }

        // Handle pushed (added) emotes
        if (data.body?.pushed && Array.isArray(data.body.pushed)) {
          for (const item of data.body.pushed) {
            if (item.key === "emotes" && item.value) {
              const emoteData = item.value.data || item.value;
              const emoteName = item.value.name || emoteData.name;

              // Convert to ChatIS format
              const chatisEmote = {
                id: emoteData.id,
                name: emoteName,
                url: `https://cdn.7tv.app/emote/${emoteData.id}/4x.webp`,
                source: "7tv" as const,
                zero_width: (emoteData.flags & 256) !== 0,
              };

              if (isPersonalSet) {
                // Personal set — only add if we know the owner; never leak to channel emotes
                if (personalSetOwner) {
                  emoteService.addPersonalEmote(personalSetOwner, emoteName, chatisEmote);
                }
                // If owner unknown: ignore — entitlement.create will load the full set later
              } else if (this.channelId) {
                // Channel emote
                emoteService.addChannelEmote(this.channelId, emoteName, chatisEmote);
              }
            }
          }
        }

        // Handle pulled (removed) emotes
        if (data.body?.pulled && Array.isArray(data.body.pulled)) {
          for (const item of data.body.pulled) {
            if (item.key === "emotes" && item.old_value) {
              const emoteName = item.old_value.name;

              if (isPersonalSet) {
                if (personalSetOwner) {
                  emoteService.removePersonalEmote(personalSetOwner, emoteName);
                }
              } else if (this.channelId) {
                emoteService.removeChannelEmote(this.channelId, emoteName);
              }
            }
          }
        }
        break;
      }

      case "cosmetic.create": {
        const obj = data.body.object;
        if (obj && (obj.kind === "PAINT" || obj.kind === "BADGE")) {
          const cosmetic = obj.data;
          cosmetic._kind = obj.kind;
          this.cosmetics.set(obj.id, cosmetic);
        }
        break;
      }

      case "cosmetic.delete": {
        const obj = data.body.object;
        if (obj && (obj.kind === "PAINT" || obj.kind === "BADGE")) {
          this.cosmetics.delete(obj.id);
        }
        break;
      }

      case "entitlement.create": {
        const obj = data.body.object;
        if (!obj) break;

        const username =
          (
            (obj.user?.connections || []).find(
              (conn: any) => conn.platform === "TWITCH",
            ) || {}
          ).username || obj.user?.username;

        if (!username) break;

        switch (obj.kind) {
          case "BADGE": {
            if (!this.userCosmetics.has(username)) {
              this.userCosmetics.set(username, []);
            }
            const badges = this.userCosmetics.get(username)!;
            if (!badges.includes(obj.ref_id)) {
              badges.push(obj.ref_id);
            }
            break;
          }

          case "PAINT": {
            if (!this.userCosmetics.has(username)) {
              this.userCosmetics.set(username, []);
            }
            const paints = this.userCosmetics.get(username)!;
            if (!paints.includes(obj.ref_id)) {
              paints.push(obj.ref_id);
            }
            break;
          }

          case "EMOTE_SET": {
            // Track the emote set ID and load it immediately
            this.userEmoteSets.set(username, obj.ref_id);
            log.debug(LOG_CATEGORIES.SEVENTV_API, `User ${username} has personal emote set: ${obj.ref_id}`);
            // Load the personal emote set right away
            this.loadUserEmoteSet(username, obj.ref_id);
            break;
          }
        }
        break;
      }

      case "entitlement.delete": {
        const obj = data.body.object;
        if (!obj) break;

        const username =
          (
            (obj.user?.connections || []).find(
              (conn: any) => conn.platform === "TWITCH",
            ) || {}
          ).username || obj.user?.username;

        if (!username) break;

        // Handle emote set removal
        if (obj.kind === "EMOTE_SET") {
          this.userEmoteSets.delete(username);
          emoteService.removePersonalEmotes(username);
          break;
        }

        // Remove cosmetic ID from user
        if (this.userCosmetics.has(username)) {
          const cosmetics = this.userCosmetics.get(username)!;
          const filtered = cosmetics.filter((id) => id !== obj.ref_id);
          this.userCosmetics.set(username, filtered);
        }
        break;
      }

      default:
        break;
    }
  }

  private scheduleReconnect() {
    if (this.intentionallyDisconnected) return;
    if (this.reconnectTimeout) return;

    const delay = 3000 + Math.random() * 2000;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.intentionallyDisconnected) {
        this.connectWs();
      }
    }, delay);
  }

  private reconnectNow() {
    if (this.intentionallyDisconnected) return;
    this.cleanup();
    this.connectWs();
  }

  private cleanup(closeSocket = true) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      if (closeSocket) {
        this.suppressCloseReconnectFor = ws;
        ws.close();
      }
    }
    this.sessionId = null;
    this.ackCount = 0;
  }

  public disconnect() {
    this.intentionallyDisconnected = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.cleanup();
    this.onEventCallback = null;
  }

  /**
   * Get 7TV badges for a user
   */
  public getUserBadges(username: string): any[] {
    const cosmeticIds = this.userCosmetics.get(username) || [];
    const badges: any[] = [];

    for (const id of cosmeticIds) {
      const cosmetic = this.cosmetics.get(id);

      if (
        cosmetic &&
        (cosmetic._kind === "BADGE" || cosmetic.kind === "BADGE")
      ) {
        if (!cosmetic.host || !cosmetic.host.url) {
          continue;
        }

        badges.push({
          source: "7tv",
          id: id,
          title: cosmetic.tooltip || cosmetic.name || "7TV Badge",
          url: "https:" + cosmetic.host.url + "/3x",
        });
      }
    }

    return badges;
  }

  /**
   * Get 7TV paint for a user
   */
  public getUserPaint(username: string): any | null {
    const cosmeticIds = this.userCosmetics.get(username) || [];

    for (const id of cosmeticIds) {
      const cosmetic = this.cosmetics.get(id);
      if (cosmetic && cosmetic._kind === "PAINT") {
        return cosmetic;
      }
    }

    return null;
  }

  /**
   * Get username from 7TV actor_id (cached, like v2)
   */
  private async getUsernameFromActorId(
    actorId: string,
  ): Promise<string | null> {
    // Check cache first
    if (this.actorIdToUsername.has(actorId)) {
      return this.actorIdToUsername.get(actorId)!;
    }

    try {
      // Fetch user data from 7TV
      const response = await fetch(`https://7tv.io/v3/users/${actorId}`);
      if (!response.ok) return null;

      const userData = await response.json();

      // Get Twitch username from connections
      const twitchConnection = (userData.connections || []).find(
        (conn: any) => conn.platform === "TWITCH",
      );

      const username = twitchConnection?.username || userData.username;

      if (username) {
        if (this.actorIdToUsername.size >= 500) {
          const firstKey = this.actorIdToUsername.keys().next().value;
          if (firstKey !== undefined) this.actorIdToUsername.delete(firstKey);
        }
        this.actorIdToUsername.set(actorId, username);
        return username;
      }
    } catch (error) {
      log.error(LOG_CATEGORIES.SEVENTV_API, "Failed to get username from actor_id", error);
    }

    return null;
  }

  /**
   * Load user's personal emote set
   */
  private async loadUserEmoteSet(
    username: string,
    emoteSetId: string,
  ): Promise<void> {
    try {
      const response = await fetch(
        `https://7tv.io/v3/emote-sets/${emoteSetId}`,
      );
      if (!response.ok) {
        log.warn(LOG_CATEGORIES.SEVENTV_API, `Failed to load personal emote set ${emoteSetId}: ${response.status}`);
        return;
      }

      const emoteSet = await response.json();
      if (!emoteSet.emotes) {
        log.warn(LOG_CATEGORIES.SEVENTV_API, `No emotes in personal set ${emoteSetId}`);
        return;
      }

      let addedCount = 0;
      emoteSet.emotes.forEach((emoteWithMeta: any) => {
        const emote = emoteWithMeta.data;
        const activeName = emoteWithMeta.name;
        const originalName = emote.name;

        const chatisEmote = {
          id: emote.id,
          name: activeName,
          url: `https://cdn.7tv.app/emote/${emote.id}/4x.webp`,
          source: "7tv" as const,
          zero_width: (emote.flags & 256) !== 0, // EmoteFlagsZeroWidth = 256
          original_name: activeName !== originalName ? originalName : undefined,
        };

        emoteService.addPersonalEmote(username, activeName, chatisEmote);
        addedCount++;
      });

      log.debug(LOG_CATEGORIES.SEVENTV_API, `Loaded ${addedCount} personal emotes for ${username}`);
    } catch (error) {
      log.error(LOG_CATEGORIES.SEVENTV_API, "Failed to load user emote set", error);
    }
  }
}

// Export singleton instance
export const sevenTVEventApi = new SevenTVEventApiService();
