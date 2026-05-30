// Zero-width emote rendering utilities

export interface ZeroWidthEmote {
  id: string;
  code: string;
  url: string;
  width: number;
  height: number;
  provider: '7tv' | 'ffz' | 'bttv';
}

/**
 * Calculate margin-left offset for zero-width emote overlay
 * Based on previous emote width
 */
export function calculateZeroWidthOffset(previousEmoteWidth: number, zeroWidthEmoteWidth: number): number {
  // Offset is negative to overlay on previous emote
  // Center the zero-width emote over the previous one
  return -(previousEmoteWidth + (previousEmoteWidth - zeroWidthEmoteWidth) / 2);
}

/**
 * Generate CSS for zero-width emote
 */
export function generateZeroWidthCSS(offset: number): string {
  return `margin-left: ${offset}px; z-index: 1; position: relative;`;
}

/**
 * Check if emote should be rendered as zero-width
 */
export function isZeroWidthEmote(emote: any): boolean {
  return emote.zero_width === true || emote.zeroWidth === true || emote.flags?.zeroWidth === true;
}

/**
 * Parse message for zero-width emote sequences
 * Returns array of segments with emote metadata
 */
export interface MessageSegment {
  type: 'text' | 'emote' | 'zero-width-emote';
  content: string;
  emote?: {
    id: string;
    code: string;
    url: string;
    width: number;
    height: number;
    isZeroWidth: boolean;
    provider: string;
  };
  offset?: number; // For zero-width emotes
}

/**
 * Build message segments with zero-width emote support
 */
export function parseMessageWithZeroWidth(
  message: string,
  emoteMap: Map<string, any>
): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const words = message.split(' ');
  
  let previousEmoteWidth: number | null = null;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const emote = emoteMap.get(word);

    if (emote) {
      const isZeroWidth = isZeroWidthEmote(emote);
      
      const segment: MessageSegment = {
        type: isZeroWidth ? 'zero-width-emote' : 'emote',
        content: word,
        emote: {
          id: emote.id,
          code: emote.code || word,
          url: emote.urls?.[2] || emote.urls?.[1] || emote.url,
          width: emote.width || 28,
          height: emote.height || 28,
          isZeroWidth,
          provider: emote.provider || 'twitch'
        }
      };

      // Calculate offset for zero-width emotes
      if (isZeroWidth && previousEmoteWidth !== null) {
        const emoteWidth = segment.emote!.width;
        segment.offset = calculateZeroWidthOffset(previousEmoteWidth, emoteWidth);
      }

      // Update previous emote width if not zero-width
      if (!isZeroWidth) {
        previousEmoteWidth = segment.emote!.width;
      }

      segments.push(segment);
    } else {
      segments.push({
        type: 'text',
        content: word
      });
      previousEmoteWidth = null; // Reset on text
    }

    // Add space after word (except last word)
    if (i < words.length - 1) {
      segments.push({
        type: 'text',
        content: ' '
      });
    }
  }

  return segments;
}

/**
 * Render message segment to HTML
 */
export function renderSegment(segment: MessageSegment, emoteScale: number = 1): string {
  switch (segment.type) {
    case 'text':
      return escapeHtml(segment.content);

    case 'emote':
      return renderEmote(segment.emote!, emoteScale);

    case 'zero-width-emote':
      return renderZeroWidthEmote(segment.emote!, segment.offset || 0, emoteScale);

    default:
      return '';
  }
}

/**
 * Render regular emote
 */
function renderEmote(emote: MessageSegment['emote'], scale: number): string {
  const width = (emote?.width || 28) * scale;
  const height = (emote?.height || 28) * scale;
  
  return `<img src="${emote?.url}" 
    alt="${emote?.code}" 
    title="${emote?.code}" 
    class="chat-emote" 
    style="width: ${width}px; height: ${height}px; vertical-align: middle;" 
    data-emote-id="${emote?.id}"
    data-provider="${emote?.provider}" />`;
}

/**
 * Render zero-width emote with offset
 */
function renderZeroWidthEmote(emote: MessageSegment['emote'], offset: number, scale: number): string {
  const width = (emote?.width || 28) * scale;
  const height = (emote?.height || 28) * scale;
  
  return `<img src="${emote?.url}" 
    alt="${emote?.code}" 
    title="${emote?.code} (Zero-Width)" 
    class="chat-emote chat-emote-zero-width" 
    style="width: ${width}px; height: ${height}px; margin-left: ${offset}px; vertical-align: middle; position: relative; z-index: 1;" 
    data-emote-id="${emote?.id}"
    data-provider="${emote?.provider}"
    data-zero-width="true" />`;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render full message with zero-width support
 */
export function renderMessageWithZeroWidth(
  message: string,
  emoteMap: Map<string, any>,
  emoteScale: number = 1
): string {
  const segments = parseMessageWithZeroWidth(message, emoteMap);
  return segments.map(segment => renderSegment(segment, emoteScale)).join('');
}

/**
 * Inject CSS for zero-width emotes
 */
export function injectZeroWidthStyles(): void {
  const styleId = 'zero-width-emote-styles';
  
  if (document.getElementById(styleId)) {
    return; // Already injected
  }

  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = `
    .chat-emote-zero-width {
      display: inline-block;
      position: relative;
      z-index: 1;
    }
    
    /* Prevent zero-width emotes from affecting layout */
    .message {
      position: relative;
      z-index: 0;
    }
  `;
  
  document.head.appendChild(styleEl);
}
