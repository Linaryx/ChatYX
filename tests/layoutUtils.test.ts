import { describe, expect, test } from "bun:test";
import {
  LayoutManager,
  getLayoutStyles,
  getScrollPosition,
  isScrolledToEnd,
  scrollToLatest,
} from "../src/services/chat/runtime/layoutManager";

function createContainer(
  values: Partial<HTMLElement> = {},
): HTMLElement & { lastScroll?: ScrollToOptions } {
  const container = {
    clientHeight: 300,
    clientWidth: 400,
    scrollHeight: 900,
    scrollWidth: 1200,
    scrollLeft: 0,
    scrollTop: 0,
    scrollTo(options: ScrollToOptions) {
      this.lastScroll = options;
    },
    ...values,
  };

  return container as unknown as HTMLElement & {
    lastScroll?: ScrollToOptions;
  };
}

describe("chat layout scrolling", () => {
  test("keeps a stable flex direction when message order is reversed", () => {
    const normal = getLayoutStyles({ horizontal: false, reverse: false });
    const reverse = getLayoutStyles({ horizontal: false, reverse: true });

    expect(normal).toContain("flex-direction: column");
    expect(reverse).toContain("flex-direction: column");
    expect(reverse).not.toContain("column-reverse");
  });

  test("scrolls normal vertical chat to its latest message", () => {
    const container = createContainer();

    expect(getScrollPosition(container, { horizontal: false, reverse: false })).toBe(
      600,
    );
    scrollToLatest(container, { horizontal: false, reverse: false });
    expect(container.lastScroll).toEqual({ top: 600, behavior: "auto" });
  });

  test("keeps reversed chat at the start", () => {
    const container = createContainer({ scrollTop: 12 });

    expect(getScrollPosition(container, { horizontal: false, reverse: true })).toBe(
      0,
    );
    expect(
      isScrolledToEnd(container, { horizontal: false, reverse: true }, 10),
    ).toBe(false);

    scrollToLatest(container, { horizontal: false, reverse: true });
    expect(container.lastScroll).toEqual({ top: 0, behavior: "auto" });
  });

  test("uses horizontal scroll coordinates", () => {
    const container = createContainer({ scrollLeft: 795 });
    const options = { horizontal: true, reverse: false };

    expect(getScrollPosition(container, options)).toBe(800);
    expect(isScrolledToEnd(container, options, 10)).toBe(true);
  });

  test("supports intentional smooth scrolling", () => {
    const container = createContainer();

    scrollToLatest(
      container,
      { horizontal: false, reverse: false },
      "smooth",
    );
    expect(container.lastScroll).toEqual({ top: 600, behavior: "smooth" });
  });
});

describe("layout manager cleanup", () => {
  test("cancels the smooth follow it started", () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    const previousDocument = (globalThis as { document?: unknown }).document;
    const frames: FrameRequestCallback[] = [];
    const head: Array<{ remove: () => void }> = [];
    let cancelled: number | undefined;

    (globalThis as unknown as { window: unknown }).window = {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        frames.push(callback);
        return 42;
      },
      cancelAnimationFrame: (id: number) => {
        cancelled = id;
      },
    };
    (globalThis as unknown as { document: unknown }).document = {
      createElement: () => {
        const element = {
          remove: () => {
            const index = head.indexOf(element);
            if (index >= 0) head.splice(index, 1);
          },
        };
        head.push(element);
        return element;
      },
      head: { appendChild: () => {} },
      getElementById: () => null,
      querySelectorAll: () => head,
    };

    try {
      const container = createContainer({
        classList: { remove: () => {}, add: () => {} },
      } as unknown as Partial<HTMLElement>);
      const manager = new LayoutManager(container, {
        horizontal: false,
        reverse: false,
      });

      manager.scrollIfNeeded("smooth", true);
      expect(frames).toHaveLength(1);
      expect(head).toHaveLength(1);

      manager.cleanup();

      // The stylesheet and the pending animation frame both belong to the
      // manager, so teardown must release both.
      expect(cancelled).toBe(42);
      expect(head).toHaveLength(0);
    } finally {
      if (previousWindow === undefined) {
        Reflect.deleteProperty(globalThis, "window");
      } else {
        (globalThis as unknown as { window: unknown }).window = previousWindow;
      }
      if (previousDocument === undefined) {
        Reflect.deleteProperty(globalThis, "document");
      } else {
        (globalThis as unknown as { document: unknown }).document = previousDocument;
      }
    }
  });
});
