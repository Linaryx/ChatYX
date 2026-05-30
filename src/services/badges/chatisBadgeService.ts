/**
 * ChatIS Custom Badges Service
 * Handles custom badges for moderators and users
 */

import { log, LOG_CATEGORIES } from "../../utils/logger";

export interface ChatisBadge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  image1x?: string;
  image2x?: string;
  image4x?: string;
}

export interface ChatisBadgeUser {
  username: string;
  userId: string;
  badges: string[]; // Array of badge IDs
}

/**
 * ChatIS Custom Badges Service
 * Manages custom badges for moderators and special users
 */
export class ChatisBadgeService {
  private badges: Map<string, ChatisBadge> = new Map();
  private userBadges: Map<string, string[]> = new Map();
  private loaded: boolean = false;

  private static readonly BADGE_BASE_URL = "/v2/badges";

  // Default badges
  private static readonly DEFAULT_BADGES: ChatisBadge[] = [
    {
      id: "chatis-mod",
      name: "ChatIS Moderator",
      description: "ChatIS Moderator",
      imageUrl: "/v2/badges/chatis-mod/1.png",
      image1x: "/v2/badges/chatis-mod/1.png",
      image2x: "/v2/badges/chatis-mod/2.png",
      image4x: "/v2/badges/chatis-mod/4.png",
    },
    {
      id: "chatis-dev",
      name: "ChatIS Developer",
      description: "ChatIS Developer",
      imageUrl: "/v2/badges/chatis-dev/1.png",
      image1x: "/v2/badges/chatis-dev/1.png",
      image2x: "/v2/badges/chatis-dev/2.png",
      image4x: "/v2/badges/chatis-dev/4.png",
    },
    {
      id: "chatis-supporter",
      name: "ChatIS Supporter",
      description: "ChatIS Supporter",
      imageUrl: "/v2/badges/chatis-supporter/1.png",
      image1x: "/v2/badges/chatis-supporter/1.png",
      image2x: "/v2/badges/chatis-supporter/2.png",
      image4x: "/v2/badges/chatis-supporter/4.png",
    },
    {
      id: "chatis-homie",
      name: "ChatIS Homie",
      description: "ChatIS Homie",
      imageUrl: "/v2/badges/homies/1.png",
      image1x: "/v2/badges/homies/1.png",
      image2x: "/v2/badges/homies/2.png",
      image4x: "/v2/badges/homies/4.png",
    },
  ];

  constructor() {
    this.initializeDefaultBadges();
  }

  /**
   * Initialize default badges
   */
  private initializeDefaultBadges(): void {
    ChatisBadgeService.DEFAULT_BADGES.forEach((badge) => {
      this.badges.set(badge.id, badge);
    });

    log.info(
      LOG_CATEGORIES.BADGE,
      `Initialized ${this.badges.size} default ChatIS badges`,
    );
  }

  /**
   * Load custom badges from server
   */
  async loadBadges(): Promise<void> {
    if (this.loaded) {
      log.debug(LOG_CATEGORIES.BADGE, "ChatIS badges already loaded");
      return;
    }

    try {
      log.info(LOG_CATEGORIES.BADGE, "Loading ChatIS badges...");

      // ChatIS badges работают по URL-паттерну (как в v2)
      // https://chatis.is2511.com/v2/badges/users/{username}/{size}x.{ext}
      // Дополнительная загрузка через API не требуется

      log.info(
        LOG_CATEGORIES.BADGE,
        `Using ${this.badges.size} default ChatIS badges (URL-based)`,
      );
      this.loaded = true;
    } catch (error) {
      log.error(LOG_CATEGORIES.BADGE, "Failed to load ChatIS badges:", error);
      // Continue with default badges
      this.loaded = true;
    }
  }

  /**
   * Get badge by ID
   */
  getBadge(badgeId: string): ChatisBadge | undefined {
    return this.badges.get(badgeId);
  }

  /**
   * Get all badges for a user
   */
  getUserBadges(username: string): ChatisBadge[] {
    const badgeIds = this.userBadges.get(username.toLowerCase()) || [];

    return badgeIds
      .map((id) => this.getBadge(id))
      .filter((badge): badge is ChatisBadge => badge !== undefined);
  }

  /**
   * Check if user has specific badge
   */
  hasUserBadge(username: string, badgeId: string): boolean {
    const badges = this.userBadges.get(username.toLowerCase()) || [];
    return badges.includes(badgeId);
  }

  /**
   * Add user badge assignment
   */
  addUserBadge(username: string, badgeId: string): void {
    const normalizedUsername = username.toLowerCase();

    if (!this.userBadges.has(normalizedUsername)) {
      this.userBadges.set(normalizedUsername, []);
    }

    const badges = this.userBadges.get(normalizedUsername)!;
    if (!badges.includes(badgeId)) {
      badges.push(badgeId);
      log.info(
        LOG_CATEGORIES.BADGE,
        `Added badge "${badgeId}" to user ${username}`,
      );
    }
  }

  /**
   * Remove user badge assignment
   */
  removeUserBadge(username: string, badgeId: string): void {
    const normalizedUsername = username.toLowerCase();
    const badges = this.userBadges.get(normalizedUsername);

    if (badges) {
      const index = badges.indexOf(badgeId);
      if (index !== -1) {
        badges.splice(index, 1);
        log.info(
          LOG_CATEGORIES.BADGE,
          `Removed badge "${badgeId}" from user ${username}`,
        );
      }
    }
  }

  /**
   * Get badge image URL for size
   */
  getBadgeImageUrl(
    badge: ChatisBadge,
    size: "1x" | "2x" | "4x" = "1x",
  ): string {
    switch (size) {
      case "2x":
        return badge.image2x || badge.imageUrl;
      case "4x":
        return badge.image4x || badge.imageUrl;
      default:
        return badge.image1x || badge.imageUrl;
    }
  }

  /**
   * Get all available badges
   */
  getAllBadges(): ChatisBadge[] {
    return Array.from(this.badges.values());
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.userBadges.clear();
    this.badges.clear();
    this.initializeDefaultBadges();
    this.loaded = false;
    log.info(LOG_CATEGORIES.BADGE, "Cleared ChatIS badge data");
  }
}

// Singleton instance
export const chatisBadgeService = new ChatisBadgeService();
