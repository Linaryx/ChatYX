/**
 * FFZ:AP (FrankerFaceZ Add-On Pack) Badge Service
 * Loads badges for supporters, donors, etc.
 */

import { log, LOG_CATEGORIES } from "../../utils/logger";

export interface FFZAPBadge {
    id: number;
    name: string;
    title: string;
    slot: number;
    replaces: string | null;
    color: string;
    image: string;
    urls: {
        '1': string;
        '2': string;
        '4': string;
    };
}

export interface FFZAPUserBadges {
    [userId: string]: FFZAPBadge[];
}

export class FFZAPBadgeService {
    private badges: Map<number, FFZAPBadge> = new Map();
    private userBadges: Map<string, FFZAPBadge[]> = new Map(); // userId -> badges
    private loaded: boolean = false;

    /**
     * Load FFZ:AP badges
     */
    async loadBadges(): Promise<void> {
        try {
            log.info(LOG_CATEGORIES.INTEGRATION, 'Loading FFZ:AP badges...');
            
            // Load global badge definitions
            const response = await fetch('https://api.frankerfacez.com/v1/badges');
            if (!response.ok) {
                throw new Error(`Failed to load FFZ:AP badges: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.badges && Array.isArray(data.badges)) {
                data.badges.forEach((badge: FFZAPBadge) => {
                    this.badges.set(badge.id, badge);
                });
            }

            // Load user badge assignments
            if (data.users) {
                Object.entries(data.users).forEach(([userId, badgeIds]) => {
                    const userBadgeList: FFZAPBadge[] = [];
                    
                    if (Array.isArray(badgeIds)) {
                        badgeIds.forEach((badgeId: number) => {
                            const badge = this.badges.get(badgeId);
                            if (badge) {
                                userBadgeList.push(badge);
                            }
                        });
                    }
                    
                    if (userBadgeList.length > 0) {
                        this.userBadges.set(userId, userBadgeList);
                    }
                });
            }

            this.loaded = true;
            log.info(LOG_CATEGORIES.INTEGRATION, `Loaded ${this.badges.size} FFZ:AP badges for ${this.userBadges.size} users`);
        } catch (error) {
            log.error(LOG_CATEGORIES.INTEGRATION, 'Failed to load FFZ:AP badges:', error);
        }
    }

    /**
     * Get badges for a user
     */
    getUserBadges(userId: string): FFZAPBadge[] {
        return this.userBadges.get(userId) || [];
    }

    /**
     * Get badge by ID
     */
    getBadge(badgeId: number): FFZAPBadge | null {
        return this.badges.get(badgeId) || null;
    }

    /**
     * Check if service is loaded
     */
    isLoaded(): boolean {
        return this.loaded;
    }
}

// Singleton instance
export const ffzapBadgeService = new FFZAPBadgeService();
