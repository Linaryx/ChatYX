import type { ChatConfig } from "~/config/chatUrlParams";
import { applyOverlayStyles, clearOverlayStyles } from "~/services/chat/runtime/overlayStyleManager";
import { OVERLAY_ATTRIBUTES } from "~/styles/chatStyles";

/**
 * Publishes the overlay styles for the embedded preview.
 *
 * The preview wants exactly what the live overlay wants, plus a marker that stops
 * the container from scrolling on its own, so this delegates rather than
 * duplicating the variable set.
 */
export function injectPreviewStyles(config: ChatConfig) {
  cleanupPreviewStyles();
  applyOverlayStyles(config);
  document.documentElement.setAttribute(OVERLAY_ATTRIBUTES.preview, "");
}

export function cleanupPreviewStyles() {
  clearOverlayStyles();
  document.documentElement.removeAttribute(OVERLAY_ATTRIBUTES.preview);
}
