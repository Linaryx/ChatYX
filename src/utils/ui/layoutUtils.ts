// Layout utilities for chat display

export interface LayoutOptions {
  horizontal: boolean;
  reverse: boolean;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  horizontal: false,
  reverse: false,
};

/**
 * Generate CSS for layout options
 */
export function getLayoutStyles(options: LayoutOptions): string {
  const { horizontal, reverse } = options;

  let styles = "";

  // Horizontal layout
  if (horizontal) {
    styles += `
      #chat_container {
        display: flex;
        flex-direction: row;
        align-items: flex-end;
        gap: 1rem;
        overflow-x: auto;
        overflow-y: hidden;
      }
      #chat_container .chat_line {
        flex-shrink: 0;
      }
    `;
  } else {
    styles += `
      #chat_container {
        display: block;
        overflow-y: auto;
        overflow-x: hidden;
      }
    `;
  }

  // Reverse order (newest first)
  if (reverse) {
    if (horizontal) {
      styles += `
        #chat_container {
          flex-direction: row-reverse;
        }
      `;
    } else {
      styles += `
        #chat_container {
          display: flex;
          flex-direction: column-reverse;
          justify-content: flex-end;
        }
      `;
    }
  }

  return styles;
}

/**
 * Inject layout styles into document
 */
export function injectLayoutStyles(options: LayoutOptions): HTMLStyleElement {
  const styleEl = document.createElement("style");
  styleEl.id = "chat-layout";
  styleEl.textContent = getLayoutStyles(options);
  document.head.appendChild(styleEl);
  return styleEl;
}

/**
 * Update existing layout styles
 */
export function updateLayoutStyles(options: LayoutOptions): void {
  let styleEl = document.getElementById("chat-layout") as HTMLStyleElement;

  if (!styleEl) {
    injectLayoutStyles(options);
    return;
  }

  styleEl.textContent = getLayoutStyles(options);
}

/**
 * Apply layout class to container
 */
export function applyLayoutClasses(
  container: HTMLElement,
  options: LayoutOptions,
): void {
  const { horizontal, reverse } = options;

  // Remove existing layout classes
  container.classList.remove(
    "layout-horizontal",
    "layout-vertical",
    "layout-reverse",
    "layout-normal",
  );

  // Apply new classes
  if (horizontal) {
    container.classList.add("layout-horizontal");
  } else {
    container.classList.add("layout-vertical");
  }

  if (reverse) {
    container.classList.add("layout-reverse");
  } else {
    container.classList.add("layout-normal");
  }
}

/**
 * Get scroll position based on layout
 */
export function getScrollPosition(
  container: HTMLElement,
  options: LayoutOptions,
): number {
  if (options.horizontal) {
    return options.reverse ? 0 : container.scrollWidth;
  } else {
    return options.reverse ? 0 : container.scrollHeight;
  }
}

/**
 * Scroll to latest message
 */
export function scrollToLatest(
  container: HTMLElement,
  options: LayoutOptions,
  smooth: boolean = true,
): void {
  const behavior = smooth ? "smooth" : "auto";

  if (options.horizontal) {
    container.scrollTo({
      left: options.reverse ? 0 : container.scrollWidth,
      behavior,
    });
  } else {
    container.scrollTo({
      top: options.reverse ? 0 : container.scrollHeight,
      behavior,
    });
  }
}

/**
 * Check if scrolled to bottom (or appropriate edge for layout)
 */
export function isScrolledToEnd(
  container: HTMLElement,
  options: LayoutOptions,
  threshold: number = 50,
): boolean {
  if (options.horizontal) {
    if (options.reverse) {
      return container.scrollLeft <= threshold;
    } else {
      return (
        container.scrollWidth - container.scrollLeft - container.clientWidth <=
        threshold
      );
    }
  } else {
    if (options.reverse) {
      return container.scrollTop <= threshold;
    } else {
      return (
        container.scrollHeight - container.scrollTop - container.clientHeight <=
        threshold
      );
    }
  }
}

/**
 * Layout manager class
 */
export class LayoutManager {
  private container: HTMLElement;
  private options: LayoutOptions;
  private autoScroll: boolean = true;

  constructor(
    container: HTMLElement,
    options: LayoutOptions = DEFAULT_LAYOUT_OPTIONS,
  ) {
    this.container = container;
    this.options = options;
    this.applyLayout();
  }

  /**
   * Apply current layout
   */
  applyLayout(): void {
    updateLayoutStyles(this.options);
    applyLayoutClasses(this.container, this.options);
  }

  /**
   * Update layout options
   */
  updateOptions(options: Partial<LayoutOptions>): void {
    this.options = { ...this.options, ...options };
    this.applyLayout();
  }

  /**
   * Get current options
   */
  getOptions(): LayoutOptions {
    return { ...this.options };
  }

  /**
   * Scroll to latest message if auto-scroll enabled
   */
  scrollIfNeeded(smooth: boolean = true): void {
    const shouldScroll =
      this.autoScroll || isScrolledToEnd(this.container, this.options);
    if (!shouldScroll) return;

    const scroll = () => scrollToLatest(this.container, this.options, smooth);
    scroll();

    if (typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      scroll();
      window.setTimeout(scroll, 60);
    });
  }

  /**
   * Enable/disable auto-scroll
   */
  setAutoScroll(enabled: boolean): void {
    this.autoScroll = enabled;
  }

  /**
   * Check if user has scrolled away
   */
  checkUserScroll(): boolean {
    const scrolledToEnd = isScrolledToEnd(this.container, this.options);
    this.autoScroll = scrolledToEnd;
    return scrolledToEnd;
  }
}
