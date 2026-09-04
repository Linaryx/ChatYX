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
  const { horizontal } = options;

  let styles = "";

  // Horizontal layout
  if (horizontal) {
    styles += `
      #chat_container {
        display: flex;
        flex-direction: row;
        align-items: flex-end;
        justify-content: flex-start;
        gap: 1rem;
        overflow-x: hidden;
        overflow-y: hidden;
        overflow-anchor: none;
      }
      #chat_container .chat_line {
        flex: 0 0 auto;
      }
    `;
  } else {
    styles += `
      #chat_container {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-start;
        overflow-y: hidden;
        overflow-x: hidden;
        overflow-anchor: none;
      }
      #chat_container .chat_line {
        flex: 0 0 auto;
      }
    `;
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
  if (options.reverse) return 0;

  if (options.horizontal) {
    return Math.max(0, container.scrollWidth - container.clientWidth);
  }

  return Math.max(0, container.scrollHeight - container.clientHeight);
}

/**
 * Scroll to latest message
 */
export function scrollToLatest(
  container: HTMLElement,
  options: LayoutOptions,
  behavior: ScrollBehavior = "auto",
): void {
  const position = getScrollPosition(container, options);

  if (options.horizontal) {
    container.scrollTo({ left: position, behavior });
  } else {
    container.scrollTo({ top: position, behavior });
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
  const current = options.horizontal ? container.scrollLeft : container.scrollTop;
  if (options.reverse) return Math.abs(current) <= threshold;

  return getScrollPosition(container, options) - current <= threshold;
}

/**
 * Layout manager class
 */
export class LayoutManager {
  private container: HTMLElement;
  private options: LayoutOptions;
  private autoScroll: boolean = true;
  private latestAtStart = false;
  private smoothScrollFrame: number | undefined;
  private smoothScrollTarget: number | undefined;
  private smoothScrollLastTime: number | undefined;

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
   * Whether the latest message sits at scroll position 0. Used by reversed
   * stacks (such as the flow column-reverse container) where the layout
   * classes stay normal but scroll math must target the start.
   */
  setLatestAtStart(value: boolean): void {
    this.latestAtStart = value;
  }

  private scrollOptions(): LayoutOptions {
    return this.latestAtStart
      ? { ...this.options, reverse: true }
      : this.options;
  }

  private currentScroll(): number {
    return this.options.horizontal
      ? this.container.scrollLeft
      : this.container.scrollTop;
  }

  private setCurrentScroll(value: number): void {
    if (this.options.horizontal) {
      this.container.scrollLeft = value;
    } else {
      this.container.scrollTop = value;
    }
  }

  private animateSmoothScroll(target: number): void {
    // Exponential follow: retargeting only moves the goal, so velocity stays
    // continuous no matter how often new messages arrive.
    this.smoothScrollTarget = target;
    if (this.smoothScrollFrame !== undefined) return;

    this.smoothScrollLastTime = performance.now();
    const step = (now: number) => {
      if (
        this.smoothScrollTarget === undefined ||
        this.smoothScrollLastTime === undefined
      ) {
        this.smoothScrollFrame = undefined;
        return;
      }

      const elapsed = Math.min(50, Math.max(0, now - this.smoothScrollLastTime));
      this.smoothScrollLastTime = now;
      const current = this.currentScroll();
      const remaining = this.smoothScrollTarget - current;
      if (Math.abs(remaining) < 0.5) {
        this.setCurrentScroll(this.smoothScrollTarget);
        this.smoothScrollFrame = undefined;
        this.smoothScrollTarget = undefined;
        this.smoothScrollLastTime = undefined;
        return;
      }

      const factor = 1 - Math.exp(-elapsed / 140);
      this.setCurrentScroll(current + remaining * factor);
      this.smoothScrollFrame = window.requestAnimationFrame(step);
    };

    this.smoothScrollFrame = window.requestAnimationFrame(step);
  }

  /**
   * Scroll to latest message if auto-scroll enabled
   */
  scrollIfNeeded(
    behavior: ScrollBehavior = "auto",
    force = false,
    settle = true,
  ): void {
    if (force) this.autoScroll = true;
    const scrollOptions = this.scrollOptions();
    const shouldScroll =
      force ||
      this.autoScroll ||
      isScrolledToEnd(this.container, scrollOptions);
    if (!shouldScroll) return;

    const scroll = () => {
      const target = getScrollPosition(this.container, scrollOptions);
      if (behavior === "smooth" && typeof window !== "undefined") {
        this.animateSmoothScroll(target);
      } else {
        scrollToLatest(this.container, scrollOptions, behavior);
      }
    };
    scroll();

    if (!settle || behavior === "smooth" || typeof window === "undefined") return;

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
    const scrolledToEnd = isScrolledToEnd(this.container, this.scrollOptions());
    this.autoScroll = scrolledToEnd;
    return scrolledToEnd;
  }
}
