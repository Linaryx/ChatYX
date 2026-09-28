import type { ChatConfig } from "~/config/chatUrlParams";
import {
  getOverlayStyleVariables,
  OVERLAY_ATTRIBUTES,
  OVERLAY_STYLE_PROPERTIES,
} from "~/styles/chatStyles";
import {
  getMessageEntryAnimationDuration,
  hasMessageEntryAnimation,
  updateAnimationStyles,
} from "~/utils/ui/animationUtils";

function setRootAttribute(name: string, enabled: boolean) {
  const root = document.documentElement;
  if (enabled) root.setAttribute(name, "");
  else root.removeAttribute(name);
}

/**
 * Publishes the overlay's presentation onto the document root.
 *
 * `chat.css` owns every rule; this writes only the values it needs, as custom
 * properties, and flips the boolean variants as attributes. Nothing is generated
 * and nothing is appended to `document.head`, so the teardown has exactly one
 * thing to undo: what this wrote.
 */
export function applyOverlayStyles(config: ChatConfig): void {
  clearOverlayStyles();

  const root = document.documentElement;
  for (const [name, value] of Object.entries(getOverlayStyleVariables(config))) {
    root.style.setProperty(name, value);
  }

  setRootAttribute(OVERLAY_ATTRIBUTES.hideNames, config.hideNames);
  setRootAttribute(OVERLAY_ATTRIBUTES.nlAfterName, config.nlAfterName);

  if (hasMessageEntryAnimation(config.animation)) {
    updateAnimationStyles({
      enabled: true,
      duration: getMessageEntryAnimationDuration(config.animation),
      easing: "ease-out",
      type: config.animation,
    });
  }
}

/** Removes every property and attribute `applyOverlayStyles` can have written. */
export function clearOverlayStyles(): void {
  const root = document.documentElement;
  for (const name of OVERLAY_STYLE_PROPERTIES) {
    root.style.removeProperty(name);
  }
  root.removeAttribute(OVERLAY_ATTRIBUTES.hideNames);
  root.removeAttribute(OVERLAY_ATTRIBUTES.nlAfterName);
}

/**
 * Lifecycle owner for the overlay's published styles. It holds no state of its
 * own — the document is the state — so it exists to give the runtime a single
 * object to create and tear down.
 */
export class OverlayStyleManager {
  apply(config: ChatConfig) {
    applyOverlayStyles(config);
  }

  cleanup() {
    clearOverlayStyles();
  }
}
