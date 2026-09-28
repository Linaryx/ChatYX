import { beforeEach, expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG } from "../src/config/chatUrlParams";
import { createPreviewSynchronizer } from "../src/features/setup/previewSync";

/**
 * The synchronizer reads `window` lazily, inside its functions, so a minimal
 * shim is enough to exercise it outside a browser. This is deliberately not a
 * DOM implementation: only timers and `location.origin` are needed.
 */
type PendingTimer = { id: number; run: () => void; cancelled: boolean };

let pending: PendingTimer[] = [];
let nextTimerId = 1;

(globalThis as { window?: unknown }).window = {
  setTimeout: (run: () => void) => {
    const id = nextTimerId++;
    pending.push({ id, run, cancelled: false });
    return id;
  },
  clearTimeout: (id: number) => {
    const timer = pending.find((entry) => entry.id === id);
    if (timer) timer.cancelled = true;
  },
  location: { origin: "https://setup.test" },
};

/** Runs every timer that was not cancelled, as a real event loop would. */
function flushTimers() {
  const due = pending.filter((entry) => !entry.cancelled);
  pending = [];
  for (const entry of due) entry.run();
}

type FakeIframe = {
  src: string;
  contentWindow: { postMessage: (message: unknown, origin: string) => void };
};

function createIframe(): FakeIframe & { posted: Array<{ message: unknown; origin: string }> } {
  const posted: Array<{ message: unknown; origin: string }> = [];
  return {
    src: "",
    posted,
    contentWindow: {
      postMessage: (message, origin) => posted.push({ message, origin }),
    },
  };
}

beforeEach(() => {
  pending = [];
});

test("the first session key navigates and a repeat of it does not", () => {
  const iframe = createIframe();
  const sync = createPreviewSynchronizer({
    getIframe: () => iframe as unknown as HTMLIFrameElement,
    setFallbackUrl: () => {},
  });

  expect(sync.scheduleNavigation("a", () => "https://app.test/chat/?c=a")).toBe(true);
  expect(sync.scheduleNavigation("a", () => "https://app.test/chat/?c=ignored")).toBe(false);

  flushTimers();
  expect(iframe.src).toBe("https://app.test/chat/?c=a");
});

test("a burst of session keys collapses into one navigation with the last url", () => {
  const iframe = createIframe();
  const sync = createPreviewSynchronizer({
    getIframe: () => iframe as unknown as HTMLIFrameElement,
    setFallbackUrl: () => {},
  });
  const built: string[] = [];

  const build = (key: string) => () => {
    built.push(key);
    return `https://app.test/chat/?c=${key}`;
  };

  expect(sync.scheduleNavigation("a", build("a"))).toBe(true);
  expect(sync.scheduleNavigation("b", build("b"))).toBe(true);
  expect(sync.scheduleNavigation("c", build("c"))).toBe(true);

  // Nothing is built or navigated until the debounce elapses.
  expect(built).toEqual([]);
  expect(iframe.src).toBe("");

  flushTimers();
  expect(built).toEqual(["c"]);
  expect(iframe.src).toBe("https://app.test/chat/?c=c");
});

test("dispose cancels a pending navigation", () => {
  const iframe = createIframe();
  const sync = createPreviewSynchronizer({
    getIframe: () => iframe as unknown as HTMLIFrameElement,
    setFallbackUrl: () => {},
  });

  sync.scheduleNavigation("a", () => "https://app.test/chat/?c=a");
  sync.dispose();
  flushTimers();

  expect(iframe.src).toBe("");
});

test("the fallback url setter is used before the iframe exists", () => {
  const fallbacks: string[] = [];
  const sync = createPreviewSynchronizer({
    getIframe: () => undefined,
    setFallbackUrl: (url) => fallbacks.push(url),
  });

  sync.scheduleNavigation("a", () => "https://app.test/chat/?c=a");
  flushTimers();

  expect(fallbacks).toEqual(["https://app.test/chat/?c=a"]);
});

test("postConfig posts the preview message to the app origin", () => {
  const iframe = createIframe();
  const sync = createPreviewSynchronizer({
    getIframe: () => iframe as unknown as HTMLIFrameElement,
    setFallbackUrl: () => {},
  });

  sync.postConfig(DEFAULT_CHAT_CONFIG);

  expect(iframe.posted).toHaveLength(1);
  expect(iframe.posted[0]?.origin).toBe("https://setup.test");
  expect(iframe.posted[0]?.message).toMatchObject({
    type: "chatyx:preview-config",
    config: DEFAULT_CHAT_CONFIG,
  });
});

test("postConfig is a no-op without an iframe", () => {
  const sync = createPreviewSynchronizer({
    getIframe: () => undefined,
    setFallbackUrl: () => {},
  });

  expect(() => sync.postConfig(DEFAULT_CHAT_CONFIG)).not.toThrow();
});

test("a custom debounce delay is honoured", () => {
  const iframe = createIframe();
  const sync = createPreviewSynchronizer({
    getIframe: () => iframe as unknown as HTMLIFrameElement,
    setFallbackUrl: () => {},
    debounceMs: 0,
  });

  sync.scheduleNavigation("a", () => "https://app.test/chat/?c=a");
  flushTimers();

  expect(iframe.src).toBe("https://app.test/chat/?c=a");
});
