import type { JSX } from "solid-js";
import type { ChatConfig } from "~/utils/chat";
import type { TwitchMessage, ChatISIntegrationService } from "~/services/chat";
import { bitsService } from "~/services/chat";
import { mentionStyleService } from "~/services/chat";
import {
  parseGoogleEmoji,
  extractEmojis,
  restoreEmojis,
} from "~/utils/chat/emojiUtils";
import { SIZE_CONFIGS } from "~/styles/chatStyles";

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

function renderMentionHtml(token: string, service: ChatISIntegrationService): string | null {
  const mentionStyle = mentionStyleService.resolveMention(token, service);
  if (!mentionStyle) return null;

  const escapedText = escapeHtml(mentionStyle.text);
  const escapedSuffix = escapeHtml(mentionStyle.suffix);

  switch (mentionStyle.kind) {
    case "global-paint":
      return `<span class="mention chatis-seventv-paint" data-seventv-paint-id="${escapeAttr(mentionStyle.paintId)}">${escapedText}</span>${escapedSuffix}`;
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
  service: ChatISIntegrationService,
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
            html: `<span class="emote-container"><img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(emoteId)}/default/dark/3.0" alt="${escapeAttr(emoteCode)}" /></span>`,
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
                        <img class="cheer_emote" src="${cheerEmoteUrl}" style="max-height: ${size.cheerEmoteMaxHeight}px; margin-bottom: ${size.cheerEmoteMarginBottom}; vertical-align: middle;" alt="${escapeAttr(parsed.prefix)}" />
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

  const parts = rawMessage.split(/(\s+)/);

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
    segments[index].html = combined.replace(
      '<span class="emote-container">',
      '<span class="emote-container" data-zw-group="true">',
    );
    return true;
  };

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      segments.push({ kind: "ws", html: part });
      continue;
    }

    const [withPlaceholders, emojis] = extractEmojis(part);
    const cleanText = withPlaceholders.replace(/__EMOJI\d+__/g, "");

    const replacement = replacements[cleanText];
    const emote =
      message.emoteSnapshot?.get(cleanText) ||
      service.getEmote(cleanText, message.username);
    const emoteReplacement = (() => {
      if (!emote || !cleanText) return null;

      const url = sanitizeImageUrl(String(emote.url || ""));
      if (!url) return null;

      if (emote.zero_width) {
        return {
          kind: "zw" as const,
          overlayHtml: `<img class="emote zerowidth" src="${url}" alt="${escapeAttr(cleanText)}" />`,
          fallbackHtml: `<span class="emote-container"><img class="emote" src="${url}" alt="${escapeAttr(cleanText)}" /></span>`,
        };
      }

      return {
        kind: "html" as const,
        html: `<span class="emote-container"><img class="emote" src="${url}" alt="${escapeAttr(cleanText)}" /></span>`,
        isOverlayTarget: true,
      };
    })();

    if (replacement || emoteReplacement) {
      const activeReplacement = replacement || emoteReplacement;
      if (!activeReplacement) continue;

      if (activeReplacement.kind === "zw") {
        if (!attachZeroWidth(activeReplacement.overlayHtml)) {
          segments.push({ kind: "target", html: activeReplacement.fallbackHtml });
        }
      } else {
        segments.push({
          kind: activeReplacement.isOverlayTarget ? "target" : "other",
          html: activeReplacement.html,
        });
      }
      continue;
    }

    const restoredText = restoreEmojis(withPlaceholders, emojis);
    const mentionHtml = renderMentionHtml(restoredText, service);
    if (mentionHtml) {
      segments.push({ kind: "text", html: mentionHtml });
      continue;
    }

    const escapedText = escapeHtml(restoredText);
    const withEmojiImages = parseGoogleEmoji(escapedText, size.emojiHeight);

    const isEmojiOnlyToken = cleanText.length === 0 && emojis.length > 0;
    segments.push({
      kind: isEmojiOnlyToken ? "target" : "text",
      html: withEmojiImages,
    });
  }

  const joinedText = segments.map((segment) => segment.html).join("");
  const element = document.createElement("span");
  element.innerHTML = joinedText;

  if (message.isGigantifiedEmote) {
    const target = element.querySelector("img.emote, img.emoji");
    if (target) {
      const line = document.createElement("span");
      const giant = target.cloneNode(true) as HTMLImageElement;
      const emoteContainer = target.closest(".emote-container");
      const sourceNode =
        emoteContainer instanceof HTMLElement ? emoteContainer : target;

      line.className = "gigantified-emote-line";
      giant.classList.add("gigantified");
      line.append(giant);
      sourceNode.remove();
      element.append(line);
    }
  }

  return element;
}

