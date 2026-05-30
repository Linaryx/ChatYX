/**
 * BTTV Badge Service
 * Loads badges for BTTV Pro users
 */

import { log, LOG_CATEGORIES } from "../../utils/logger";

export interface BTTVBadge {
  id: string;
  name: string;
  displayName: string;
  providerId: string;
  badge: {
    type: number;
    description: string;
    svg: string;
  };
}

export class BTTVBadgeService {
  private badges: Map<string, BTTVBadge> = new Map();
  private userBadges: Map<string, string[]> = new Map(); // userId -> badge IDs
  private loaded: boolean = false;

  /**
   * Load BTTV badges
   */
  async loadBadges(): Promise<void> {
    try {
      log.info(LOG_CATEGORIES.INTEGRATION, "Loading BTTV badges...");

      // BTTV doesn't have a public API for badges, but we can hardcode known badges
      // The main one is the BTTV Pro badge
      const proBadge: BTTVBadge = {
        id: "bttv-pro",
        name: "pro",
        displayName: "BTTV Pro",
        providerId: "bttv",
        badge: {
          type: 1,
          description: "BTTV Pro",
          svg: "https://cdn.betterttv.net/tags/developer.png",
        },
      };

      this.badges.set(proBadge.id, proBadge);

      this.loaded = true;
      log.info(
        LOG_CATEGORIES.INTEGRATION,
        `Loaded ${this.badges.size} BTTV badges`,
      );
    } catch (error) {
      log.error(
        LOG_CATEGORIES.INTEGRATION,
        "Failed to load BTTV badges:",
        error,
      );
    }
  }

  /**
   * Check if user has BTTV Pro
   * This would need to be checked via BTTV API per-user
   */
  async checkUserBadges(userId: string): Promise<void> {
    try {
      // BTTV API endpoint (unofficial)
      const response = await fetch(
        `https://api.betterttv.net/3/cached/users/twitch/${userId}`,
      );
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const badges: string[] = [];

      // Check for BTTV Pro
      if (data.badge) {
        badges.push("bttv-pro");
      }

      if (badges.length > 0) {
        this.userBadges.set(userId, badges);
      }
    } catch (error) {
      log.debug(
        LOG_CATEGORIES.INTEGRATION,
        `Could not load BTTV badges for user ${userId}`,
        error,
      );
    }
  }

  /**
   * Get badges for a user
   */
  getUserBadges(userId: string): BTTVBadge[] {
    const badgeIds = this.userBadges.get(userId) || [];
    return badgeIds
      .map((id) => this.badges.get(id))
      .filter(Boolean) as BTTVBadge[];
  }

  /**
   * Check if service is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

// Singleton instance
export const bttvBadgeService = new BTTVBadgeService();
