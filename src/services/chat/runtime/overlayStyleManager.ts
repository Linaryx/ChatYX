import type { ChatConfig } from "~/utils/chat";
import {
  generateShadowStyles,
  generateSizeStyles,
  generateStrokeStyles,
  generateVariantStyles,
} from "~/styles/chatStyles";
import {
  DEFAULT_ANIMATION_OPTIONS,
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
      generateSizeStyles(config.size as 1 | 2 | 3),
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
        duration: DEFAULT_ANIMATION_OPTIONS.duration,
        easing: "ease-out",
        type: config.animation,
      });
    }
  }

  cleanup() {
    STYLE_ELEMENT_IDS.forEach((id) => document.getElementById(id)?.remove());
  }
}
