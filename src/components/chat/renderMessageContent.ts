import type { JSX } from "solid-js";
import type { ChatConfig } from "~/utils/chat";
import type { TwitchMessage, ChatPresentationService } from "~/services/chat";
import { bitsService } from "~/services/chat";
import { mentionStyleService } from "~/services/chat";
import { networkClient } from "~/services/network/networkClient";
import {
  createMessageTokenSnapshot,
  parseGoogleEmoji,
  restoreEmojis,
} from "~/utils/chat/emojiUtils";
import { SIZE_CONFIGS } from "~/styles/chatStyles";
import { tokenizeLinks } from "~/utils/chat/linkUtils";
import {
  attachZeroWidthOverlay,
  bindWideEmoteSizes,
  buildGigantifiedLine,
  getEmoteModifier,
  resolveEmoteModifiers,
  wrapEmoteModifiers,
  wrapZeroWidthModifiers,
  type EmoteModifierEffect,
} from "~/utils/chat/emoteModifiers";

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

function twitchEmoteImageAttrs(
  config: ChatConfig,
  size: (typeof SIZE_CONFIGS)[keyof typeof SIZE_CONFIGS],
): string {
  const emoteScale = Number.isFinite(config.emoteScale)
    ? Math.min(Math.max(config.emoteScale, 0.25), 3)
    : 1;
  const dimension = Math.round(size.emoteMaxHeight * emoteScale);

  return ` width="${dimension}" height="${dimension}" style="width: ${dimension}px; height: ${dimension}px;"`;
}

function renderMentionHtml(
  token: string,
  service: ChatPresentationService,
): string | null {
  const mentionStyle = mentionStyleService.resolveMention(token, service);
  if (!mentionStyle) return null;

  const escapedText = escapeHtml(mentionStyle.text);
  const escapedSuffix = escapeHtml(mentionStyle.suffix);

  switch (mentionStyle.kind) {
    case "global-paint":
      return `<span class="mention chatyx-seventv-paint" data-seventv-paint-id="${escapeAttr(mentionStyle.paintId)}">${escapedText}</span>${escapedSuffix}`;
    case "inline-paint": {
      const safeCss = mentionStyle.css.replace(/"/g, "'");
      return `<span class="mention" style="${safeCss}">${escapedText}</span>${escapedSuffix}`;
    }
    case "color": {
      const safeColor =
        /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]{1,30})$/.test(
          mentionStyle.color,
        )
          ? mentionStyle.color
          : "#ffffff";
      return `<span class="mention" style="color: ${safeColor};">${escapedText}</span>${escapedSuffix}`;
    }
  }
}

function getEmoteScale(config: ChatConfig): number {
  return Number.isFinite(config.emoteScale)
    ? Math.min(Math.max(config.emoteScale, 0.25), 3)
    : 1;
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
  const emoteScale = getEmoteScale(config);

  type Replacement =
    | { kind: "html"; html: string; isOverlayTarget: boolean }
    | { kind: "zw"; overlayHtml: string; fallbackHtml: string };

  const replacements: Record<string, Replacement> = {};

  if (message.emotes && typeof message.emotes === "object") {
    const codePointToCodeUnit = (
      text: string,
      codePointIndex: number,
    ): number => {
      let currentCodePoint = 0;
      for (let i = 0; i < text.length; i++) {
        if (currentCodePoint === codePointIndex) return i;
        const charCode = text.charCodeAt(i);
        if (charCode >= 0xd800 && charCode <= 0xdbff) i += 1;
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
            html: `<span class="emote-container"><img class="emote" src="${networkClient.resolveHttpUrl(`https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(emoteId)}/default/dark/3.0`, "rte")}" alt="" title="${escapeAttr(emoteCode)}"${twitchEmoteImageAttrs(config, size)} /></span>`,
            isOverlayTarget: true,
          };
        });
      },
    );
  }

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
          replacements[cheer.text] = {
            kind: "html",
            html: index === 0 ? cheerHtml : "",
            isOverlayTarget: false,
          };
        });
      }
    }
  }

  const tokenSnapshot =
    message.tokenSnapshot?.source === rawMessage
      ? message.tokenSnapshot
      : createMessageTokenSnapshot(rawMessage);

  type SegmentKind = "ws" | "text" | "target" | "other";
  type Segment = {
    kind: SegmentKind;
    html: string;
    isZeroWidth?: boolean;
    zeroWidthOverlayHtml?: string;
    effects?: EmoteModifierEffect[];
    accessibleText?: string;
  };
  const segments: Segment[] = [];

  const createEmoteReplacement = (
    cleanText: string,
    emote: any,
  ): Replacement | null => {
    if (!emote || !cleanText) return null;

    const url = sanitizeImageUrl(String(emote.url || ""));
    if (!url) return null;

    const sourceClass = emote.source === "youtube" ? " youtube-emote" : "";
    const attrs = emoteImageAttrs(emote.width, emote.height, config, size);

    if (emote.zero_width) {
      return {
        kind: "zw",
        overlayHtml: `<img class="emote zerowidth${sourceClass}" src="${url}" alt="" title="${escapeAttr(cleanText)}"${attrs} />`,
        fallbackHtml: `<span class="emote-container"><img class="emote${sourceClass}" src="${url}" alt="" title="${escapeAttr(cleanText)}"${attrs} /></span>`,
      };
    }

    return {
      kind: "html",
      html: `<span class="emote-container"><img class="emote${sourceClass}" src="${url}" alt="" title="${escapeAttr(cleanText)}"${attrs} /></span>`,
      isOverlayTarget: true,
    };
  };

  const pushReplacement = (
    activeReplacement: Replacement,
    effects: EmoteModifierEffect[] = [],
    accessibleText?: string,
  ) => {
    if (activeReplacement.kind === "zw") {
      if (!attachZeroWidthOverlay(segments, activeReplacement.overlayHtml)) {
        segments.push({
          kind: "target",
          html: activeReplacement.fallbackHtml,
          isZeroWidth: true,
          zeroWidthOverlayHtml: activeReplacement.overlayHtml,
          effects,
          accessibleText,
        });
      }
      return;
    }

    segments.push({
      kind: activeReplacement.isOverlayTarget ? "target" : "other",
      html: activeReplacement.html,
      effects,
      accessibleText,
    });
  };

  const applyModifiers = (
    activeReplacement: Replacement,
    effects: EmoteModifierEffect[],
    accessibleText: string | undefined,
  ): Replacement => {
    if (effects.length === 0) return activeReplacement;
    if (activeReplacement.kind === "zw") {
      return {
        kind: "zw",
        overlayHtml: wrapZeroWidthModifiers(
          activeReplacement.overlayHtml,
          effects,
          accessibleText,
        ),
        fallbackHtml: wrapEmoteModifiers(
          activeReplacement.fallbackHtml,
          effects,
          accessibleText,
        ),
      };
    }

    return {
      ...activeReplacement,
      html: wrapEmoteModifiers(
        activeReplacement.html,
        effects,
        accessibleText,
      ),
    };
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
      .filter(
        (token) =>
          token.startsWith("yt_emoji_") && withPlaceholders.includes(token),
      )
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
      if (replacement) pushReplacement(replacement);
      else pushTextSegment(matchToken, emojis);

      index = matchIndex + matchToken.length;
    }

    return true;
  };

  const tokenStates = tokenSnapshot.tokens.map((token) => {
    if (token.isWhitespace) return { token };

    const { withPlaceholders, emojis, cleanText } = token;
    const isPlainLookupToken = withPlaceholders === cleanText;
    const replacement = isPlainLookupToken
      ? replacements[cleanText]
      : undefined;
    const emote = isPlainLookupToken
      ? message.emoteSnapshot?.get(cleanText) ||
        service.getEmote(
          cleanText,
          message.username,
          message.sourceChannelId,
        )
      : null;
    const activeReplacement =
      replacement || createEmoteReplacement(cleanText, emote);
    const isEmojiOnlyToken = cleanText.length === 0 && emojis.length > 0;
    const modifier = isPlainLookupToken
      ? getEmoteModifier(cleanText)
      : undefined;

    return { token, activeReplacement, isEmojiOnlyToken, modifier };
  });

  const modifierResolution = resolveEmoteModifiers(
    tokenStates.map((state) => ({
      raw: state.token.raw,
      isWhitespace: state.token.isWhitespace,
      isTarget:
        !state.modifier &&
        Boolean(state.activeReplacement || state.isEmojiOnlyToken),
      modifier: state.modifier,
    })),
  );

  for (let index = 0; index < tokenStates.length; index += 1) {
    const state = tokenStates[index];
    const token = state.token;
    const modifiers = modifierResolution[index];
    if (modifiers.consumed) continue;

    if (token.isWhitespace) {
      segments.push({ kind: "ws", html: token.raw });
      continue;
    }

    const { withPlaceholders, emojis } = token;
    if (state.activeReplacement) {
      pushReplacement(
        applyModifiers(
          state.activeReplacement,
          modifiers.effects,
          modifiers.accessibleText,
        ),
        modifiers.effects,
        modifiers.accessibleText,
      );
      continue;
    }

    if (state.isEmojiOnlyToken && modifiers.effects.length > 0) {
      const emojiHtml = parseGoogleEmoji(
        escapeHtml(restoreEmojis(withPlaceholders, emojis)),
        size.emojiHeight,
      );
      segments.push({
        kind: "target",
        html: wrapEmoteModifiers(
          emojiHtml,
          modifiers.effects,
          modifiers.accessibleText,
        ),
      });
      continue;
    }

    if (pushInlineSnapshotTokens(withPlaceholders, emojis)) continue;
    pushTextSegment(withPlaceholders, emojis);
  }

  const element = document.createElement("span");
  element.innerHTML = segments.map((segment) => segment.html).join("");

  bindWideEmoteSizes(
    element,
    Number.parseFloat(size.emoteMaxWidth) * emoteScale,
    size.emoteMaxHeight * emoteScale,
  );

  if (message.isGigantifiedEmote) {
    const line = buildGigantifiedLine(element);
    if (line) element.replaceChildren(line);
  }

  return element;
}
