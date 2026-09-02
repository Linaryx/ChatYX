import type { EmoteModifierEffect } from "./types";
import { insertZeroWidthOverlays, wrapEmoteModifierContent } from "./html";

export type ZeroWidthSegment = {
  kind: string;
  html: string;
  isZeroWidth?: boolean;
  zeroWidthOverlayHtml?: string;
  effects?: EmoteModifierEffect[];
  accessibleText?: string;
};

/**
 * Attach a zero-width overlay to the nearest preceding non-zero-width target.
 * Walks back across whitespace and failed ZW fallbacks, collecting pending overlays.
 * Mutates `segments` (truncates after the base) and returns whether attach succeeded.
 */
export function attachZeroWidthOverlay(
  segments: ZeroWidthSegment[],
  overlayHtml: string,
): boolean {
  let index = segments.length - 1;
  const pendingOverlays: string[] = [];

  while (index >= 0) {
    const segment = segments[index];
    if (segment.kind === "ws") {
      index -= 1;
      continue;
    }
    if (segment.isZeroWidth && segment.zeroWidthOverlayHtml) {
      pendingOverlays.unshift(segment.zeroWidthOverlayHtml);
      index -= 1;
      continue;
    }
    break;
  }

  if (index < 0) return false;
  const target = segments[index];
  if (target.kind !== "target" || target.isZeroWidth) return false;

  segments.length = index + 1;

  const inheritedEffects = target.effects;
  const overlays = [...pendingOverlays, overlayHtml].map((overlay) => {
    if (!inheritedEffects?.length) return overlay;

    const wrapped = wrapEmoteModifierContent(
      overlay,
      inheritedEffects,
      target.accessibleText,
    );
    return wrapped.replace(
      '<span class="emote-container emote-modified ',
      '<span class="emote-container emote-zero-width-overlay emote-modified ',
    );
  });

  const nextHtml = insertZeroWidthOverlays(target.html, overlays);
  if (nextHtml === null) return false;

  target.html = nextHtml;
  return true;
}
