import { log, LOG_CATEGORIES } from "~/utils/logger";
import {
  FALLBACK_APIS,
  fetchWithFallback,
  TWITCH_CONFIG,
} from "~/config/twitch";

// Сервис для загрузки эмодзи из 7TV, FFZ, BTTV

export interface Emote {
  id: string;
  name: string;
  url: string;
  source: "7tv" | "ffz" | "bttv" | "cheer";
  zero_width?: boolean;
  width?: number;
  height?: number;
  original_name?: string; // Alias for 7TV renamed emotes
}

export interface EmoteData {
  emotes: { [name: string]: Emote };
  channelEmotes: { [channelId: string]: { [name: string]: Emote } };
  personalEmotes: { [username: string]: { [name: string]: Emote } }; // NEW: personal emotes
}

export type LoadEmoteOptions = {
  show7tvUnlisted?: boolean;
};

function isTwitchUserId(value: string): boolean {
  return /^\d+$/.test(value) && value !== "0";
}

class EmoteService {
  private emoteData: EmoteData = {
    emotes: {},
    channelEmotes: {},
    personalEmotes: {}, // NEW
  };

  private currentChannelId: string = "";
  private currentChannelName: string = "";
  private globalEmotesLoaded = false;
  private globalEmotesPromise: Promise<void> | null = null;
  private channelLoadPromises = new Map<string, Promise<void>>();
  private show7tvUnlisted = true;
  private loaded7tvVisibility: boolean | null = null;

  async loadEmotes(
    channelId: string,
    channelName: string,
    options: LoadEmoteOptions = {},
  ): Promise<void> {
    const hasChannelId = isTwitchUserId(channelId);
    this.currentChannelId = hasChannelId ? channelId : "";
    this.currentChannelName = channelName;
    const nextShow7tvUnlisted = options.show7tvUnlisted ?? true;
    if (
      this.loaded7tvVisibility !== null &&
      this.loaded7tvVisibility !== nextShow7tvUnlisted
    ) {
      this.clearSevenTVEmotes();
    }
    this.show7tvUnlisted = nextShow7tvUnlisted;
    this.loaded7tvVisibility = nextShow7tvUnlisted;

    try {
      // Загружаем глобальные эмодзи один раз на сессию
      if (!this.globalEmotesPromise) {
        this.globalEmotesPromise = this.loadGlobalEmotes().catch((error) => {
          log.error(
            LOG_CATEGORIES.EMOTES,
            "Failed to load global emotes",
            error,
          );
          this.globalEmotesPromise = null; // allow retry on next call
        });
      }

      let channelLoadPromise: Promise<void> | undefined;
      if (hasChannelId) {
        const channelKey = channelId;
        if (!this.channelLoadPromises.has(channelKey)) {
          this.channelLoadPromises.set(
            channelKey,
            this.loadChannelEmotes(channelId).catch((error) => {
              log.error(LOG_CATEGORIES.EMOTES, "Failed to load emotes", error);
            }),
          );
        }
        channelLoadPromise = this.channelLoadPromises.get(channelKey);
      }

      await Promise.all([
        this.globalEmotesPromise,
        channelLoadPromise,
        hasChannelId ? this.loadCheerEmotes(channelId) : undefined,
      ]);
    } catch (error) {
      log.error(LOG_CATEGORIES.EMOTES, "Failed to load emotes", error);
    }
  }

  async reload7TVEmotes(newEmoteSetId?: string): Promise<void> {
    if (this.currentChannelId) {
      // Clear old 7TV emotes before reloading (keep other emotes)
      // Remove 7TV global emotes
      for (const [name, emote] of Object.entries(this.emoteData.emotes)) {
        if (emote.source === "7tv") {
          delete this.emoteData.emotes[name];
        }
      }

      // Remove 7TV channel emotes
      if (this.emoteData.channelEmotes[this.currentChannelId]) {
        for (const [name, emote] of Object.entries(
          this.emoteData.channelEmotes[this.currentChannelId],
        )) {
          if (emote.source === "7tv") {
            delete this.emoteData.channelEmotes[this.currentChannelId][name];
          }
        }
      }

      await this.load7TVEmotes(this.currentChannelId, newEmoteSetId);
    }
  }

  async reloadEmotes(
    channelId = this.currentChannelId,
    channelName = this.currentChannelName,
    options: LoadEmoteOptions = { show7tvUnlisted: this.show7tvUnlisted },
  ): Promise<void> {
    this.emoteData.emotes = {};
    if (channelId) this.emoteData.channelEmotes[channelId] = {};
    this.globalEmotesLoaded = false;
    this.globalEmotesPromise = null;
    this.channelLoadPromises.delete(channelId);
    await this.loadEmotes(channelId, channelName, options);
  }

  private async loadGlobalEmotes(): Promise<void> {
    if (this.globalEmotesLoaded) return;

    await Promise.all([
      this.load7TVGlobalEmotes(),
      this.loadFFZGlobalEmotes(),
      this.loadBTTVGlobalEmotes(),
    ]);

    this.globalEmotesLoaded = true;
  }

  private clearSevenTVEmotes(): void {
    for (const [name, emote] of Object.entries(this.emoteData.emotes)) {
      if (emote.source === "7tv") {
        delete this.emoteData.emotes[name];
      }
    }

    Object.values(this.emoteData.channelEmotes).forEach((channelEmotes) => {
      for (const [name, emote] of Object.entries(channelEmotes)) {
        if (emote.source === "7tv") {
          delete channelEmotes[name];
        }
      }
    });

    this.globalEmotesLoaded = false;
    this.globalEmotesPromise = null;
    this.channelLoadPromises.clear();
  }

  private async loadChannelEmotes(channelId: string): Promise<void> {
    await Promise.all([
      this.load7TVChannelEmotes(channelId),
      this.loadFFZChannelEmotes(channelId),
      this.loadBTTVChannelEmotes(channelId),
    ]);
  }

  private async load7TVEmotes(
    channelId: string,
    emoteSetId?: string,
  ): Promise<void> {
    try {
      // Канальные 7TV эмодзи - use specific set ID if provided to avoid race conditions
      if (emoteSetId) {
        const setResponse = await fetch(
          `https://7tv.io/v3/emote-sets/${emoteSetId}`,
        );
        if (setResponse.ok) {
          const setData = await setResponse.json();

          if (setData.emotes) {
            setData.emotes.forEach((emoteWithMeta: any) => {
              if (!this.shouldIncludeSevenTVEmote(emoteWithMeta)) return;
              const emote = emoteWithMeta.data;
              const activeName = emoteWithMeta.name;
              const originalName = emote.name;
              const normalizedEmote = this.normalizeSevenTVEmote(emote);
              normalizedEmote.name = activeName;
              normalizedEmote.original_name =
                activeName !== originalName ? originalName : undefined;
              this.emoteData.channelEmotes[channelId] =
                this.emoteData.channelEmotes[channelId] || {};
              this.emoteData.channelEmotes[channelId][activeName] = normalizedEmote;
            });
          }
        } else {
          log.error(
            LOG_CATEGORIES.EMOTES,
            `Failed to load emote set ${emoteSetId}: HTTP ${setResponse.status}`,
          );
        }
      } else {
        // Fall back to user endpoint if no set ID provided
        const channelResponse = await fetch(
          `https://7tv.io/v3/users/twitch/${channelId}`,
        );
        if (channelResponse.ok) {
          const channelData = await channelResponse.json();

          if (channelData.emote_set && channelData.emote_set.emotes) {
            channelData.emote_set.emotes.forEach((emoteWithMeta: any) => {
              if (!this.shouldIncludeSevenTVEmote(emoteWithMeta)) return;
              const emote = emoteWithMeta.data;
              const activeName = emoteWithMeta.name; // Renamed name (priority)
              const originalName = emote.name; // Original name
              const normalizedEmote = this.normalizeSevenTVEmote(emote);
              // Override name with active name (v2 behavior)
              normalizedEmote.name = activeName;
              normalizedEmote.original_name =
                activeName !== originalName ? originalName : undefined;
              this.emoteData.channelEmotes[channelId] =
                this.emoteData.channelEmotes[channelId] || {};
              this.emoteData.channelEmotes[channelId][activeName] = normalizedEmote;
            });
          }
        }
      }
    } catch (error) {
      log.error(LOG_CATEGORIES.EMOTES, "Error loading 7TV emotes", error);
    }
  }

  private async load7TVGlobalEmotes(): Promise<void> {
    try {
      const globalResponse = await fetch("https://7tv.io/v3/emote-sets/global");
      if (!globalResponse.ok) return;
      const globalData = await globalResponse.json();

      if (globalData.emotes) {
        globalData.emotes.forEach((emoteWithMeta: any) => {
          if (!this.shouldIncludeSevenTVEmote(emoteWithMeta)) return;
          const emote = emoteWithMeta.data;
          const activeName = emoteWithMeta.name;
          const originalName = emote.name;
          const normalizedEmote = this.normalizeSevenTVEmote(emote);
          normalizedEmote.name = activeName;
          normalizedEmote.original_name =
            activeName !== originalName ? originalName : undefined;
          this.emoteData.emotes[activeName] = normalizedEmote;
        });
      }
    } catch (error) {
      log.error(
        LOG_CATEGORIES.EMOTES,
        "Error loading 7TV global emotes",
        error,
      );
    }
  }

  private async load7TVChannelEmotes(channelId: string): Promise<void> {
    await this.load7TVEmotes(channelId);
  }

  private shouldIncludeSevenTVEmote(emoteWithMeta: any): boolean {
    return this.show7tvUnlisted || emoteWithMeta?.data?.listed !== false;
  }

  private async loadFFZEmotesFromEndpoint(
    endpoint: string,
    channelId?: string,
    isGlobal = false,
  ): Promise<void> {
    try {
      const response = await fetch(
        "https://api.betterttv.net/3/cached/frankerfacez/" + endpoint,
      );
      if (!response.ok) return;
      const data = await response.json();

      data.forEach((emote: any) => {
        const imageUrl =
          emote.images["4x"] || emote.images["2x"] || emote.images["1x"];

        if (isGlobal) {
          this.emoteData.emotes[emote.code] = {
            id: emote.id.toString(),
            name: emote.code,
            url: imageUrl,
            source: "ffz",
            zero_width: false,
            width: emote.width,
            height: emote.height,
          };
        } else if (channelId) {
          this.emoteData.channelEmotes[channelId] =
            this.emoteData.channelEmotes[channelId] || {};
          this.emoteData.channelEmotes[channelId][emote.code] = {
            id: emote.id.toString(),
            name: emote.code,
            url: imageUrl,
            source: "ffz",
            zero_width: false,
            width: emote.width,
            height: emote.height,
          };
        }
      });
    } catch (error) {
      log.error(
        LOG_CATEGORIES.EMOTES,
        `Failed to load FFZ emotes from ${endpoint}`,
        error,
      );
    }
  }

  private async loadFFZGlobalEmotes(): Promise<void> {
    await this.loadFFZEmotesFromEndpoint("emotes/global", undefined, true);
  }

  private async loadFFZChannelEmotes(channelId: string): Promise<void> {
    await this.loadFFZEmotesFromEndpoint(
      "users/twitch/" + encodeURIComponent(channelId),
      channelId,
      false,
    );
  }

  private async loadBTTVEmotesFromEndpoint(
    endpoint: string,
    channelId?: string,
    isGlobal = false,
  ): Promise<void> {
    try {
      const response = await fetch(
        "https://api.betterttv.net/3/cached/" + endpoint,
      );
      if (!response.ok) return;
      let data = await response.json();

      if (!Array.isArray(data)) {
        data = data.channelEmotes.concat(data.sharedEmotes);
      }

      const bttvZerowidth = [
        "5e76d399d6581c3724c0f0b8", // cvMask
        "5e76d338d6581c3724c0f0b2", // cvHazmat
        "567b5b520e984428652809b6", // SoSnowy
        "5849c9a4f52be01a7ee5f79d", // IceCold
        "567b5c080e984428652809ba", // CandyCane
        "567b5dc00e984428652809bd", // ReinDeer
        "5849c9c8f52be01a7ee5f79e", // TopHat
        "58487cc6f52be01a7ee5f205", // SantaHat
      ];

      data.forEach((emote: any) => {
        if (isGlobal) {
          this.emoteData.emotes[emote.code] = {
            id: emote.id,
            name: emote.code,
            url: "https://cdn.betterttv.net/emote/" + emote.id + "/3x",
            source: "bttv",
            zero_width: bttvZerowidth.includes(emote.id),
            width: emote.width,
            height: emote.height,
          };
        } else if (channelId) {
          this.emoteData.channelEmotes[channelId] =
            this.emoteData.channelEmotes[channelId] || {};
          this.emoteData.channelEmotes[channelId][emote.code] = {
            id: emote.id,
            name: emote.code,
            url: "https://cdn.betterttv.net/emote/" + emote.id + "/3x",
            source: "bttv",
            zero_width: bttvZerowidth.includes(emote.id),
            width: emote.width,
            height: emote.height,
          };
        }
      });
    } catch (error) {
      log.error(
        LOG_CATEGORIES.EMOTES,
        `Failed to load BTTV emotes from ${endpoint}`,
        error,
      );
    }
  }

  private async loadBTTVGlobalEmotes(): Promise<void> {
    await this.loadBTTVEmotesFromEndpoint("emotes/global", undefined, true);
  }

  private async loadBTTVChannelEmotes(channelId: string): Promise<void> {
    await this.loadBTTVEmotesFromEndpoint(
      "users/twitch/" + encodeURIComponent(channelId),
      channelId,
      false,
    );
  }

  private async loadCheerEmotes(channelId: string): Promise<void> {
    try {
      // Cheermotes доступны только через локальный API (требуется OAuth)
      const response = await fetchWithFallback(
        `${TWITCH_CONFIG.API_BASE_URL}/bits/cheermotes?broadcaster_id=${encodeURIComponent(channelId)}`,
        FALLBACK_APIS.cheermotes, // null - нет публичного API
      );

      if (response.ok) {
        const data = await response.json();

        if (data.data) {
          data.data.forEach((action: any) => {
            const prefix = action.prefix;
            action.tiers.forEach((tier: any) => {
              const emoteName = `${prefix}${tier.min_bits}`;
              this.emoteData.emotes[emoteName] = {
                id: `${prefix}_${tier.min_bits}`,
                name: emoteName,
                url: tier.images.dark.animated["4"],
                source: "cheer",
                zero_width: false,
                width: 28,
                height: 28,
              };
            });
          });
        }
      }
    } catch (error) {
      log.error(LOG_CATEGORIES.EMOTES, "Failed to load cheer emotes", error);
      // Fallback: добавляем несколько базовых Cheer эмоутов для тестирования
      const fallbackEmotes = [
        {
          name: "Cheer1",
          url: "https://d3aqoihi2n8ty8.cloudfront.net/actions/cheer/dark/animated/1/1.gif",
        },
        {
          name: "Cheer100",
          url: "https://d3aqoihi2n8ty8.cloudfront.net/actions/cheer/dark/animated/100/1.gif",
        },
        {
          name: "Cheer1000",
          url: "https://d3aqoihi2n8ty8.cloudfront.net/actions/cheer/dark/animated/1000/1.gif",
        },
        {
          name: "Cheer5000",
          url: "https://d3aqoihi2n8ty8.cloudfront.net/actions/cheer/dark/animated/5000/1.gif",
        },
        {
          name: "Cheer10000",
          url: "https://d3aqoihi2n8ty8.cloudfront.net/actions/cheer/dark/animated/10000/1.gif",
        },
      ];

      fallbackEmotes.forEach((emote) => {
        this.emoteData.emotes[emote.name] = {
          id: `fallback_${emote.name}`,
          name: emote.name,
          url: emote.url,
          source: "cheer",
          zero_width: false,
          width: 28,
          height: 28,
        };
      });
    }
  }

  getEmote(name: string, channelId?: string): Emote | undefined {
    // Сначала ищем в канальных эмодзи
    if (channelId && this.emoteData.channelEmotes[channelId]) {
      const channelEmote = this.emoteData.channelEmotes[channelId][name];
      if (channelEmote) {
        return channelEmote;
      }
    }

    // Затем в глобальных
    const globalEmote = this.emoteData.emotes[name];
    if (globalEmote) {
      return globalEmote;
    }

    return undefined;
  }

  getAllEmotes(channelId?: string): Emote[] {
    const emotes: Emote[] = [];

    // Добавляем глобальные эмодзи
    Object.values(this.emoteData.emotes).forEach((emote) => {
      emotes.push(emote);
    });

    // Добавляем канальные эмодзи
    if (channelId && this.emoteData.channelEmotes[channelId]) {
      Object.values(this.emoteData.channelEmotes[channelId]).forEach(
        (emote) => {
          emotes.push(emote);
        },
      );
    }

    return emotes;
  }

  getAllEmoteNames(channelId?: string): string[] {
    const emoteNames: string[] = [];

    // Добавляем глобальные эмодзи
    Object.keys(this.emoteData.emotes).forEach((name) => {
      emoteNames.push(name);
    });

    // Добавляем канальные эмодзи
    if (channelId && this.emoteData.channelEmotes[channelId]) {
      Object.keys(this.emoteData.channelEmotes[channelId]).forEach((name) => {
        emoteNames.push(name);
      });
    }

    return emoteNames;
  }

  getEmoteData(): EmoteData {
    return this.emoteData;
  }

  // Add/remove individual emotes (for EventAPI incremental updates)
  addChannelEmote(channelId: string, name: string, emote: Emote) {
    if (!this.emoteData.channelEmotes[channelId]) {
      this.emoteData.channelEmotes[channelId] = {};
    }
    this.emoteData.channelEmotes[channelId][name] = emote;
  }

  removeChannelEmote(channelId: string, name: string) {
    if (this.emoteData.channelEmotes[channelId]) {
      delete this.emoteData.channelEmotes[channelId][name];
    }
  }

  // NEW: Personal emote management
  addPersonalEmote(username: string, name: string, emote: Emote) {
    username = username.toLowerCase();
    if (!this.emoteData.personalEmotes[username]) {
      this.emoteData.personalEmotes[username] = {};
    }
    this.emoteData.personalEmotes[username][name] = emote;
  }

  removePersonalEmote(username: string, name: string) {
    username = username.toLowerCase();
    if (this.emoteData.personalEmotes[username]) {
      delete this.emoteData.personalEmotes[username][name];
    }
  }

  removePersonalEmotes(username: string) {
    username = username.toLowerCase();
    delete this.emoteData.personalEmotes[username];
  }

  getPersonalEmotes(username: string): { [name: string]: Emote } {
    username = username.toLowerCase();
    return this.emoteData.personalEmotes[username] || {};
  }

  // NEW: Get emote with personal emote priority
  getEmoteForUser(
    emoteName: string,
    username: string,
    channelId?: string,
  ): Emote | null {
    username = username.toLowerCase();

    // Check personal emotes first
    const personalEmotes = this.getPersonalEmotes(username);
    if (personalEmotes[emoteName]) {
      return personalEmotes[emoteName];
    }

    // Check channel emotes
    if (channelId && this.emoteData.channelEmotes[channelId]?.[emoteName]) {
      return this.emoteData.channelEmotes[channelId][emoteName];
    }

    // Check global emotes
    if (this.emoteData.emotes[emoteName]) {
      return this.emoteData.emotes[emoteName];
    }

    return null;
  }

  private normalizeSevenTVEmote(seventvEmote: any): Emote {
    const webpFiles = seventvEmote.host.files.filter(
      (file: any) => file.format === "WEBP",
    );
    const maxSizeFile = webpFiles[webpFiles.length - 1];
    return {
      id: seventvEmote.id,
      name: seventvEmote.name,
      url: "https:" + seventvEmote.host.url + "/" + (maxSizeFile?.name || "4x.webp"),
      source: "7tv",
      zero_width: (seventvEmote.flags & 256) !== 0, // EmoteFlagsZeroWidth = 256
      width: maxSizeFile?.width,
      height: maxSizeFile?.height,
    };
  }
}

export const emoteService = new EmoteService();
