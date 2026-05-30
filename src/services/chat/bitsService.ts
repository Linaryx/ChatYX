/**
 * Twitch Bits/Cheers Service
 * Handles loading, detecting, and rendering cheer emotes
 */

import type {
  CheerEmote,
  BitsTier,
  ParsedCheer,
  CheerMatch,
} from "../../types/bits";
import { log, LOG_CATEGORIES } from "../../utils/logger";
import { fetchWithFallback, FALLBACK_APIS, TWITCH_CONFIG } from "~/config/twitch";
export class BitsService {
  private cheerEmotes: Map<string, CheerEmote> = new Map();
  private loaded: boolean = false;

  /**
   * Load cheer emotes for a channel
   */
  async loadCheers(channelId: string): Promise<void> {
    try {
      log.info(
        LOG_CATEGORIES.TWITCH_IRC,
        `Loading cheers for channel: ${channelId}`,
      );

      // Cheermotes доступны только через локальный API (требуется OAuth)
      const response = await fetchWithFallback(
        `${TWITCH_CONFIG.API_BASE_URL}/bits/cheermotes?broadcaster_id=${encodeURIComponent(channelId)}`,
        FALLBACK_APIS.cheermotes, // null - нет публичного API
      );

      if (!response.ok) {
        log.warn(
          LOG_CATEGORIES.TWITCH_IRC,
          "Cheermotes unavailable (requires local API with OAuth)",
        );
        return; // Тихо выходим
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((emote: CheerEmote) => {
          this.cheerEmotes.set(emote.prefix.toLowerCase(), emote);
        });

        this.loaded = true;
        log.info(
          LOG_CATEGORIES.TWITCH_IRC,
          `Loaded ${this.cheerEmotes.size} cheer emotes`,
        );
      }
    } catch (error) {
      log.error(LOG_CATEGORIES.TWITCH_IRC, "Failed to load cheers:", error);
    }
  }

  /**
   * Find the appropriate tier for a given bit amount
   */
  private findTier(tiers: BitsTier[], amount: number): BitsTier {
    // Sort tiers by min_bits descending
    const sortedTiers = [...tiers].sort((a, b) => b.min_bits - a.min_bits);

    // Find the first tier where amount >= min_bits
    for (const tier of sortedTiers) {
      if (amount >= tier.min_bits) {
        return tier;
      }
    }

    // Fallback to lowest tier
    return sortedTiers[sortedTiers.length - 1];
  }

  /**
   * Parse a cheer string (e.g., "Cheer100")
   */
  parseCheer(text: string): ParsedCheer | null {
    if (!this.loaded) {
      return null;
    }

    // Match pattern: Prefix + Number (e.g., Cheer100, cheer1, CHEER50)
    const match = text.match(/^([a-zA-Z]+)(\d+)$/);
    if (!match) {
      return null;
    }

    const [, prefix, amountStr] = match;
    const amount = parseInt(amountStr, 10);

    if (isNaN(amount) || amount <= 0) {
      return null;
    }

    const emote = this.cheerEmotes.get(prefix.toLowerCase());
    if (!emote) {
      return null;
    }

    const tier = this.findTier(emote.tiers, amount);

    // Get emote URL (using dark theme, animated, size 4 for best quality)
    const emoteUrl =
      tier.images.dark.animated["4"] || tier.images.dark.static["4"];

    return {
      prefix,
      amount,
      color: tier.color,
      emoteUrl,
      tier,
    };
  }

  /**
   * Detect all cheers in a message
   */
  detectCheers(message: string): CheerMatch[] {
    if (!this.loaded) {
      return [];
    }

    const matches: CheerMatch[] = [];
    const words = message.split(/\s+/);
    let currentIndex = 0;

    for (const word of words) {
      const parsed = this.parseCheer(word);
      if (parsed) {
        matches.push({
          text: word,
          index: currentIndex,
          parsed,
        });
      }
      currentIndex += word.length + 1; // +1 for space
    }

    return matches;
  }

  /**
   * Calculate total bits in a message
   */
  calculateTotalBits(messageOrCheers: string | CheerMatch[]): number {
    if (typeof messageOrCheers === "string") {
      const cheers = this.detectCheers(messageOrCheers);
      return cheers.reduce((total, cheer) => total + cheer.parsed.amount, 0);
    } else {
      return messageOrCheers.reduce(
        (total, cheer) => total + cheer.parsed.amount,
        0,
      );
    }
  }

  /**
   * Check if service is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get all loaded cheer prefixes
   */
  getPrefixes(): string[] {
    return Array.from(this.cheerEmotes.keys());
  }
}

// Singleton instance
export const bitsService = new BitsService();
