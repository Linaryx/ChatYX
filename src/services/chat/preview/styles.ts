import {
  generateShadowStyles,
  generateSizeStyles,
  generateStrokeStyles,
  generateVariantStyles,
} from "~/styles/chatStyles";
import { injectAnimationStyles } from "~/utils/ui/animationUtils";
import type { ChatConfig } from "~/utils/chat";

const PREVIEW_STYLE_IDS = [
  "chat-size-styles",
  "chat-shadow-styles",
  "chat-stroke-styles",
  "chat-variant-styles",
  "chat-animations",
  "chat-preview-layout-styles",
];

export function cleanupPreviewStyles() {
  PREVIEW_STYLE_IDS.forEach((id) => document.getElementById(id)?.remove());
}

export function injectPreviewStyles(config: ChatConfig) {
  cleanupPreviewStyles();

  const sizeEl = document.createElement("style");
  sizeEl.id = "chat-size-styles";
  sizeEl.innerHTML = generateSizeStyles(config.size as 1 | 2 | 3);
  document.head.appendChild(sizeEl);

  if (config.shadow) {
    const el = document.createElement("style");
    el.id = "chat-shadow-styles";
    el.innerHTML = generateShadowStyles(config.shadow as 1 | 2 | 3);
    document.head.appendChild(el);
  }

  if (config.stroke) {
    const el = document.createElement("style");
    el.id = "chat-stroke-styles";
    el.innerHTML = generateStrokeStyles(config.stroke as 1 | 2 | 3 | 4);
    document.head.appendChild(el);
  }

  const variantStyles = generateVariantStyles(config);
  if (variantStyles) {
    const el = document.createElement("style");
    el.id = "chat-variant-styles";
    el.innerHTML = variantStyles;
    document.head.appendChild(el);
  }

  if (config.animate) {
    injectAnimationStyles({ enabled: true, duration: 200, easing: "ease-out", type: "fade" });
  }

  const layoutEl = document.createElement("style");
  layoutEl.id = "chat-preview-layout-styles";
  layoutEl.innerHTML = `
#chat_container {
    overflow: visible !important;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

#chat_container::-webkit-scrollbar {
    display: none;
}
`;
  document.head.appendChild(layoutEl);
}
