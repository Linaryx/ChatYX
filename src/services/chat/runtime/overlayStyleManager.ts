import type { ChatConfig } from "~/config/chatUrlParams";
import {
  generateShadowStyles,
  generateSizeStyles,
  generateStrokeStyles,
  generateVariantStyles,
} from "~/styles/chatStyles";
import {
  getMessageEntryAnimationDuration,
  hasMessageEntryAnimation,
  updateAnimationStyles,
} from "~/utils/ui/animationUtils";

const STYLE_ELEMENT_IDS = [
  "chat-size-styles",
  "chat-shadow-styles",
  "chat-stroke-styles",
  "chat-variant-styles",
  "chat-animations",
];

function appendStyleElement(id: string, content: string) {
  const element = document.createElement("style");
  element.id = id;
  element.innerHTML = content;
  document.head.appendChild(element);
}

export class OverlayStyleManager {
  apply(config: ChatConfig) {
    this.cleanup();

    appendStyleElement(
      "chat-size-styles",
      generateSizeStyles(config.size as 1 | 2 | 3, config.lineHeight),
    );

    if (config.shadow) {
      appendStyleElement(
        "chat-shadow-styles",
        generateShadowStyles(config.shadow as 1 | 2 | 3),
      );
    }

    if (config.stroke) {
      appendStyleElement(
        "chat-stroke-styles",
        generateStrokeStyles(config.stroke as 1 | 2 | 3 | 4),
      );
    }

    const variantStyles = generateVariantStyles(config);
    if (variantStyles) {
      appendStyleElement("chat-variant-styles", variantStyles);
    }

    if (hasMessageEntryAnimation(config.animation)) {
      updateAnimationStyles({
        enabled: true,
        duration: getMessageEntryAnimationDuration(config.animation),
        easing: "ease-out",
        type: config.animation,
      });
    }
  }

  cleanup() {
    // Every match, not just the first: a module that appended unconditionally
    // could leave a second element with the same id, and removing one of them
    // would leave the overlay styled after teardown.
    for (const id of STYLE_ELEMENT_IDS) {
      document
        .querySelectorAll(`style[id="${id}"]`)
        .forEach((element) => element.remove());
    }
  }
}
