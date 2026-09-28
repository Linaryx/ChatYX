import type { AnimationOptions } from "~/config/chatAnimation";

const ANIMATION_STYLE_ID = "chat-animations";

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
        @media (prefers-reduced-motion: reduce) {
          .message-enter {
            animation: none;
          }
        }
      `;

    case "flow":
      return `
        @keyframes chatFlowEnter {
          from {
            translate: 0 var(--chat-flow-entry-shift, 18px);
          }
          to {
            translate: 0 0;
          }
        }
        #chat_container.layout-vertical.layout-normal {
          flex-direction: column-reverse;
        }
        #chat_container.layout-vertical.layout-normal .chat_line.message-enter {
          animation: chatFlowEnter var(--chat-message-enter-duration, ${duration}ms) cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: translate;
        }
        @media (prefers-reduced-motion: reduce) {
          #chat_container.layout-vertical.layout-normal .chat_line.message-enter {
            animation: none;
          }
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
 * Writes the animation styles into the document, reusing the existing element
 * when there is one.
 *
 * Reuse is what keeps the element identifiable: callers that appended
 * unconditionally left duplicate elements behind, and a teardown that removes
 * "the" element by id can only ever remove one of them.
 */
export function injectAnimationStyles(
  options: AnimationOptions,
): HTMLStyleElement {
  const existing = document.getElementById(ANIMATION_STYLE_ID);
  if (existing?.tagName === "STYLE") {
    existing.textContent = getAnimationStyles(options);
    return existing as HTMLStyleElement;
  }

  const styleEl = document.createElement("style");
  styleEl.id = ANIMATION_STYLE_ID;
  styleEl.textContent = getAnimationStyles(options);
  document.head.appendChild(styleEl);
  return styleEl;
}

/**
 * Update existing animation styles
 */
export function updateAnimationStyles(options: AnimationOptions): void {
  injectAnimationStyles(options);
}
