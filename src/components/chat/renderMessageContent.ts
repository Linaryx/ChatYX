import type { JSX } from "solid-js";
import type { ChatConfig } from "~/utils/chat";
import type { TwitchMessage, ChatPresentationService } from "~/services/chat";
import { bitsService } from "~/services/chat";
import { mentionStyleService } from "~/services/chat";
import {
  createMessageTokenSnapshot,
  parseGoogleEmoji,
  restoreEmojis,
} from "~/utils/chat/emojiUtils";
import { SIZE_CONFIGS } from "~/styles/chatStyles";
import { tokenizeLinks } from "~/utils/chat/linkUtils";

export function escapeHtml(message: string): string {
  return message
    .replace(/&/g, "&amp;")
    .replace(/(<)(?!3)/g, "&lt;")
    .replace(/(>)(?!\()/g, "&gt;");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeImageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function imageSizeDataAttrs(width?: number, height?: number): string {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return "";
  if (!width || !height || width <= 0 || height <= 0) return "";
  return ` data-emote-width="${Math.round(width)}" data-emote-height="${Math.round(height)}"`;
}

function renderSizeStyle(
  width: number | undefined,
  height: number | undefined,
  config: ChatConfig,
  size: (typeof SIZE_CONFIGS)[keyof typeof SIZE_CONFIGS],
): string {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return "";
  if (!width || !height || width <= 0 || height <= 0) return "";

  const emoteScale = Number.isFinite(config.emoteScale)
    ? Math.min(Math.max(config.emoteScale, 0.25), 3)
    : 1;
  const maxWidth = Number.parseFloat(size.emoteMaxWidth) * emoteScale;
  const maxHeight = size.emoteMaxHeight * emoteScale;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);

  return ` style="width: ${(width * scale).toFixed(3)}px; height: ${(height * scale).toFixed(3)}px;"`;
}

function emoteImageAttrs(
  width: number | undefined,
  height: number | undefined,
  config: ChatConfig,
  size: (typeof SIZE_CONFIGS)[keyof typeof SIZE_CONFIGS],
): string {
  return (
    imageSizeDataAttrs(width, height) +
    renderSizeStyle(width, height, config, size)
  );
}

function applyImageSizeAttrsFromData(image: HTMLImageElement) {
  const width = Number(image.dataset.emoteWidth || image.getAttribute("width"));
  const height = Number(image.dataset.emoteHeight || image.getAttribute("height"));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  if (width <= 0 || height <= 0) return;

  image.setAttribute("width", String(Math.round(width)));
  image.setAttribute("height", String(Math.round(height)));
}

function renderMentionHtml(token: string, service: ChatPresentationService): string | null {
  const mentionStyle = mentionStyleService.resolveMention(token, service);
  if (!mentionStyle) return null;

  const escapedText = escapeHtml(mentionStyle.text);
  const escapedSuffix = escapeHtml(mentionStyle.suffix);

  switch (mentionStyle.kind) {
    case "global-paint":
      return `<span class="mention chatyx-seventv-paint" data-seventv-paint-id="${escapeAttr(mentionStyle.paintId)}">${escapedText}</span>${escapedSuffix}`;
    case "inline-paint": {
      // css is generated internally from 7TV paint data — strip any quotes to prevent attr breakout
      const safeCss = mentionStyle.css.replace(/"/g, "'");
      return `<span class="mention" style="${safeCss}">${escapedText}</span>${escapedSuffix}`;
    }
    case "color": {
      // color comes from Twitch IRC tag — only allow safe hex/rgb/named values
      const safeColor = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]{1,30})$/.test(mentionStyle.color)
        ? mentionStyle.color
        : "#ffffff";
      return `<span class="mention" style="color: ${safeColor};">${escapedText}</span>${escapedSuffix}`;
    }
  }
}

/**
 * Render message content with emotes/emoji/cheers to JSX (innerHTML)
 */
export function renderMessageWithEmotes(
  message: TwitchMessage,
  config: ChatConfig,
  service: ChatPresentationService,
): JSX.Element {
  const size =
    SIZE_CONFIGS[config.size as keyof typeof SIZE_CONFIGS] || SIZE_CONFIGS[2];
  const rawMessage = message.message;

  type Replacement =
    | { kind: "html"; html: string; isOverlayTarget: boolean }
    | { kind: "zw"; overlayHtml: string; fallbackHtml: string };

  const replacements: Record<string, Replacement> = {};

  // Twitch emotes (uses codepoint indexes)
  if (message.emotes && typeof message.emotes === "object") {
    const codePointToCodeUnit = (
      text: string,
      codePointIndex: number,
    ): number => {
      let currentCodePoint = 0;
      for (let i = 0; i < text.length; i++) {
        if (currentCodePoint === codePointIndex) return i;
        const charCode = text.charCodeAt(i);
        if (charCode >= 0xd800 && charCode <= 0xdbff) i += 1; // skip low surrogate
        currentCodePoint += 1;
      }
      return text.length;
    };

    Object.entries(message.emotes as Record<string, string[]>).forEach(
      ([emoteId, positions]) => {
        if (!Array.isArray(positions)) return;
        positions.forEach((pos) => {
          const [startRaw, endRaw] = String(pos).split("-");
          const startCP = Number(startRaw);
          const endCP = Number(endRaw);
          if (!Number.isFinite(startCP) || !Number.isFinite(endCP)) return;

          const start = codePointToCodeUnit(rawMessage, startCP);
          const end = codePointToCodeUnit(rawMessage, endCP + 1);

          const emoteCode = rawMessage.substring(start, end);
          if (!emoteCode || /^\s*$/.test(emoteCode)) return;

          replacements[emoteCode] = {
            kind: "html",
            html: `<span class="emote-container"><img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(emoteId)}/default/dark/3.0" alt="" title="${escapeAttr(emoteCode)}" /></span>`,
            isOverlayTarget: true,
          };
        });
      },
    );
  }

  // Cheers: render single merged cheer (v2 behavior)
  if (
    (message as any).enhanced?.cheers &&
    (message as any).enhanced?.totalBits
  ) {
    const cheers = (message as any).enhanced.cheers;
    const totalBits = (message as any).enhanced.totalBits;

    if (cheers.length > 0) {
      const firstCheer = cheers[0].parsed;
      const parsed = bitsService.parseCheer(`${firstCheer.prefix}${totalBits}`);
      const cheerEmoteUrl = parsed ? sanitizeImageUrl(parsed.emoteUrl) : "";
      if (parsed && cheerEmoteUrl) {
        const cheerHtml = `<span class="cheer-container">
                        <img class="cheer_emote" src="${cheerEmoteUrl}" style="max-height: ${size.cheerEmoteMaxHeight}px; margin-bottom: ${size.cheerEmoteMarginBottom}; vertical-align: middle;" alt="" title="${escapeAttr(parsed.prefix)}" />
                        <span class="cheer_bits" style="color: ${parsed.color}; font-weight: ${size.cheerBitsFontWeight}; margin-left: ${size.cheerBitsMarginLeft}; margin-right: ${size.cheerBitsMarginRight};">${totalBits}</span>
                    </span>`;

        cheers.forEach((cheer: any, index: number) => {
          if (index === 0) {
            replacements[cheer.text] = {
              kind: "html",
              html: cheerHtml,
              isOverlayTarget: false,
            };
          } else {
            replacements[cheer.text] = {
              kind: "html",
              html: "",
              isOverlayTarget: false,
            };
          }
        });
      }
    }
  }

  const tokenSnapshot =
    message.tokenSnapshot?.source === rawMessage
      ? message.tokenSnapshot
      : createMessageTokenSnapshot(rawMessage);

  type SegmentKind = "ws" | "text" | "target" | "other";
  type Segment = { kind: SegmentKind; html: string };
  const segments: Segment[] = [];

  const attachZeroWidth = (overlayHtml: string): boolean => {
    let index = segments.length - 1;
    while (index >= 0 && segments[index].kind === "ws") index -= 1;
    if (index < 0) return false;
    if (segments[index].kind !== "target") return false;

    segments.length = index + 1;

    const closingTag = "</span>";
    const html = segments[index].html;
    const closeIndex = html.lastIndexOf(closingTag);
    if (closeIndex === -1 || closeIndex !== html.length - closingTag.length) {
      return false;
    }

    const combined = html.slice(0, closeIndex) + overlayHtml + closingTag;
    // Mark container so CSS and fixZeroWidthEmotes() can widen it to the largest emote
    segments[index].html = combined
      .replace(
        '<span class="emote-container">',
        '<span class="emote-container" data-zw-group="true">',
      )
      .replace(
        '<span class="emoji-container">',
        '<span class="emoji-container" data-zw-group="true">',
      );
    return true;
  };

  const createEmoteReplacement = (
    cleanText: string,
    emote: any,
  ): Replacement | null => {
    if (!emote || !cleanText) return null;

    const url = sanitizeImageUrl(String(emote.url || ""));
    if (!url) return null;

    const sourceClass = emote.source === "youtube" ? " youtube-emote" : "";

    if (emote.zero_width) {
      const attrs = emoteImageAttrs(emote.width, emote.height, config, size);
      return {
        kind: "zw",
        overlayHtml: `<img class="emote zerowidth${sourceClass}" src="${url}" alt="" title="${escapeAttr(cleanText)}"${attrs} />`,
        fallbackHtml: `<span class="emote-container"><img class="emote${sourceClass}" src="${url}" alt="" title="${escapeAttr(cleanText)}"${attrs} /></span>`,
      };
    }

    return {
      kind: "html",
      html: `<span class="emote-container"><img class="emote${sourceClass}" src="${url}" alt="" title="${escapeAttr(cleanText)}"${emoteImageAttrs(emote.width, emote.height, config, size)} /></span>`,
      isOverlayTarget: true,
    };
  };

  const pushReplacement = (activeReplacement: Replacement) => {
    if (activeReplacement.kind === "zw") {
      if (!attachZeroWidth(activeReplacement.overlayHtml)) {
        segments.push({
          kind: "target",
          html: activeReplacement.fallbackHtml,
        });
      }
    } else {
      segments.push({
        kind: activeReplacement.isOverlayTarget ? "target" : "other",
        html: activeReplacement.html,
      });
    }
  };

  const pushTextSegment = (textWithPlaceholders: string, emojis: string[]) => {
    if (!textWithPlaceholders) return;

    const restoredText = restoreEmojis(textWithPlaceholders, emojis);
    if (!restoredText) return;

    const mentionHtml = renderMentionHtml(restoredText, service);
    if (mentionHtml) {
      segments.push({ kind: "text", html: mentionHtml });
      return;
    }

    const withEmojiImages = tokenizeLinks(restoredText)
      .map((segment) => {
        if (segment.kind === "text") {
          return parseGoogleEmoji(escapeHtml(segment.value), size.emojiHeight);
        }
        if (config.linkMode === "hide") {
          return '<span class="chat-link-hidden">[ссылка скрыта]</span>';
        }

        const escapedLink = escapeHtml(segment.value);
        return config.linkMode === "highlight"
          ? `<span class="chat-link">${escapedLink}</span>`
          : escapedLink;
      })
      .join("");
    const cleanText = textWithPlaceholders.replace(/__EMOJI\d+__/g, "");
    const isEmojiOnlyToken = cleanText.length === 0 && emojis.length > 0;

    segments.push({
      kind: isEmojiOnlyToken ? "target" : "text",
      html: withEmojiImages,
    });
  };

  const pushInlineSnapshotTokens = (
    withPlaceholders: string,
    emojis: string[],
  ): boolean => {
    const snapshot = message.emoteSnapshot;
    if (!snapshot) return false;

    const tokens = Array.from(snapshot.keys())
      .filter((token) => token.startsWith("yt_emoji_") && withPlaceholders.includes(token))
      .sort((left, right) => right.length - left.length);
    if (tokens.length === 0) return false;

    let index = 0;
    while (index < withPlaceholders.length) {
      let matchToken = "";
      let matchIndex = -1;

      for (const token of tokens) {
        const tokenIndex = withPlaceholders.indexOf(token, index);
        if (tokenIndex === -1) continue;
        if (
          matchIndex === -1 ||
          tokenIndex < matchIndex ||
          (tokenIndex === matchIndex && token.length > matchToken.length)
        ) {
          matchIndex = tokenIndex;
          matchToken = token;
        }
      }

      if (matchIndex === -1) {
        pushTextSegment(withPlaceholders.slice(index), emojis);
        break;
      }

      pushTextSegment(withPlaceholders.slice(index, matchIndex), emojis);

      const replacement = createEmoteReplacement(
        matchToken,
        snapshot.get(matchToken),
      );
      if (replacement) {
        pushReplacement(replacement);
      } else {
        pushTextSegment(matchToken, emojis);
      }

      index = matchIndex + matchToken.length;
    }

    return true;
  };

  for (const token of tokenSnapshot.tokens) {
    if (token.isWhitespace) {
      segments.push({ kind: "ws", html: token.raw });
      continue;
    }

    const { withPlaceholders, emojis, cleanText } = token;
    const isPlainLookupToken = withPlaceholders === cleanText;

    const replacement = isPlainLookupToken ? replacements[cleanText] : undefined;
    const emote = isPlainLookupToken
      ? message.emoteSnapshot?.get(cleanText) ||
        service.getEmote(cleanText, message.username)
      : null;
    const emoteReplacement = createEmoteReplacement(cleanText, emote);

    if (replacement || emoteReplacement) {
      const activeReplacement = replacement || emoteReplacement;
      if (!activeReplacement) continue;
      pushReplacement(activeReplacement);
      continue;
    }

    if (pushInlineSnapshotTokens(withPlaceholders, emojis)) continue;

    pushTextSegment(withPlaceholders, emojis);
  }

  const joinedText = segments.map((segment) => segment.html).join("");
  const element = document.createElement("span");
  element.innerHTML = joinedText;

  if (message.isGigantifiedEmote) {
    const target = element.querySelector("img.emote, img.emoji");
    if (target) {
      const line = document.createElement("span");
      const giant = target.cloneNode(true) as HTMLImageElement;

      line.className = "gigantified-emote-line";
      giant.removeAttribute("style");
      applyImageSizeAttrsFromData(giant);
      giant.classList.add("gigantified");
      line.append(giant);
      element.replaceChildren(line);
    }
  }

  return element;
}

