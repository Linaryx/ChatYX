import { describe, expect, test } from "bun:test";
import { renderMessageWithEmotes } from "../src/components/chat/renderMessageContent";
import { DEFAULT_CHAT_CONFIG } from "../src/config/chatUrlParams";
import type { ChatPresentationService } from "../src/services/chat/chatPresentationService";
import type { TwitchMessage } from "../src/services/chat/twitchService";
import { createMessageTokenSnapshot } from "../src/utils/chat/emojiUtils";

function message(text: string, positions: string[]): TwitchMessage {
  return {
    id: "message-1",
    userId: "user-1",
    username: "sender",
    displayName: "Sender",
    message: text,
    color: "#fff",
    badges: [],
    emotes: { "25": positions },
    userType: "",
    isModerator: false,
    isSubscriber: false,
    timestamp: new Date(0),
  };
}

function render(
  message: TwitchMessage,
  displayText?: string,
  config = DEFAULT_CHAT_CONFIG,
): string {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const element = {
    innerHTML: "",
    // These fixtures contain no wide or rotated emote modifiers.
    querySelectorAll: () => [],
  };
  const service = {
    getEmote: () => undefined,
    getUserPaint: () => null,
  } as unknown as ChatPresentationService;

  try {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: (tag: string) => {
          expect(tag).toBe("span");
          return element;
        },
      },
    });
    const rendered = displayText === undefined
      ? renderMessageWithEmotes(message, config, service)
      : renderMessageWithEmotes(message, config, service, displayText);
    expect(rendered).toBe(element);
    return element.innerHTML;
  } finally {
    if (previousDocument) {
      Object.defineProperty(globalThis, "document", previousDocument);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
  }
}

function expectKappa(html: string, count = 1): void {
  const images = html.match(/<img\b[^>]*>/g) ?? [];
  expect(images).toHaveLength(count);
  for (const image of images) {
    expect(image).toContain('class="emote"');
    expect(image).toContain("/emoticons/v2/25/default/dark/3.0");
    expect(image).toContain('title="Kappa"');
  }
}

describe("renderMessageWithEmotes display text", () => {
  test("uses original Twitch positions after hiding a reply mention", () => {
    const original = message("@viewer Kappa", ["8-12"]);
    const html = render(original, "Kappa");

    expectKappa(html);
    expect(html).not.toContain("@viewer");
    expect(html.replace(/<[^>]*>/g, "")).toBe("");
    expect(original.message).toBe("@viewer Kappa");
    expect(original.emotes).toEqual({ "25": ["8-12"] });
  });

  test("renders repeated emotes using their original reply positions", () => {
    const html = render(
      message("@viewer Kappa Kappa", ["8-12", "14-18"]),
      "Kappa Kappa",
    );

    expectKappa(html, 2);
    expect(html.replace(/<[^>]*>/g, "")).toBe(" ");
  });

  test("interprets original positions as Unicode codepoints, not UTF-16 offsets", () => {
    const html = render(
      message("@viewer \u{1F600} Kappa", ["10-14"]),
      "Kappa",
    );

    expectKappa(html);
    expect(html.replace(/<[^>]*>/g, "")).toBe("");
  });

  test("preserves normal rendering when the fourth argument is omitted", () => {
    const original = message("hello Kappa world", ["6-10"]);
    const html = render(original);

    expectKappa(html);
    expect(html.replace(/<[^>]*>/g, "")).toBe("hello  world");
    expect(render(original, original.message)).toBe(html);
  });

  test("retokenizes display text when the snapshot still contains the original reply", () => {
    const original = message("@viewer Kappa", ["8-12"]);
    const snapshot = createMessageTokenSnapshot(original.message);
    original.tokenSnapshot = snapshot;
    const html = render(original, "Kappa");

    expectKappa(html);
    expect(html).not.toContain("@viewer");
    expect(html.replace(/<[^>]*>/g, "")).toBe("");
    expect(original.tokenSnapshot).toBe(snapshot);
    expect(snapshot).toEqual(createMessageTokenSnapshot("@viewer Kappa"));
    expect(original.message).toBe("@viewer Kappa");
  });

  test("honors an empty display override instead of falling back to the original", () => {
    const original = message("@viewer Kappa", ["8-12"]);
    original.tokenSnapshot = createMessageTokenSnapshot(original.message);

    expect(render(original, "")).toBe("");
  });

  test("renders enabled Twitch GIFs using Twitch's full URL at the configured scale", () => {
    const original = message("[GIF]", []);
    original.gifs = [{
      start: 0,
      end: 4,
      id: "gif-1",
      url: "https://media.example/200.webp?token=a=b",
    }];
    const html = render(original, undefined, {
      ...DEFAULT_CHAT_CONFIG,
      showGifs: true,
      gifScale: 1.5,
    });

    expect(html).toContain('class="chat-gif"');
    expect(html).toContain("/200.webp?token=a=b");
    expect(html).toContain('alt="GIF"');
  });

  test("keeps GIF text when the feature is disabled", () => {
    const original = message("[GIF]", []);
    original.gifs = [{
      start: 0,
      end: 4,
      id: "gif-1",
      url: "https://media.example/gif.gif",
    }];

    const html = render(original);
    expect(html).not.toContain("chat-gif");
    expect(html).toContain("[GIF]");
  });
});
