import type { EmoteModifierEffect, EmoteSizeBox } from "./types";
import { buildModifierStyleVars } from "./layout";

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getRenderedImageSize(
  html: string,
): EmoteSizeBox | undefined {
  const styleWidth = html.match(/style="[^"]*width:\s*([\d.]+)px/);
  const styleHeight = html.match(/style="[^"]*height:\s*([\d.]+)px/);
  const attributeWidth = html.match(/\swidth="([\d.]+)"/);
  const attributeHeight = html.match(/\sheight="([\d.]+)"/);
  const width = Number(styleWidth?.[1] || attributeWidth?.[1]);
  const height = Number(styleHeight?.[1] || attributeHeight?.[1]);

  return Number.isFinite(width) &&
    width > 0 &&
    Number.isFinite(height) &&
    height > 0
    ? { width, height }
    : undefined;
}

const CONTAINER_OPEN =
  /<span class="(?:emote|emoji)-container(?:\s[^"]*)?"[^>]*>/;

function modifierAttributes(
  html: string,
  effects: EmoteModifierEffect[],
  accessibleText?: string,
): string {
  const classes = effects.map((effect) => `emote-modifier-${effect}`).join(" ");
  const needsLayoutSize = effects.includes("wide") || effects.some(
    (effect) => effect === "rotate-left" || effect === "rotate-right",
  );
  const imageSize = needsLayoutSize ? getRenderedImageSize(html) : undefined;
  const style = ` style="${buildModifierStyleVars(effects, imageSize).join("; ")};"`;
  const label = accessibleText
    ? ` aria-label="${escapeAttr(accessibleText)}"`
    : "";
  return `class="emote-container emote-modified ${classes}"${label}${style}`;
}

/** Wrap arbitrary overlay content, preserving any modifier wrappers it already has. */
export function wrapEmoteModifierContent(
  html: string,
  effects: EmoteModifierEffect[],
  accessibleText?: string,
): string {
  if (effects.length === 0) return html;
  return `<span ${modifierAttributes(html, effects, accessibleText)}><span class="emote-transform-layer"><span class="emote-filter-layer"><span class="emote-animation-layer">${html}</span></span></span></span>`;
}

function wrapSingleContainer(
  html: string,
  effects: EmoteModifierEffect[],
  accessibleText?: string,
): string {
  const opening = `<span ${modifierAttributes(html, effects, accessibleText)}>`;
  return html
    .replace(CONTAINER_OPEN, opening)
    .replace(/<\/span>$/, "</span></span></span></span>")
    .replace(
      /(<img\b[^>]*\/?>)/,
      '<span class="emote-transform-layer"><span class="emote-filter-layer"><span class="emote-animation-layer">$1',
    );
}

/** Wrap a normal emote/emoji container with modifier layers. */
export function wrapEmoteModifiers(
  html: string,
  effects: EmoteModifierEffect[],
  accessibleText?: string,
): string {
  if (effects.length === 0) return html;

  const openingPattern = new RegExp(CONTAINER_OPEN.source, "g");
  let result = "";
  let cursor = 0;

  for (let match = openingPattern.exec(html); match; match = openingPattern.exec(html)) {
    if (match.index < cursor) continue;
    const closeIndex = findContainerCloseIndex(html, match.index);
    if (closeIndex === -1) return html;
    const endIndex = closeIndex + "</span>".length;
    result += html.slice(cursor, match.index);
    result += wrapSingleContainer(
      html.slice(match.index, endIndex),
      effects,
      accessibleText,
    );
    cursor = endIndex;
    openingPattern.lastIndex = endIndex;
  }

  return cursor === 0 ? html : result + html.slice(cursor);
}

/** Wrap a bare zero-width <img> (or other overlay markup) with the same layers. */
export function wrapZeroWidthModifiers(
  imageHtml: string,
  effects: EmoteModifierEffect[],
  accessibleText?: string,
): string {
  if (effects.length === 0) return imageHtml;
  return wrapEmoteModifiers(
    `<span class="emote-container">${imageHtml}</span>`,
    effects,
    accessibleText,
  );
}

function findContainerCloseIndex(html: string, openIndex: number): number {
  let depth = 0;
  const spanTag = /<span\b[^>]*>|<\/span>/g;
  spanTag.lastIndex = openIndex;

  for (let match = spanTag.exec(html); match; match = spanTag.exec(html)) {
    if (match[0] === "</span>") {
      depth -= 1;
      if (depth === 0) return match.index;
    } else {
      depth += 1;
    }
  }

  return -1;
}

function markZwGroup(opening: string): string {
  if (opening.includes("data-zw-group")) return opening;
  return opening.replace(/>$/, ' data-zw-group="true">');
}

/**
 * Insert zero-width overlays inside the last emote/emoji container of `html`.
 * Returns null if no suitable container is found.
 */
export function insertZeroWidthOverlays(
  html: string,
  overlays: string[],
): string | null {
  if (overlays.length === 0) return html;

  const containerMatches = Array.from(
    html.matchAll(/<span class="(?:emote|emoji)-container[^"]*"[^>]*>/g),
  );
  const containerMatch = containerMatches.at(-1);
  if (!containerMatch || containerMatch.index === undefined) return null;

  const closeIndex = findContainerCloseIndex(html, containerMatch.index);
  if (closeIndex === -1) return null;

  const markedOpening = markZwGroup(containerMatch[0]);
  return (
    html.slice(0, containerMatch.index) +
    markedOpening +
    html.slice(
      containerMatch.index + containerMatch[0].length,
      closeIndex,
    ) +
    overlays.join("") +
    html.slice(closeIndex)
  );
}
