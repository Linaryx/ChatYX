/**
 * Chat Feature Integration Service
 * Loads optional chat assets and owns the 7TV EventAPI lifecycle.
 */

import { log, LOG_CATEGORIES } from "../../utils/logger";

// Services
import { bitsService } from "./assets/bitsService";
import { ffzapBadgeService } from "../badges/ffzapBadgeService";
import { bttvBadgeService } from "../badges/bttvBadgeService";
import { chatterinoBadgeService } from "../badges/chatterinoBadgeService";
import { chatisBadgeService } from "../badges/chatisBadgeService";
import { sevenTVEventApi } from "./seven-tv/eventApi";

import { layoutManager } from "../../utils/ui/layoutManager";
import type { SevenTVEventDispatch } from "./seven-tv/eventApi";

const SEVENTV_RETRY_DELAY_MS = 5 * 60 * 1000;

function shouldRetrySevenTvError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (!(error instanceof Error)) {
    return true;
  }

  const status = error.message.match(/HTTP (\d{3})/)?.[1];
  if (!status) return true;

  const code = Number(status);
  return code === 408 || code === 429 || code >= 500;
}

export interface ChatFeatureIntegrationOptions {
  // Badge options
  showFFZAPBadges: boolean;
  showBTTVBadges: boolean;
  showChatterinoBadges: boolean;
  showChatisBadges: boolean;

  enableBits: boolean;

  // Layout options
  reverseLineOrder: boolean;
  singleChatter?: string;

  // 7TV EventAPI
  enable7TVEventAPI: boolean;
}

export class ChatFeatureIntegrationService {
  private options: ChatFeatureIntegrationOptions;
  private initialized: boolean = false;
  private sevenTvRetryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: Partial<ChatFeatureIntegrationOptions> = {}) {
    this.options = {
      showFFZAPBadges: true,
      showBTTVBadges: true,
      showChatterinoBadges: true,
      showChatisBadges: true,
      enableBits: true,
      reverseLineOrder: false,
      enable7TVEventAPI: true,
      ...options,
    };
  }

  async initialize(
    channelId: string,
    onSevenTvEvent?: (event: SevenTVEventDispatch) => void,
  ): Promise<void> {
    if (this.initialized) {
      log.warn(
        LOG_CATEGORIES.INTEGRATION,
        "Chat feature integration already initialized",
      );
      return;
    }

    log.info(LOG_CATEGORIES.INTEGRATION, "Initializing Chat feature integration...");

    try {
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

      if (this.options.enableBits) {
        await bitsService
          .loadCheers(channelId)
          .catch((err) =>
            log.error(LOG_CATEGORIES.INTEGRATION, "Failed to load bits service", err),
          );
      }

      if (this.options.enable7TVEventAPI) {
        await this.connect7TVEventAPI(channelId, onSevenTvEvent, {
          scheduleRetry: true,
        });
      }

      layoutManager.setOptions({
        reverseLineOrder: this.options.reverseLineOrder,
        singleChatter: this.options.singleChatter,
      });

      this.initialized = true;
      log.info(
        LOG_CATEGORIES.INTEGRATION,
        "Chat feature integration initialized successfully",
      );
    } catch (error) {
      log.error(
        LOG_CATEGORIES.INTEGRATION,
        "Failed to initialize Chat feature integration:",
        error,
      );
      throw error;
    }
  }

  private async connect7TVEventAPI(
    channelId: string,
    onEvent: ((event: SevenTVEventDispatch) => void) | undefined,
    options: { scheduleRetry: boolean },
  ): Promise<void> {
    if (!/^\d+$/.test(channelId)) {
      log.warn(
        LOG_CATEGORIES.INTEGRATION,
        "7TV EventAPI requires numeric channel ID, skipping (got username instead)",
      );
      log.warn(LOG_CATEGORIES.INTEGRATION, `7TV EventAPI requires numeric channel ID, got: ${channelId}`);
      return;
    }

    try {
      this.clearSevenTvRetryTimer();
      await sevenTVEventApi.connect(channelId, (event) => {
        log.debug(LOG_CATEGORIES.SEVENTV_API, `EventAPI event: ${event.type}`);
        onEvent?.(event);
      });

      log.info(LOG_CATEGORIES.INTEGRATION, "7TV EventAPI connected");
    } catch (error) {
      log.error(LOG_CATEGORIES.INTEGRATION, "Failed to connect 7TV EventAPI", error);
      log.error(
        LOG_CATEGORIES.INTEGRATION,
        "Failed to connect 7TV EventAPI:",
        error,
      );

      if (options.scheduleRetry && shouldRetrySevenTvError(error)) {
        this.scheduleSevenTvRetry(channelId, onEvent);
      }
    }
  }

  private scheduleSevenTvRetry(
    channelId: string,
    onEvent: ((event: SevenTVEventDispatch) => void) | undefined,
  ): void {
    if (this.sevenTvRetryTimer || !this.options.enable7TVEventAPI) return;

    log.warn(
      LOG_CATEGORIES.INTEGRATION,
      "7TV EventAPI unavailable, retrying in 5 minutes",
    );

    this.sevenTvRetryTimer = setTimeout(() => {
      this.sevenTvRetryTimer = null;
      void this.connect7TVEventAPI(channelId, onEvent, { scheduleRetry: true });
    }, SEVENTV_RETRY_DELAY_MS);
  }

  private clearSevenTvRetryTimer(): void {
    if (!this.sevenTvRetryTimer) return;

    clearTimeout(this.sevenTvRetryTimer);
    this.sevenTvRetryTimer = null;
  }

  setOptions(options: Partial<ChatFeatureIntegrationOptions>): void {
    this.options = { ...this.options, ...options };

    layoutManager.setOptions({
      reverseLineOrder: this.options.reverseLineOrder,
      singleChatter: this.options.singleChatter,
    });
  }

  destroy(): void {
    this.clearSevenTvRetryTimer();
    sevenTVEventApi.disconnect();
    this.initialized = false;

    log.info(LOG_CATEGORIES.INTEGRATION, "Chat feature integration destroyed");
  }
}

export const chatFeatureIntegration = new ChatFeatureIntegrationService();
