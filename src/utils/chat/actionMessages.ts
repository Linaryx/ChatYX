/**
 * Action Messages (/me) Utilities
 * Handles IRC ACTION messages with italic styling
 */

import { log, LOG_CATEGORIES } from "../logger";

/**
 * Check if message is an action (/me) message
 * ACTION messages start with \x01ACTION and end with \x01
 */
export function isActionMessage(messageText: string): boolean {
    return messageText.startsWith('\x01ACTION') && messageText.endsWith('\x01');
}

/**
 * Parse action message and remove IRC control characters
 */
export function parseActionMessage(messageText: string): string {
    if (!isActionMessage(messageText)) {
        return messageText;
    }

    // Remove \x01ACTION prefix and \x01 suffix
    const text = messageText.slice(8, -1).trim();
    
    log.debug(LOG_CATEGORIES.IRC, `Parsed action message: "${text}"`);
    
    return text;
}

/**
 * Check if raw IRC message is an ACTION
 */
export function isActionFromIRC(rawMessage: string): boolean {
    // Check PRIVMSG content for ACTION
    const match = /PRIVMSG #\S+ :(.+)/.exec(rawMessage);
    if (!match) return false;
    
    return isActionMessage(match[1]);
}

/**
 * Extract action message from raw IRC line
 */
export function extractActionFromIRC(rawMessage: string): string | null {
    const match = /PRIVMSG #\S+ :(.+)/.exec(rawMessage);
    if (!match) return null;
    
    const messageText = match[1];
    if (!isActionMessage(messageText)) return null;
    
    return parseActionMessage(messageText);
}

/**
 * Format action message for display
 * Returns HTML with italic styling
 */
export function formatActionMessage(username: string, actionText: string, userColor: string): string {
    const color = userColor || '#999999';
    
    return `<span style="color: ${color}; font-style: italic;">${username} ${actionText}</span>`;
}

/**
 * Create action message CSS class
 */
export function getActionMessageClass(): string {
    return 'chat-message-action';
}

/**
 * Generate action message styles
 */
export function getActionMessageStyles(): string {
    return `
.chat-message-action {
    font-style: italic;
}

.chat-message-action .chat-username,
.chat-message-action .chat-message-text {
    font-style: italic;
}
`;
}
