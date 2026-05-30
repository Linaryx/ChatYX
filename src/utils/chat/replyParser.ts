/**
 * Reply Threading Parser
 * Extracts and parses Twitch reply-parent-* IRC tags
 */

import { log, LOG_CATEGORIES } from "../logger";
import type { ReplyThread } from "../../types/replyThread";

/**
 * Parse reply thread information from IRC tags
 * Tags format: reply-parent-msg-id=xxx;reply-parent-display-name=xxx;...
 */
export function parseReplyThread(tags: Map<string, string>): ReplyThread | null {
    const parentMsgId = tags.get('reply-parent-msg-id');
    
    if (!parentMsgId) {
        return null;
    }

    const parentDisplayName = tags.get('reply-parent-display-name') || '';
    const parentUserLogin = tags.get('reply-parent-user-login') || '';
    const parentMsgBody = tags.get('reply-parent-msg-body') || '';
    const parentUserId = tags.get('reply-parent-user-id') || '';

    log.debug(LOG_CATEGORIES.IRC, `Parsed reply thread: parent=${parentMsgId}, author=${parentUserLogin}`);

    return {
        parentMsgId,
        parentDisplayName,
        parentUserLogin,
        parentMsgBody,
        parentUserId
    };
}

/**
 * Check if IRC tags contain reply information
 */
export function hasReplyThread(tags: Map<string, string>): boolean {
    return tags.has('reply-parent-msg-id');
}

/**
 * Get reply thread parent message ID
 */
export function getReplyParentId(tags: Map<string, string>): string | null {
    return tags.get('reply-parent-msg-id') || null;
}

/**
 * Format reply parent message preview
 */
export function formatReplyPreview(parentText: string, maxLength: number = 50): string {
    if (parentText.length <= maxLength) {
        return parentText;
    }

    return parentText.slice(0, maxLength) + '...';
}

/**
 * Decode HTML entities in parent message body
 * IRC sends parent body with HTML entities encoded
 */
export function decodeParentMessageBody(body: string): string {
    const entities: Record<string, string> = {
        '&#x2F;': '/',
        '&#x3A;': ':',
        '&#x28;': '(',
        '&#x29;': ')',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'"
    };

    let decoded = body;
    for (const [entity, char] of Object.entries(entities)) {
        decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }

    return decoded;
}

/**
 * Create reply thread from IRC message
 */
export function createReplyThread(ircMessage: string): ReplyThread | null {
    // Extract tags from IRC message
    const tagsMatch = /^@([^ ]+)/.exec(ircMessage);
    if (!tagsMatch) return null;

    const tagsString = tagsMatch[1];
    const tags = new Map<string, string>();

    // Parse tags
    tagsString.split(';').forEach(tag => {
        const [key, value] = tag.split('=');
        if (key && value) {
            tags.set(key, value);
        }
    });

    return parseReplyThread(tags);
}
