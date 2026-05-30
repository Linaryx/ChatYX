/**
 * USERNOTICE Types
 * TypeScript interfaces for Twitch USERNOTICE IRC messages
 */

/**
 * USERNOTICE message types
 */
export type UserNoticeType =
    | 'sub'                    // New subscription
    | 'resub'                  // Re-subscription
    | 'subgift'                // Gifted subscription
    | 'submysterygift'         // Mystery gift subs
    | 'giftpaidupgrade'        // Gifted sub converted to paid
    | 'rewardgift'             // Reward gift
    | 'anongiftpaidupgrade'    // Anonymous gift upgrade
    | 'raid'                   // Incoming raid
    | 'unraid'                 // Cancelled raid
    | 'ritual'                 // New chatter ritual
    | 'bitsbadgetier'          // Bits badge tier achieved
    | 'announcement'           // Announcement
    | 'charity';               // Charity donation

/**
 * Base USERNOTICE event interface
 */
export interface UserNoticeEvent {
    /** Type of notice */
    type: UserNoticeType;
    
    /** User who triggered the notice */
    username: string;
    
    /** Display name */
    displayName: string;
    
    /** User ID */
    userId: string;
    
    /** System message text */
    systemMsg: string;
    
    /** Optional user message */
    message?: string;
    
    /** IRC tags */
    tags: Map<string, string>;
}

/**
 * Subscription notice
 */
export interface SubNotice extends UserNoticeEvent {
    type: 'sub' | 'resub';
    plan: string;              // 1000, 2000, 3000, Prime
    planName: string;
    months?: number;
    cumulativeMonths?: number;
    streak?: number;
    shouldShareStreak?: boolean;
}

/**
 * Gifted subscription notice
 */
export interface SubGiftNotice extends UserNoticeEvent {
    type: 'subgift';
    plan: string;
    planName: string;
    months: number;
    recipientUsername: string;
    recipientDisplayName: string;
    recipientId: string;
    giftMonths: number;
    senderCount?: number;
}

/**
 * Mystery gift subs notice
 */
export interface MysteryGiftNotice extends UserNoticeEvent {
    type: 'submysterygift';
    plan: string;
    giftCount: number;
    senderCount?: number;
}

/**
 * Raid notice
 */
export interface RaidNotice extends UserNoticeEvent {
    type: 'raid';
    viewerCount: number;
    displayName: string;
}

/**
 * Ritual notice (new chatter)
 */
export interface RitualNotice extends UserNoticeEvent {
    type: 'ritual';
    ritualName: string;      // 'new_chatter'
}

/**
 * Bits badge tier notice
 */
export interface BitsBadgeTierNotice extends UserNoticeEvent {
    type: 'bitsbadgetier';
    threshold: number;
}

/**
 * Announcement notice
 */
export interface AnnouncementNotice extends UserNoticeEvent {
    type: 'announcement';
    color: string;           // blue, green, orange, purple, primary
}

/**
 * Union type for all USERNOTICE events
 */
export type UserNotice =
    | SubNotice
    | SubGiftNotice
    | MysteryGiftNotice
    | RaidNotice
    | RitualNotice
    | BitsBadgeTierNotice
    | AnnouncementNotice
    | UserNoticeEvent;

/**
 * USERNOTICE display options
 */
export interface UserNoticeOptions {
    /** Show subscription notices */
    showSubs: boolean;
    
    /** Show gifted subs */
    showGiftSubs: boolean;
    
    /** Show raids */
    showRaids: boolean;
    
    /** Show rituals */
    showRituals: boolean;
    
    /** Show bits badge tiers */
    showBitsBadges: boolean;
    
    /** Show announcements */
    showAnnouncements: boolean;
    
    /** Custom styling */
    customStyle?: string;
}
