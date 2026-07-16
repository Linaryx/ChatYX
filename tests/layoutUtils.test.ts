import { describe, expect, test } from "bun:test";
import {
  getLayoutStyles,
  getScrollPosition,
  isScrolledToEnd,
  scrollToLatest,
} from "../src/utils/ui/layoutUtils";

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
