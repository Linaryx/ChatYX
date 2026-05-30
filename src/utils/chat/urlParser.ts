/**
 * URL Parser and Linker
 * Detects URLs in text and creates clickable links
 */

// URL regex pattern (from https://urlregex.com/)
const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;

export interface DetectedURL {
  url: string;
  start: number;
  end: number;
  display: string;
}

/**
 * Detect all URLs in text
 */
export function detectURLs(text: string): DetectedURL[] {
  const urls: DetectedURL[] = [];
  let match;

  // Reset regex lastIndex
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const url = match[0];
    urls.push({
      url,
      start: match.index,
      end: match.index + url.length,
      display: url.length > 50 ? url.substring(0, 47) + "..." : url,
    });
  }

  return urls;
}

/**
 * Sanitize URL to prevent javascript: and data: schemes
 */
export function sanitizeURL(url: string): string {
  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("file:")
  ) {
    return "";
  }

  return url;
}

/**
 * Create a clickable link element
 */
export function createLink(url: string, display?: string): string {
  const sanitized = sanitizeURL(url);
  if (!sanitized) {
    return display || url; // Return plain text if URL is dangerous
  }

  const safeHref = sanitized.replace(/"/g, "%22");
  const displayText = display || url;
  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="chat-link">${displayText}</a>`;
}

/**
 * Replace all URLs in text with clickable links
 */
export function linkifyURLs(text: string): string {
  const urls = detectURLs(text);

  if (urls.length === 0) {
    return text;
  }

  // Replace URLs from end to start to maintain indices
  let result = text;
  for (let i = urls.length - 1; i >= 0; i--) {
    const detected = urls[i];
    const link = createLink(detected.url, detected.display);
    result =
      result.substring(0, detected.start) +
      link +
      result.substring(detected.end);
  }

  return result;
}

/**
 * Check if text contains URLs
 */
export function hasURLs(text: string): boolean {
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}
