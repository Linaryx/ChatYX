/**
 * USERNOTICE Parser
 * Handles Twitch USERNOTICE IRC messages (subs, raids, gifts, etc.)
 */

import { log, LOG_CATEGORIES } from "../logger";
import type {
  UserNoticeEvent,
  UserNotice,
  UserNoticeType,
} from "../../types/userNotice";

/**
 * Parse USERNOTICE IRC message
 * Format: @tags :tmi.twitch.tv USERNOTICE #channel :optional message
 */
export function parseUserNotice(ircMessage: string): UserNotice | null {
    // Extract tags
    const tagsMatch = /^@([^ ]+)/.exec(ircMessage);
    if (!tagsMatch) return null;

    const tagsString = tagsMatch[1];
    const tags = new Map<string, string>();

    // Parse tags
    tagsString.split(';').forEach(tag => {
        const [key, value] = tag.split('=');
        if (key && value) {
            tags.set(key, decodeIRCTag(value));
        }
    });

    // Extract message if present
    const messageMatch = /:([^:\s]+)$/.exec(ircMessage);
    const message = messageMatch ? messageMatch[1].trim() : undefined;

    // Get notice type
    const msgId = tags.get('msg-id') as UserNoticeType;
    if (!msgId) {
        log.warn(LOG_CATEGORIES.IRC, 'USERNOTICE missing msg-id tag');
        return null;
    }

    // Base notice data
    const base: UserNoticeEvent = {
        type: msgId,
        username: tags.get('login') || '',
        displayName: tags.get('display-name') || '',
        userId: tags.get('user-id') || '',
        systemMsg: tags.get('system-msg') || '',
        message,
        tags
    };

    // Parse specific notice types
    return parseSpecificNotice(base, tags);
}

/**
 * Parse specific USERNOTICE type with additional data
 */
function parseSpecificNotice(base: UserNoticeEvent, tags: Map<string, string>): UserNotice {
    switch (base.type) {
        case 'sub':
        case 'resub':
            return {
                ...base,
                plan: tags.get('msg-param-sub-plan') || '1000',
                planName: tags.get('msg-param-sub-plan-name') || 'Tier 1',
                months: parseInt(tags.get('msg-param-months') || '0'),
                cumulativeMonths: parseInt(tags.get('msg-param-cumulative-months') || '0'),
                streak: parseInt(tags.get('msg-param-streak-months') || '0'),
                shouldShareStreak: tags.get('msg-param-should-share-streak') === '1'
            };

        case 'subgift':
            return {
                ...base,
                plan: tags.get('msg-param-sub-plan') || '1000',
                planName: tags.get('msg-param-sub-plan-name') || 'Tier 1',
                months: parseInt(tags.get('msg-param-gift-months') || '1'),
                recipientUsername: tags.get('msg-param-recipient-user-name') || '',
                recipientDisplayName: tags.get('msg-param-recipient-display-name') || '',
                recipientId: tags.get('msg-param-recipient-id') || '',
                giftMonths: parseInt(tags.get('msg-param-gift-months') || '1'),
                senderCount: parseInt(tags.get('msg-param-sender-count') || '0')
            };

        case 'submysterygift':
            return {
                ...base,
                plan: tags.get('msg-param-sub-plan') || '1000',
                giftCount: parseInt(tags.get('msg-param-mass-gift-count') || '1'),
                senderCount: parseInt(tags.get('msg-param-sender-count') || '0')
            };

        case 'raid':
            return {
                ...base,
                viewerCount: parseInt(tags.get('msg-param-viewerCount') || '0'),
                displayName: tags.get('msg-param-displayName') || base.displayName
            };

        case 'ritual':
            return {
                ...base,
                ritualName: tags.get('msg-param-ritual-name') || 'new_chatter'
            };

        case 'bitsbadgetier':
            return {
                ...base,
                threshold: parseInt(tags.get('msg-param-threshold') || '0')
            };

        case 'announcement':
            return {
                ...base,
                color: tags.get('msg-param-color') || 'primary'
            };

        default:
            return base;
    }
}

/**
 * Decode IRC tag value
 * IRC tags escape special characters
 */
function decodeIRCTag(value: string): string {
    return value
        .replace(/\\s/g, ' ')
        .replace(/\\:/g, ';')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\\\/g, '\\');
}

/**
 * Format USERNOTICE for display
 */
export function formatUserNotice(notice: UserNotice): string {
    // Use system message if available
    if (notice.systemMsg) {
        return notice.systemMsg;
    }

    // Fallback formatting based on type
    switch (notice.type) {
        case 'sub':
            return `${notice.displayName} subscribed!`;

        case 'resub':
            return `${notice.displayName} resubscribed!`;

        case 'subgift': {
            const gift = notice as any;
            return `${notice.displayName} gifted a sub to ${gift.recipientDisplayName}!`;
        }

        case 'submysterygift': {
            const mystery = notice as any;
            return `${notice.displayName} is gifting ${mystery.giftCount} subs!`;
        }

        case 'raid': {
            const raid = notice as any;
            return `${notice.displayName} is raiding with ${raid.viewerCount} viewers!`;
        }

        case 'ritual':
            return `${notice.displayName} is new to chat!`;

        case 'bitsbadgetier': {
            const bits = notice as any;
            return `${notice.displayName} achieved ${bits.threshold} bits badge!`;
        }

        case 'announcement':
            return `Announcement: ${notice.displayName}: ${notice.message || ''}`;

        default:
            return `${notice.displayName}: ${notice.message || ''}`;
    }
}

/**
 * Get color for USERNOTICE type
 */
export function getUserNoticeColor(type: UserNoticeType): string {
    const colors: Record<UserNoticeType, string> = {
        'sub': '#9147ff',
        'resub': '#9147ff',
        'subgift': '#ff69b4',
        'submysterygift': '#ff69b4',
        'giftpaidupgrade': '#ff69b4',
        'rewardgift': '#ff69b4',
        'anongiftpaidupgrade': '#ff69b4',
        'raid': '#ff0000',
        'unraid': '#ff0000',
        'ritual': '#00ff00',
        'bitsbadgetier': '#9c27b0',
        'announcement': '#0099ff',
        'charity': '#00ff00'
    };

    return colors[type] || '#999999';
}

/**
 * Check if USERNOTICE should be displayed
 */
export function shouldDisplayUserNotice(notice: UserNotice, options: any): boolean {
    if (!options) return true;

    switch (notice.type) {
        case 'sub':
        case 'resub':
            return options.showSubs !== false;

        case 'subgift':
        case 'submysterygift':
            return options.showGiftSubs !== false;

        case 'raid':
            return options.showRaids !== false;

        case 'ritual':
            return options.showRituals !== false;

        case 'bitsbadgetier':
            return options.showBitsBadges !== false;

        case 'announcement':
            return options.showAnnouncements !== false;

        default:
            return true;
    }
}
