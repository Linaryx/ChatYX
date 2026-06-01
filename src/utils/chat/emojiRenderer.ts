/**
 * Emoji Renderer
 * Converts Unicode emojis to images using Twemoji CDN
 */

// Twemoji CDN base URL
const TWEMOJI_CDN = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets";

// Emoji regex (simplified - for full support use twemoji library)
const EMOJI_REGEX =
  /(?:[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2934}\u{2935}]|\u{FE0F})/gu;

/**
 * Convert emoji codepoint to hex string
 */
export function emojiToCodepoint(emoji: string): string {
  const codepoints: string[] = [];

  for (let i = 0; i < emoji.length; i++) {
    const code = emoji.codePointAt(i);
    if (code) {
      codepoints.push(code.toString(16));
      // Skip low surrogate if high surrogate was processed
      if (code > 0xffff) {
        i++;
      }
    }
  }

  return codepoints.join("-");
}

/**
 * Get Twemoji image URL for an emoji
 */
export function getTwemojiURL(
  emoji: string,
  size: "72x72" | "36x36" = "72x72",
): string {
  const codepoint = emojiToCodepoint(emoji);
  return `${TWEMOJI_CDN}/${size}/${codepoint}.png`;
}

/**
 * Render emoji as an image tag
 */
export function renderEmoji(emoji: string, height: number = 24): string {
  const url = getTwemojiURL(emoji);
  return `<img class="emoji" src="${url}" alt="" title="${emoji}" style="height: ${height}px; vertical-align: middle;" draggable="false" />`;
}

/**
 * Replace all emojis in text with images
 */
export function emojifyText(text: string, height: number = 24): string {
  return text.replace(EMOJI_REGEX, (emoji) => {
    return renderEmoji(emoji, height);
  });
}

/**
 * Check if text contains emojis
 */
export function hasEmojis(text: string): boolean {
  EMOJI_REGEX.lastIndex = 0;
  return EMOJI_REGEX.test(text);
}

/**
 * Extract all emojis from text
 */
export function extractEmojis(text: string): string[] {
  const matches = text.match(EMOJI_REGEX);
  return matches || [];
}

/**
 * Remove emojis from text
 */
export function removeEmojis(text: string): string {
  return text.replace(EMOJI_REGEX, "");
}

/**
 * Count emojis in text
 */
export function countEmojis(text: string): number {
  const matches = text.match(EMOJI_REGEX);
  return matches ? matches.length : 0;
}
