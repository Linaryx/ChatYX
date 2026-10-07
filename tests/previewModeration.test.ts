import { afterEach, expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG } from "../src/config/chatUrlParams";
import { selectPreviewModeration } from "../src/features/chat-overlay/model/previewModeration";
import { PreviewRuntime } from "../src/features/chat-overlay/application/previewRuntime";
import type { TwitchMessage } from "../src/services/chat/twitch/twitchService";

function message(id: string, username: string): TwitchMessage {
  return { id, username } as TwitchMessage;
}

test("demo deletion chooses one visible row rather than an offscreen message", () => {
  const messages = [message("hidden", "alice"), message("visible", "bob")];
  expect(selectPreviewModeration(messages, new Set(["visible"]), () => 0)?.ids).toEqual(new Set(["visible"]));
  expect(selectPreviewModeration(messages, new Set(), () => 0)).toBeNull();
});

test("demo timeout favors a recurring author and includes all of that author's rows", () => {
  const messages = [message("a1", "Alice"), message("b1", "bob"), message("a2", "alice")];
  const result = selectPreviewModeration(messages, new Set(["a1", "b1"]), () => 0.75);
  expect(result?.mutedUsername).toBe("alice");
  expect(result?.ids).toEqual(new Set(["a1", "a2"]));
});

const originalWindow = (globalThis as { window?: unknown }).window;
const originalDocument = (globalThis as { document?: unknown }).document;
const originalRandom = Math.random;
afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as unknown as { window: unknown }).window = originalWindow;
  if (originalDocument === undefined) delete (globalThis as { document?: unknown }).document;
  else (globalThis as unknown as { document: unknown }).document = originalDocument;
  Math.random = originalRandom;
});

test("automatic demo timeout uses the configured group effect and commits after its completion", () => {
  Math.random = () => 0.75;
  (globalThis as unknown as { window: unknown }).window = { innerWidth: 600, innerHeight: 400 };
  const rows = ["a1", "b1", "a2"].map((id) => ({
    dataset: { id },
    getBoundingClientRect: () => ({ width: 200, height: 30, left: 0, right: 200, top: 20, bottom: 50 }),
  }));
  const container = {};
  (globalThis as unknown as { document: unknown }).document = {
    querySelectorAll: () => rows,
    getElementById: () => container,
  };
  let messages = [message("a1", "alice"), message("b1", "bob"), message("a2", "alice")];
  const runtime = new PreviewRuntime(
    { channel: "chatyxpreview", initialConfig: { ...DEFAULT_CHAT_CONFIG, removalAnimation: "thanos" }, demoKind: "pasta" },
    {
      onConfigResolved: () => {}, onServiceReady: () => {}, onLoadingChange: () => {},
      onConnectionChange: () => {}, onMessagesChange: (updater) => { messages = updater(messages); },
      onAnimationDurationChange: () => {}, onChannelResolved: () => {}, onLoadingComplete: () => {},
    },
  );
  let commit!: () => void;
  let effects = 0;
  (runtime as any).ready = true;
  (runtime as any).service = {
    removeMessageGroup: (root: unknown, targets: unknown[], mode: string, onRemove: () => void) => {
      expect(root).toBe(container);
      expect(targets).toEqual([rows[0], rows[2]]);
      expect(mode).toBe("thanos");
      effects += 1;
      commit = onRemove;
    },
  };
  (runtime as any).maybeModerate(9000);
  expect(effects).toBe(1);
  expect(messages).toHaveLength(3);
  expect((runtime as any).mutedUntil.get("alice")).toBe(39000);
  (runtime as any).maybeModerate(20000);
  expect(effects).toBe(1); // No overlapping effect while the first one is running.
  messages.push(message("new", "charlie"));
  commit();
  expect(messages.map((entry) => entry.id)).toEqual(["b1", "new"]);
  (runtime as any).config = { ...DEFAULT_CHAT_CONFIG, messageSpeed: 0 };
  (runtime as any).maybeModerate(30000);
  expect(effects).toBe(1); // Paused playback also pauses automatic moderation.
  (runtime as any).destroyed = true;
  (runtime as any).maybeModerate(30000);
  expect(effects).toBe(1);
});
