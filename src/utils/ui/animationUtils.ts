// Animation utilities for chat messages

export interface AnimationOptions {
  enabled: boolean;
  duration: number;
  easing: string;
  type: "fade" | "scale";
}

export const DEFAULT_ANIMATION_OPTIONS: AnimationOptions = {
  enabled: true,
  duration: 200,
  easing: "ease-in-out",
  type: "fade",
};

/**
 * Generate CSS animation classes based on options
 */
export function getAnimationStyles(options: AnimationOptions): string {
  if (!options.enabled) return "";

  const { duration, easing, type } = options;

  switch (type) {
    case "fade":
      return `
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(1, 0.5);
          }
          to {
            opacity: 1;
            transform: scale(1, 1);
          }
        }
        .message-enter {
          animation: fadeIn var(--chat-message-enter-duration, ${duration}ms) ${easing} both;
          transform-origin: center;
          will-change: transform, opacity;
        }
      `;

    case "scale":
      return `
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .message-enter {
          animation: scaleIn var(--chat-message-enter-duration, ${duration}ms) ${easing};
        }
      `;

    default:
      return "";
  }
}

/**
 * Apply animation class to element
 */
export function applyAnimation(
  element: HTMLElement,
  options: AnimationOptions,
): void {
  if (!options.enabled) return;

  element.classList.add("message-enter");

  // Remove animation class after animation completes
  setTimeout(() => {
    element.classList.remove("message-enter");
  }, options.duration);
}

/**
 * Create style element for animations
 */
export function injectAnimationStyles(
  options: AnimationOptions,
): HTMLStyleElement {
  const styleEl = document.createElement("style");
  styleEl.id = "chat-animations";
  styleEl.textContent = getAnimationStyles(options);
  document.head.appendChild(styleEl);
  return styleEl;
}

/**
 * Update existing animation styles
 */
export function updateAnimationStyles(options: AnimationOptions): void {
  let styleEl = document.getElementById("chat-animations") as HTMLStyleElement;

  if (!styleEl) {
    injectAnimationStyles(options);
    return;
  }

  styleEl.textContent = getAnimationStyles(options);
}
