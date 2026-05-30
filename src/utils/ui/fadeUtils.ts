// Message fade utilities

export interface FadeOptions {
  enabled: boolean;
  timeout: number; // milliseconds
  fadeOutDuration: number; // milliseconds
}

export const DEFAULT_FADE_OPTIONS: FadeOptions = {
  enabled: false,
  timeout: 30000, // 30 seconds
  fadeOutDuration: 1000 // 1 second
};

/**
 * Schedule message to fade out after timeout
 */
export function scheduleFadeOut(
  element: HTMLElement,
  options: FadeOptions,
  onComplete?: () => void
): number {
  if (!options.enabled || options.timeout === 0) {
    return 0;
  }

  const timeoutId = window.setTimeout(() => {
    fadeOutElement(element, options.fadeOutDuration, onComplete);
  }, options.timeout);

  return timeoutId;
}

/**
 * Fade out element over duration
 */
export function fadeOutElement(
  element: HTMLElement,
  duration: number,
  onComplete?: () => void
): void {
  element.style.transition = `opacity ${duration}ms ease-out`;
  element.style.opacity = '0';

  setTimeout(() => {
    if (onComplete) {
      onComplete();
    } else {
      element.remove();
    }
  }, duration);
}

/**
 * Cancel scheduled fade
 */
export function cancelFade(timeoutId: number): void {
  if (timeoutId) {
    window.clearTimeout(timeoutId);
  }
}

/**
 * Generate CSS for fade animations
 */
export function getFadeStyles(options: FadeOptions): string {
  if (!options.enabled) return '';

  return `
    .message-fade-out {
      transition: opacity ${options.fadeOutDuration}ms ease-out;
      opacity: 0;
    }
  `;
}

/**
 * Inject fade styles into document
 */
export function injectFadeStyles(options: FadeOptions): HTMLStyleElement {
  const styleEl = document.createElement('style');
  styleEl.id = 'chat-fade';
  styleEl.textContent = getFadeStyles(options);
  document.head.appendChild(styleEl);
  return styleEl;
}

/**
 * Update existing fade styles
 */
export function updateFadeStyles(options: FadeOptions): void {
  let styleEl = document.getElementById('chat-fade') as HTMLStyleElement;
  
  if (!styleEl) {
    injectFadeStyles(options);
    return;
  }

  styleEl.textContent = getFadeStyles(options);
}

/**
 * Message fade manager class
 */
export class MessageFadeManager {
  private fadeTimers: Map<HTMLElement, { start: number; complete?: number }> = new Map();
  private options: FadeOptions;

  constructor(options: FadeOptions = DEFAULT_FADE_OPTIONS) {
    this.options = options;
  }

  /**
   * Schedule fade for a message element
   */
  scheduleMessage(element: HTMLElement, onRemove?: () => void): void {
    if (!this.options.enabled) return;

    this.cancelMessage(element);

    const start = window.setTimeout(() => {
      if (!element.isConnected) {
        this.fadeTimers.delete(element);
        return;
      }

      element.style.transition = `opacity ${this.options.fadeOutDuration}ms ease-out`;
      element.style.opacity = "0";

      const complete = window.setTimeout(() => {
        this.fadeTimers.delete(element);
        if (onRemove) {
          onRemove();
        } else {
          element.remove();
        }
      }, this.options.fadeOutDuration);

      this.fadeTimers.set(element, { start, complete });
    }, this.options.timeout);

    this.fadeTimers.set(element, { start });
  }

  /**
   * Cancel fade for a message element
   */
  cancelMessage(element: HTMLElement): void {
    const timers = this.fadeTimers.get(element);
    if (timers) {
      window.clearTimeout(timers.start);
      if (timers.complete !== undefined) {
        window.clearTimeout(timers.complete);
      }
    }
    this.fadeTimers.delete(element);
  }

  /**
   * Clear all scheduled fades
   */
  clear(): void {
    this.fadeTimers.forEach((timers) => {
      window.clearTimeout(timers.start);
      if (timers.complete !== undefined) {
        window.clearTimeout(timers.complete);
      }
    });
    this.fadeTimers.clear();
  }

  /**
   * Update fade options
   */
  updateOptions(options: Partial<FadeOptions>): void {
    this.options = { ...this.options, ...options };
    updateFadeStyles(this.options);
  }

  /**
   * Get current options
   */
  getOptions(): FadeOptions {
    return { ...this.options };
  }
}
