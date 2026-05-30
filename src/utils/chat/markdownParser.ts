/**
 * Markdown Parser
 * Simple markdown parsing for chat messages
 */

export interface MarkdownOptions {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
    links?: boolean;
}

const DEFAULT_OPTIONS: MarkdownOptions = {
    bold: true,
    italic: true,
    strikethrough: true,
    code: true,
    links: true
};

/**
 * Parse bold text (**text** or __text__)
 */
function parseBold(text: string): string {
    // **text** or __text__
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>');
}

/**
 * Parse italic text (*text* or _text_)
 */
function parseItalic(text: string): string {
    // *text* or _text_ (but not ** or __)
    return text
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
        .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');
}

/**
 * Parse strikethrough text (~~text~~)
 */
function parseStrikethrough(text: string): string {
    return text.replace(/~~(.+?)~~/g, '<del>$1</del>');
}

/**
 * Parse inline code (`code`)
 */
function parseCode(text: string): string {
    return text.replace(/`(.+?)`/g, '<code>$1</code>');
}

/**
 * Parse markdown links [text](url)
 */
function parseLinks(text: string): string {
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        // Sanitize URL
        const sanitized = sanitizeMarkdownURL(url);
        if (!sanitized) {
            return match; // Return original if URL is dangerous
        }
        return `<a href="${sanitized}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    });
}

/**
 * Sanitize URL in markdown
 */
function sanitizeMarkdownURL(url: string): string {
    const trimmed = url.trim().toLowerCase();
    
    if (trimmed.startsWith('javascript:') || 
        trimmed.startsWith('data:') || 
        trimmed.startsWith('vbscript:') ||
        trimmed.startsWith('file:')) {
        return '';
    }

    return url;
}

/**
 * Parse markdown image ![alt](url)
 */
export function parseMarkdownImage(text: string, maxWidth: number = 400, maxHeight: number = 300): string {
    return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
        // Sanitize URL
        const sanitized = sanitizeMarkdownURL(url);
        if (!sanitized) {
            return match;
        }

        // Check if URL is an image
        if (!isImageURL(url)) {
            return match;
        }

        return `<img src="${sanitized}" alt="${alt}" class="markdown-image" style="max-width: ${maxWidth}px; max-height: ${maxHeight}px; vertical-align: middle;" />`;
    });
}

/**
 * Check if URL points to an image
 */
function isImageURL(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const lowerURL = url.toLowerCase();
    return imageExtensions.some(ext => lowerURL.endsWith(ext));
}

/**
 * Parse markdown with options
 */
export function parseMarkdown(text: string, options: MarkdownOptions = DEFAULT_OPTIONS): string {
    let result = text;

    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Parse in specific order to avoid conflicts
    if (opts.code) {
        result = parseCode(result);
    }

    if (opts.bold) {
        result = parseBold(result);
    }

    if (opts.italic) {
        result = parseItalic(result);
    }

    if (opts.strikethrough) {
        result = parseStrikethrough(result);
    }

    if (opts.links) {
        result = parseLinks(result);
    }

    return result;
}

/**
 * Check if text contains markdown syntax
 */
export function hasMarkdown(text: string): boolean {
    const patterns = [
        /\*\*.+?\*\*/,           // Bold **text**
        /__.+?__/,               // Bold __text__
        /(?<!\*)\*(?!\*).+?(?<!\*)\*(?!\*)/, // Italic *text*
        /(?<!_)_(?!_).+?(?<!_)_(?!_)/,       // Italic _text_
        /~~.+?~~/,               // Strikethrough ~~text~~
        /`.+?`/,                 // Code `text`
        /\[.+?\]\(.+?\)/,        // Link [text](url)
        /!\[.*?\]\(.+?\)/        // Image ![alt](url)
    ];

    return patterns.some(pattern => pattern.test(text));
}

/**
 * Strip markdown formatting (keep plain text)
 */
export function stripMarkdown(text: string): string {
    return text
        // Remove bold
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        // Remove italic
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        // Remove strikethrough
        .replace(/~~(.+?)~~/g, '$1')
        // Remove code
        .replace(/`(.+?)`/g, '$1')
        // Remove links
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove images
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
}
