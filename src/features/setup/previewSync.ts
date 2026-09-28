/**
 * The setup page's side of the preview protocol.
 *
 * The embedded overlay is an iframe that receives its configuration over
 * `postMessage` and its navigation through a direct `src` assignment. Both
 * mechanics are here rather than in the route: the route keeps the reactive
 * effects, this module keeps the iframe protocol, the debounce and the session
 * bookkeeping.
 */
import type { ChatConfig } from "~/config/chatUrlParams";
import { createChatPreviewConfigMessage } from "~/services/chat/preview/configMessage";

/**
 * Long enough that typing in a text field does not reload the overlay on every
 * keystroke, short enough that the preview still feels immediate.
 */
const PREVIEW_NAVIGATION_DEBOUNCE_MS = 180;

export type PreviewSynchronizerOptions = {
  getIframe: () => HTMLIFrameElement | undefined;
  /**
   * Used when the iframe has not been created yet — the first URL has to arrive
   * through the signal so the element mounts with it.
   */
  setFallbackUrl: (url: string) => void;
  debounceMs?: number;
};

export type PreviewSynchronizer = {
  /** Pushes a config to the overlay without reloading it. */
  postConfig: (config: ChatConfig) => void;
  /**
   * Navigates only when `sessionKey` differs from the last navigation, and
   * debounces the swap. The URL is built lazily, so an unchanged session costs
   * nothing. Returns whether a navigation was scheduled.
   */
  scheduleNavigation: (sessionKey: string, buildUrl: () => string) => boolean;
  /** Cancels a pending navigation. */
  dispose: () => void;
};

export function createPreviewSynchronizer(
  options: PreviewSynchronizerOptions,
): PreviewSynchronizer {
  let activeSessionKey = "";
  let navigationTimer: number | undefined;

  const navigate = (url: string) => {
    const iframe = options.getIframe();
    if (iframe) {
      // Assigning through the element swaps the document without the
      // about:blank flash a signal-driven src update would produce.
      iframe.src = url;
    } else {
      options.setFallbackUrl(url);
    }
  };

  const postConfig = (config: ChatConfig) => {
    const target = options.getIframe()?.contentWindow;
    if (!target) return;
    target.postMessage(
      createChatPreviewConfigMessage(config),
      window.location.origin,
    );
  };

  const scheduleNavigation = (
    sessionKey: string,
    buildUrl: () => string,
  ): boolean => {
    if (sessionKey === activeSessionKey) return false;
    activeSessionKey = sessionKey;

    if (navigationTimer !== undefined) {
      window.clearTimeout(navigationTimer);
    }
    navigationTimer = window.setTimeout(() => {
      navigationTimer = undefined;
      navigate(buildUrl());
    }, options.debounceMs ?? PREVIEW_NAVIGATION_DEBOUNCE_MS);

    return true;
  };

  const dispose = () => {
    if (navigationTimer !== undefined) {
      window.clearTimeout(navigationTimer);
      navigationTimer = undefined;
    }
  };

  return { postConfig, scheduleNavigation, dispose };
}
