import type { ChatConfig } from "~/utils/chat";

// Size presets (v2 parity)
export const SIZE_CONFIGS = {
  1: {
    fontSize: "20px",
    lineHeight: "30px",
    badgeSize: 16,
    badgeMarginRight: "2px",
    badgeMarginBottom: "3px",
    badgeLastMarginRight: "3px",
    emoteMaxHeight: 25,
    emoteMaxWidth: "75px",
    emoteMarginRight: "-3px",
    cheerEmoteMaxHeight: 25,
    cheerEmoteMarginBottom: "-6px",
    upscaleHeight: 25,
    gigantifiedEmoteWidth: "180px",
    emojiHeight: 22,
    colonMarginRight: "8px",
    cheerBitsFontWeight: 700,
    cheerBitsMarginLeft: "2px",
    cheerBitsMarginRight: "4px",
  },
  2: {
    fontSize: "34px",
    lineHeight: "55px",
    badgeSize: 28,
    badgeMarginRight: "4px",
    badgeMarginBottom: "6px",
    badgeLastMarginRight: "6px",
    emoteMaxHeight: 42,
    emoteMaxWidth: "128px",
    emoteMarginRight: "-6px",
    cheerEmoteMaxHeight: 42,
    cheerEmoteMarginBottom: "-10px",
    upscaleHeight: 42,
    gigantifiedEmoteWidth: "240px",
    emojiHeight: 39,
    colonMarginRight: "14px",
    cheerBitsFontWeight: 600,
    cheerBitsMarginLeft: "4px",
    cheerBitsMarginRight: "7px",
  },
  3: {
    fontSize: "48px",
    lineHeight: "75px",
    badgeSize: 40,
    badgeMarginRight: "5px",
    badgeMarginBottom: "8px",
    badgeLastMarginRight: "8px",
    emoteMaxHeight: 60,
    emoteMaxWidth: "180px",
    emoteMarginRight: "-8px",
    cheerEmoteMaxHeight: 60,
    cheerEmoteMarginBottom: "-15px",
    upscaleHeight: 60,
    gigantifiedEmoteWidth: "300px",
    emojiHeight: 55,
    colonMarginRight: "20px",
    cheerBitsFontWeight: 500,
    cheerBitsMarginLeft: "5px",
    cheerBitsMarginRight: "10px",
  },
} as const;

export const generateSizeStyles = (size: 1 | 2 | 3) => {
  const config = SIZE_CONFIGS[size];
  return `
#chat_container {
    font-size: ${config.fontSize};
}

.chat_line {
    line-height: ${config.lineHeight};
}

.badge {
    width: ${config.badgeSize}px;
    height: ${config.badgeSize}px;
    margin-right: ${config.badgeMarginRight};
    margin-bottom: ${config.badgeMarginBottom};
}

.badge:last-of-type {
    margin-right: ${config.badgeLastMarginRight};
}

.colon {
    margin-right: ${config.colonMarginRight};
}

.cheer_bits {
    font-weight: ${config.cheerBitsFontWeight};
    margin-left: ${config.cheerBitsMarginLeft};
    margin-right: ${config.cheerBitsMarginRight};
}

.cheer_emote {
    max-height: ${config.cheerEmoteMaxHeight}px;
    margin-bottom: ${config.cheerEmoteMarginBottom};
}

.emote {
    max-width: ${config.emoteMaxWidth};
    max-height: ${config.emoteMaxHeight}px;
}

.emote-container {
    margin-right: ${config.emoteMarginRight};
}

.upscale {
    height: ${config.upscaleHeight}px;
}

.gigantified-emote {
    --gigantified-emote-width: ${config.gigantifiedEmoteWidth};
}

.emoji {
    height: ${config.emojiHeight}px;
}
`;
};

export const generateShadowStyles = (shadow: 1 | 2 | 3) => {
  const shadows = {
    1: "drop-shadow(2px 2px 0.2rem black)",
    2: "drop-shadow(2px 2px 0.35rem black)",
    3: "drop-shadow(2px 2px 0.5rem black)",
  };
  return `
#chat_container {
    filter: ${shadows[shadow]};
}
`;
};

export const generateStrokeStyles = (stroke: 1 | 2 | 3 | 4) => {
  const strokes = {
    1: "1px",
    2: "2px",
    3: "3px",
    4: "4px",
  };
  return `
#chat_container {
    -webkit-text-stroke: ${strokes[stroke]} black;
    paint-order: stroke fill;
}
`;
};

export const generateVariantStyles = (config: ChatConfig) => {
  let styles = "";
  const size =
    SIZE_CONFIGS[config.size as keyof typeof SIZE_CONFIGS] || SIZE_CONFIGS[2];
  const emoteScale = Number.isFinite(config.emoteScale)
    ? Math.min(Math.max(config.emoteScale, 0.25), 3)
    : 1;

  if (config.hideNames) {
    styles += `
.user_info {
    display: none;
}
`;
  }

  if (config.nlAfterName) {
    styles += `
.message::before {
    content: '\\A';
    white-space: pre;
}
`;
  }

  if (emoteScale !== 1) {
    styles += `
.emote {
    max-width: ${Number.parseFloat(size.emoteMaxWidth) * emoteScale}px;
    max-height: ${size.emoteMaxHeight * emoteScale}px;
}

.emoji {
    width: ${size.emojiHeight * emoteScale}px !important;
    height: ${size.emojiHeight * emoteScale}px !important;
}
`;
  }

  return styles;
};

export const FONTS = [
  "'Baloo Tammudu 2', cursive",
  "'Segoe UI', sans-serif",
  "'Roboto', sans-serif",
  "'Lato', sans-serif",
  "'Noto Sans JP', sans-serif",
  "'Source Code Pro', monospace",
  "'Impact', sans-serif",
  "'Comfortaa', cursive",
  "'Dancing Script', cursive",
  "'Indie Flower', cursive",
  "'Open Sans', sans-serif",
  "'AlsinaUltrajada', sans-serif",
] as const;

export const getFontFamily = (config: ChatConfig): string => {
  if (config.fontCustom) return config.fontCustom;
  return FONTS[config.font - 1] || FONTS[10];
};
