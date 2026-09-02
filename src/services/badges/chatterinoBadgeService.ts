/**
 * Chatterino Badge Service
 * Loads badges for Chatterino contributors and supporters
 */

import { log, LOG_CATEGORIES } from "../../utils/logger";
import { networkClient } from "../network/networkClient";

export interface ChatterinoBadge {
    tooltip: string;
    image1: string;
    image2: string;
    image3: string;
}

export class ChatterinoBadgeService {
    private userBadges: Map<string, ChatterinoBadge[]> = new Map(); // username (lowercase) -> badges
    private loaded: boolean = false;

    /**
     * Load Chatterino badges
     */
    async loadBadges(): Promise<void> {
        try {
            log.info(LOG_CATEGORIES.INTEGRATION, 'Loading Chatterino badges...');
            
            const response = await networkClient.request('https://api.chatterino.com/badges', { route: "rte" });
            if (!response.ok) {
                throw new Error(`Failed to load Chatterino badges: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.badges) {
                Object.entries(data.badges).forEach(([username, badges]) => {
                    if (Array.isArray(badges) && badges.length > 0) {
                this.userBadges.set(
                    username.toLowerCase(),
                    (badges as ChatterinoBadge[]).map((badge) => ({
                        ...badge,
                        image1: networkClient.resolveHttpUrl(badge.image1, "rte"),
                        image2: networkClient.resolveHttpUrl(badge.image2, "rte"),
                        image3: networkClient.resolveHttpUrl(badge.image3, "rte"),
                    })),
                );
                    }
                });
            }

            this.loaded = true;
            log.info(LOG_CATEGORIES.INTEGRATION, `Loaded Chatterino badges for ${this.userBadges.size} users`);
        } catch (error) {
            log.error(LOG_CATEGORIES.INTEGRATION, 'Failed to load Chatterino badges:', error);
        }
    }

    /**
     * Get badges for a user by username
     */
    getUserBadges(username: string): ChatterinoBadge[] {
        return this.userBadges.get(username.toLowerCase()) || [];
    }

    /**
     * Check if user has Chatterino badges
     */
    hasUserBadges(username: string): boolean {
        return this.userBadges.has(username.toLowerCase());
    }

    /**
     * Check if service is loaded
     */
    isLoaded(): boolean {
        return this.loaded;
    }
}

// Singleton instance
export const chatterinoBadgeService = new ChatterinoBadgeService();
