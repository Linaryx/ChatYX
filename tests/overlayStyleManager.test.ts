import { expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG } from "../src/config/chatUrlParams";
import {
  applyOverlayStyles,
  clearOverlayStyles,
} from "../src/services/chat/runtime/overlayStyleManager";
import { SIZE_CONFIGS } from "../src/styles/chatStyles";

/**
 * The overlay stylesheet teardown is exercised through a minimal document shim:
 * the manager writes custom properties and attributes on the root, and it owns
 * the animation stylesheet it injects. This is not a DOM implementation — only
 * the surface the manager touches.
 */
type FakeStyleElement = { id: string; tagName: string; textContent: string; remove: () => void };

function installDocument() {
  const properties = new Map<string, string>();
  const attributes = new Map<string, string>();
  const head: FakeStyleElement[] = [];

  const makeStyle = (): FakeStyleElement => {
    const element: FakeStyleElement = {
      id: "",
      tagName: "STYLE",
      textContent: "",
      remove: () => {
        const index = head.indexOf(element);
        if (index >= 0) head.splice(index, 1);
      },
    };
    return element;
  };

  const document = {
    documentElement: {
      style: {
        setProperty: (name: string, value: string) => properties.set(name, value),
        removeProperty: (name: string) => properties.delete(name),
      },
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
    },
    head: { appendChild: (element: FakeStyleElement) => head.push(element) },
    createElement: () => makeStyle(),
    getElementById: (id: string) => head.find((element) => element.id === id) ?? null,
    querySelectorAll: (selector: string) => {
      const match = /^style\[id="(.+)"\]$/.exec(selector);
      if (!match) return [];
      return head.filter((element) => element.id === match[1]);
    },
  };

  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  return {
    properties,
    attributes,
    head,
    restore: () => {
      if (previous) Object.defineProperty(globalThis, "document", previous);
      else Reflect.deleteProperty(globalThis, "document");
    },
  };
}

test("applying publishes properties and the boolean attributes", () => {
  const shim = installDocument();
  try {
    applyOverlayStyles({ ...DEFAULT_CHAT_CONFIG, hideNames: true, nlAfterName: true });

    expect(shim.properties.get("--chat-size-font-size")).toBe(
      SIZE_CONFIGS[DEFAULT_CHAT_CONFIG.size as 1 | 2 | 3].fontSize,
    );
    expect(shim.attributes.has("data-hide-names")).toBe(true);
    expect(shim.attributes.has("data-nl-after-name")).toBe(true);
  } finally {
    shim.restore();
  }
});

test("clearing removes the properties, the attributes and the animation stylesheet", () => {
  const shim = installDocument();
  try {
    applyOverlayStyles({ ...DEFAULT_CHAT_CONFIG, animation: "fade", hideNames: true });
    expect(shim.head.map((element) => element.id)).toContain("chat-animations");

    clearOverlayStyles();

    expect([...shim.properties.keys()]).toEqual([]);
    expect([...shim.attributes.keys()]).toEqual([]);
    // The manager injects the animation stylesheet, so it must take it down too;
    // an earlier revision of the refactor left this one behind.
    expect(shim.head).toEqual([]);
  } finally {
    shim.restore();
  }
});

test("applying twice does not accumulate animation stylesheets", () => {
  const shim = installDocument();
  try {
    applyOverlayStyles({ ...DEFAULT_CHAT_CONFIG, animation: "fade" });
    applyOverlayStyles({ ...DEFAULT_CHAT_CONFIG, animation: "fade" });

    expect(shim.head).toHaveLength(1);
  } finally {
    shim.restore();
  }
});
