/**
 * HTML Sanitizer
 * Provides XSS protection for user-generated content
 */

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Unescape HTML entities
 */
export function unescapeHtml(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
}

/**
 * Preserve emoticons while escaping HTML
 * <3 should stay <3, >( should stay >(
 */
export function escapeHtmlPreserveEmoticons(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/(<)(?!3)/g, '&lt;') // Don't escape < if followed by 3
        .replace(/(>)(?!\()/g, '&gt;') // Don't escape > if followed by (
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Strip all HTML tags from text
 */
export function stripHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize HTML with allowed tags
 */
export function sanitizeHtml(html: string, allowedTags: string[] = []): string {
    if (allowedTags.length === 0) {
        return stripHtmlTags(html);
    }

    // This is a simple sanitizer - for production use DOMPurify
    const div = document.createElement('div');
    div.innerHTML = html;

    const traverse = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tagName = element.tagName.toLowerCase();

            if (!allowedTags.includes(tagName)) {
                // Remove disallowed tag but keep content
                const fragment = document.createDocumentFragment();
                while (element.firstChild) {
                    fragment.appendChild(element.firstChild);
                }
                element.parentNode?.replaceChild(fragment, element);
                return;
            }

            // Remove dangerous attributes
            const attrs = element.attributes;
            for (let i = attrs.length - 1; i >= 0; i--) {
                const attr = attrs[i];
                if (attr.name.startsWith('on') || attr.name === 'style') {
                    element.removeAttribute(attr.name);
                }
            }
        }

        // Traverse children
        const children = Array.from(node.childNodes);
        children.forEach(traverse);
    };

    traverse(div);
    return div.innerHTML;
}

/**
 * Safe innerHTML setter with automatic sanitization
 */
export function setInnerHTML(element: HTMLElement, html: string, allowedTags: string[] = []): void {
    element.innerHTML = sanitizeHtml(html, allowedTags);
}

/**
 * Create safe text node
 */
export function createTextNode(text: string): Text {
    return document.createTextNode(text);
}

/**
 * Sanitize URL to prevent XSS
 */
export function sanitizeURL(url: string): string {
    const trimmed = url.trim().toLowerCase();
    
    if (trimmed.startsWith('javascript:') || 
        trimmed.startsWith('data:') || 
        trimmed.startsWith('vbscript:') ||
        trimmed.startsWith('file:')) {
        return '';
    }

    return url;
}
