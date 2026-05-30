// ChatIS Integration Service - Combines all v2 features into v3

import { emoteService } from "./emoteService";
import type { Emote } from "./emoteService";
import { badgeService } from "../badges/badgeService";
import { PaintService } from "./paintService";
import { sevenTVEventApi } from "./sevenTVEventApi";
import type { SevenTVEventApiService } from "./sevenTVEventApi";
import { BotFilterService } from "../../utils/botFilter";
import {
  MessageFadeManager,
  DEFAULT_FADE_OPTIONS,
} from "../../utils/ui/fadeUtils";
import type { FadeOptions } from "../../utils/ui/fadeUtils";
import {
  LayoutManager,
  DEFAULT_LAYOUT_OPTIONS,
} from "../../utils/ui/layoutUtils";
import type { LayoutOptions } from "../../utils/ui/layoutUtils";
import {
  DEFAULT_ANIMATION_OPTIONS,
  injectAnimationStyles,
} from "../../utils/ui/animationUtils";
import type { AnimationOptions } from "../../utils/ui/animationUtils";
import { injectZeroWidthStyles } from "../../utils/chat/zeroWidthEmotes";
import { parseBotNames, type ChatConfig } from "../../config/chatUrlParams";
import { log, LOG_CATEGORIES } from "../../utils/logger";

export interface ChatISConfig {
  channel: string;
  userId: string;
  animation: AnimationOptions;
  fade: FadeOptions;
  layout: LayoutOptions;
  botFilter: {
    enabled: boolean;
    hideCommands: boolean;
    customBots: string[];
    singleChatter: string;
  };
  features: {
    sevenTVEventAPI: boolean;
    badges: boolean;
    paints: boolean;
    personalEmotes: boolean;
    zeroWidthEmotes: boolean;
  };
}

export const DEFAULT_ChatIS_CONFIG: ChatISConfig = {
  channel: "",
  userId: "",
  animation: DEFAULT_ANIMATION_OPTIONS,
  fade: DEFAULT_FADE_OPTIONS,
  layout: DEFAULT_LAYOUT_OPTIONS,
  botFilter: {
    enabled: true,
    hideCommands: true,
    customBots: [],
    singleChatter: "",
  },
  features: {
    sevenTVEventAPI: true,
    badges: true,
    paints: true,
    personalEmotes: true,
    zeroWidthEmotes: true,
  },
};

/**
 * Main integration service that manages all ChatIS features
 */
export class ChatISIntegrationService {
  private config: ChatISConfig;
  // Using legacy badgeService singleton
  private paintService: PaintService;
  private eventApiService?: SevenTVEventApiService;
  private botFilterService: BotFilterService;
  private fadeManager: MessageFadeManager;
  private layoutManager?: LayoutManager;
  private initialized: boolean = false;

  constructor(config: Partial<ChatISConfig> = {}) {
    this.config = { ...DEFAULT_ChatIS_CONFIG, ...config };

    // Initialize services (badgeService is global singleton)
    this.paintService = new PaintService();
    this.botFilterService = new BotFilterService(this.config.botFilter.customBots);
    this.fadeManager = new MessageFadeManager(this.config.fade);
  }

  /**
   * Initialize all services
   */
  async initialize(channelName: string, userId?: string): Promise<void> {
    if (this.initialized) {
      log.warn(LOG_CATEGORIES.INTEGRATION, "Already initialized");
      return;
    }

    log.service(
      LOG_CATEGORIES.INTEGRATION,
      "init",
      `Initializing for channel: ${channelName}`,
    );

    this.config.channel = channelName;
    if (userId) {
      this.config.userId = userId;
    }

    // Load emotes using singleton service (already has loadEmotes method)
    // This method loads both global and channel emotes
    // We rely on the existing emoteService that's already being used by the app

    // Badge loading already happens globally via badgeService.loadBadges() in channel.tsx
    // No need to load badges here again

    // Initialize 7TV EventAPI if enabled (disabled for now due to API issues)
    // if (this.config.features.sevenTVEventAPI) {
    //   await this.initializeEventAPI(channelName);
    // }

    // Inject styles
    injectAnimationStyles(this.config.animation);

    if (this.config.features.zeroWidthEmotes) {
      injectZeroWidthStyles();
    }

    this.initialized = true;
    log.service(
      LOG_CATEGORIES.INTEGRATION,
      "start",
      "Initialized successfully",
      {
        channel: channelName,
        features: this.config.features,
      },
    );
  }

  /**
   * Initialize 7TV EventAPI
   */
  private async initializeEventAPI(): Promise<void> {
    // Disabled for now - needs proper implementation
    return;

    /*
    try {
      // Get 7TV user ID for channel
      const userId = await this.get7TVUserId(channelName);

      if (!userId) {
        return;
      }

      this.eventApiService = new SevenTVEventApiService();

      // Setup event handlers
      this.setupEventHandlers();

      // Connect and subscribe
      await this.eventApiService.connect();
      await this.eventApiService.subscribe(`user.${userId}`);
    } catch (error) {
      log.error(LOG_CATEGORIES.SEVENTV_API, "Failed to initialize 7TV EventAPI", error);
    }
    */
  }

  /**
   * Get 7TV user ID from Twitch username
   */
  private async get7TVUserId(channelName: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://7tv.io/v3/users/twitch/${channelName}`,
      );
      if (!response.ok) return null;

      const data = await response.json();
      return data.user?.id || null;
    } catch (error) {
      log.error(LOG_CATEGORIES.SEVENTV_API, "Error fetching 7TV user ID", error);
      return null;
    }
  }

  /**
   * Setup 7TV EventAPI event handlers
   */
  private setupEventHandlers(): void {
    // Disabled for now
    return;

    /*
    if (!this.eventApiService) return;

    this.eventApiService.on('emote_set.update', (data: any) => {
      // Reload channel emotes
      if (this.config.channel) {
        emoteService.loadChannelEmotes(this.config.channel);
      }
    });

    this.eventApiService.on('cosmetic.create', (data: any) => {
      // Reload paints/badges if needed
    });

    this.eventApiService.on('cosmetic.update', (data: any) => {
    });

    this.eventApiService.on('cosmetic.delete', (data: any) => {
    });

    this.eventApiService.on('entitlement.create', (data: any) => {
    });

    this.eventApiService.on('entitlement.update', (data: any) => {
    });

    this.eventApiService.on('entitlement.delete', (data: any) => {
    });
    */
  }

  /**
   * Initialize layout manager with container
   */
  initializeLayout(container: HTMLElement): void {
    this.layoutManager = new LayoutManager(container, this.config.layout);
  }

  /**
   * Check if message should be displayed
   */
  shouldDisplayMessage(username: string, message: string): boolean {
    const allowedChatters = parseBotNames(this.config.botFilter.singleChatter);
    if (
      allowedChatters.length > 0 &&
      !allowedChatters.includes(username.toLowerCase())
    ) {
      return false;
    }

    if (!this.config.botFilter.enabled) {
      return (
        !this.config.botFilter.hideCommands ||
        !this.botFilterService.isCommand(message)
      );
    }

    const shouldHide = this.botFilterService.shouldHideMessage(
      username,
      message,
      {
        hideBots: this.config.botFilter.enabled,
        hideCommands: this.config.botFilter.hideCommands,
      },
    );

    if (shouldHide) {
      log.debug(
        LOG_CATEGORIES.BOT_FILTER,
        `Filtered message from ${username}`,
        { message },
      );
    }

    return !shouldHide;
  }

  /**
   * Get badges for user
   */
  getBadges(username: string): any[] {
    if (!this.config.features.badges) {
      return [];
    }

    const thirdPartyBadges = [...badgeService.getUserBadges(username)];
    const sevenTVBadges = sevenTVEventApi.getUserBadges(username);

    if (sevenTVBadges && sevenTVBadges.length > 0) {
      const chatisIndex = thirdPartyBadges.findIndex(
        (b) => b.source === "chatis",
      );

      if (chatisIndex >= 0) {
        thirdPartyBadges.splice(chatisIndex, 0, ...sevenTVBadges);
      } else {
        thirdPartyBadges.push(...sevenTVBadges);
      }
    }

    return thirdPartyBadges;
  }

  /**
   * Get paint/cosmetic for username
   */
  getUserPaint(userId: string, username: string): string | null {
    if (!this.config.features.paints) {
      return null;
    }

    if (username) {
      const paint = sevenTVEventApi.getUserPaint(username);
      if (paint) {
        return this.generate7TVPaintCSS(paint);
      }
    }

    const paint = this.paintService.getPaint(userId);
    if (!paint) return null;

    return this.paintService.generatePaintCSS(paint);
  }

  /**
   * Generate CSS for 7TV paint
   */
  private generate7TVPaintCSS(paint: any): string {
    if (!paint.function) {
      return "";
    }

    const getCSSColorFromInt = (num: number): string => {
      const red = (num >>> 24) & 255;
      const green = (num >>> 16) & 255;
      const blue = (num >>> 8) & 255;
      const alpha = num & 255;
      return `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
    };

    let bgFunc = "";
    let bgFuncArgs: string[] = [];
    let isGradient = true;

    switch (paint.function) {
      case "LINEAR_GRADIENT":
      case "linear-gradient":
        bgFunc = `${paint.repeat ? "repeating-" : ""}linear-gradient`;
        bgFuncArgs.push(`${paint.angle || 90}deg`);
        break;
      case "RADIAL_GRADIENT":
      case "radial-gradient":
        bgFunc = `${paint.repeat ? "repeating-" : ""}radial-gradient`;
        bgFuncArgs.push(paint.shape || "circle");
        break;
      case "URL":
      case "url":
        bgFunc = "url";
        {
          const safeImageUrl = this.sanitizeCssImageUrl(paint.image_url || "");
          if (!safeImageUrl) return "";
          bgFuncArgs.push(`"${safeImageUrl}"`);
        }
        isGradient = false;
        break;
      default:
        return "";
    }

    if (isGradient && paint.stops && paint.stops.length > 0) {
      for (const stop of paint.stops) {
        const color = getCSSColorFromInt(stop.color);
        const position = (stop.at * 100).toFixed(1);
        bgFuncArgs.push(`${color} ${position}%`);
      }
    }

    const background = `${bgFunc}(${bgFuncArgs.join(", ")})`;
    let css = `background-image: ${background}; background-size: cover; background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-color: currentColor;`;

    if (paint.color !== null && paint.color !== undefined) {
      const defaultColor = getCSSColorFromInt(paint.color);
      css += ` color: ${defaultColor} !important;`;
    }

    if (paint.shadows && paint.shadows.length > 0) {
      const shadows = paint.shadows
        .map(
          (shadow: any) =>
            `drop-shadow(${shadow.x_offset}px ${shadow.y_offset}px ${shadow.radius}px ${getCSSColorFromInt(shadow.color)})`,
        )
        .join(" ");
      css += ` filter: ${shadows};`;
    }

    return css;
  }

  private sanitizeCssImageUrl(value: string): string {
    try {
      const url = new URL(value, window.location.origin);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "";
      return url.href.replace(/"/g, "%22");
    } catch {
      return "";
    }
  }

  /**
   * Get emote for message rendering
   */
  getEmote(code: string, username?: string): any {
    // Check personal emotes first if enabled
    if (this.config.features.personalEmotes && username) {
      const emote = emoteService.getEmoteForUser(
        code,
        username,
        this.config.userId,
      );
      if (emote) return emote;
    }

    return emoteService.getEmote(code, this.config.userId);
  }

  /**
   * Get all emotes as Map for message parsing
   */
  getEmoteMap(username?: string): Map<string, any> {
    const emotes = new Map<string, any>();

    // Add personal emotes first (highest priority)
    if (this.config.features.personalEmotes && username) {
      const personalEmotes = emoteService.getPersonalEmotes(username);
      Object.entries(personalEmotes).forEach(([code, emote]) => {
        emotes.set(code, emote);
      });
    }

    // Add all emotes (both global and channel)
    const allEmotes = emoteService.getAllEmotes(this.config.userId);
    allEmotes.forEach((emote: Emote) => {
      if (!emotes.has(emote.name)) {
        emotes.set(emote.name, emote);
      }
    });

    return emotes;
  }

  /**
   * Schedule message to fade out
   */
  scheduleMessageFade(element: HTMLElement, onRemove?: () => void): void {
    if (this.config.fade.enabled) {
      this.fadeManager.scheduleMessage(element, onRemove);
    }
  }

  /**
   * Scroll to latest message
   */
  scrollToLatest(smooth: boolean = true): void {
    if (this.layoutManager) {
      this.layoutManager.scrollIfNeeded(smooth);
    }
  }

  /**
   * Handle user scroll to toggle auto-scroll state
   */
  handleUserScroll(): void {
    if (this.layoutManager) {
      this.layoutManager.checkUserScroll();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ChatISConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      animation: config.animation
        ? { ...this.config.animation, ...config.animation }
        : this.config.animation,
      fade: config.fade
        ? { ...this.config.fade, ...config.fade }
        : this.config.fade,
      layout: config.layout
        ? { ...this.config.layout, ...config.layout }
        : this.config.layout,
      botFilter: config.botFilter
        ? { ...this.config.botFilter, ...config.botFilter }
        : this.config.botFilter,
      features: config.features
        ? { ...this.config.features, ...config.features }
        : this.config.features,
    };

    // Update sub-services
    if (config.fade) {
      this.fadeManager.updateOptions(config.fade);
    }

    if (config.layout && this.layoutManager) {
      this.layoutManager.updateOptions(config.layout);
    }

    if (config.botFilter?.customBots) {
      this.botFilterService.setBotNames(this.config.botFilter.customBots);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ChatISConfig {
    return { ...this.config };
  }

  /**
   * Check if zero-width emotes are enabled
   */
  isZeroWidthEnabled(): boolean {
    return this.config.features.zeroWidthEmotes;
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    log.service(LOG_CATEGORIES.INTEGRATION, "stop", "Cleaning up");

    // Disconnect EventAPI
    if (this.eventApiService) {
      await this.eventApiService.disconnect();
    }

    // Clear fade timers
    this.fadeManager.clear();

    this.initialized = false;
    log.info(LOG_CATEGORIES.INTEGRATION, "Cleanup complete");
  }
}

/**
 * Create integration service from query parameters
 */
export function createFromQueryParams(params: ChatConfig): ChatISConfig {
  return {
    channel: params.channel,
    userId: "",
    animation: {
      enabled: params.animate,
      duration: DEFAULT_ANIMATION_OPTIONS.duration,
      easing: "ease-in-out",
      type: "fade",
    },
    fade: {
      enabled: params.fade !== false,
      timeout: typeof params.fade === "number" ? params.fade * 1000 : 30000,
      fadeOutDuration: 1000,
    },
    layout: {
      horizontal: params.horizontal,
      reverse: params.reverseLineOrder,
    },
    botFilter: {
      // In v2: bots=true means SHOW bots (disable filter)
      // So enabled should be !params.bots
      enabled: !params.bots,
      hideCommands: !params.commands,
      customBots: parseBotNames(params.botNames),
      singleChatter: params.singleChatter,
    },
    features: {
      sevenTVEventAPI: true,
      badges: !params.hideSpecialBadges,
      paints: true,
      personalEmotes: true,
      zeroWidthEmotes: true,
    },
  };
}
