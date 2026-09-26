import { expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG } from "../src/config/chatUrlParams";
import { DEFAULT_EVENT_COLORS } from "../src/config/eventColors";
import {
  BUILT_IN_SETUP_TEMPLATES,
  createUserSetupTemplate,
  deleteUserSetupTemplate,
  readUserSetupTemplates,
  renameUserSetupTemplate,
  toVisualSetupPatch,
  writeUserSetupTemplates,
} from "../src/config/setupTemplates";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

test("standard overlay template contains only visual settings", () => {
  const standard = BUILT_IN_SETUP_TEMPLATES.find((template) => template.id === "standard");

  expect(standard?.settings).toMatchObject({
    size: DEFAULT_CHAT_CONFIG.size,
    font: DEFAULT_CHAT_CONFIG.font,
    overlayBackgroundColor: DEFAULT_CHAT_CONFIG.overlayBackgroundColor,
    animation: DEFAULT_CHAT_CONFIG.animation,
    gifScale: DEFAULT_CHAT_CONFIG.gifScale,
  });
  expect(standard?.settings).not.toHaveProperty("channel");
  expect(standard?.settings).not.toHaveProperty("youtubeChannel");
  expect(standard?.settings).not.toHaveProperty("kickChannel");
});

test("built-in templates keep both standard and atom presets", () => {
  expect(BUILT_IN_SETUP_TEMPLATES.map((template) => template.id)).toEqual(["standard", "atom"]);

  const atom = BUILT_IN_SETUP_TEMPLATES.find((template) => template.id === "atom");
  expect(atom?.settings).toEqual({
    animation: "fade",
    emoteScale: 1,
    font: 13,
    fontCustom: "",
    fontWeight: 600,
    gifScale: 1,
    highlightTwitchEvents: false,
    lineHeight: 100,
    linkColor: "#BD1313",
    linkMode: "highlight",
    nickFontWeight: 600,
    overlayBackgroundColor: "#000000",
    overlayBackgroundOpacity: 0,
    overlayBackgroundRadius: 20,
    overlayBorderWidth: 0,
    overlayBorderColor: "#ffffff",
    overlayPadding: 10,
    platformMarker: "stripe",
    shadow: false,
    showChannelPointRewards: false,
    showGifs: false,
    showGigantifiedEmotes: true,
    showHighlightedMessages: false,
    showPredictions: false,
    size: 1,
    smallCaps: true,
    stroke: false,
    ...DEFAULT_EVENT_COLORS,
    eventColorOpacity: 0,
    twitchEventBold: false,
    twitchEventItalic: false,
    usersColor: "#BD1313",
  });
  expect(atom?.settings).not.toHaveProperty("channel");
});

test("visual template patches exclude channels and behavior settings", () => {
  const settings = toVisualSetupPatch({
    channel: "streamer",
    youtubeChannel: "video",
    animation: "flow",
    gifScale: 1.5,
    font: 4,
    overlayBackgroundColor: "#123456",
  });

  expect(settings).toEqual({
    animation: "flow",
    font: 4,
    gifScale: 1.5,
    overlayBackgroundColor: "#123456",
  });
});

test("user templates persist, use unique names, and can be renamed or removed", () => {
  const storage = createStorage();
  const first = createUserSetupTemplate({ font: 2 }, {
    name: "My look", fallbackName: "My template", source: "manual",
  }, []);
  expect(first).not.toBeNull();

  const second = createUserSetupTemplate({ size: 3 }, {
    name: "My look", fallbackName: "My template", source: "chatyx",
  }, [first!]);
  expect(second?.name).toBe("My look 2");
  expect(second?.source).toBe("chatyx");

  expect(writeUserSetupTemplates([first!, second!], storage)).toBe(true);
  const renamed = renameUserSetupTemplate(first!.id, "Overlay", readUserSetupTemplates(storage));
  expect(renamed[0]?.name).toBe("Overlay");
  expect(deleteUserSetupTemplate(second!.id, renamed)).toHaveLength(1);
});

test("invalid template storage is ignored", () => {
  const storage = createStorage();
  storage.setItem("chatyx.setup.templates.v1", "not json");

  expect(readUserSetupTemplates(storage)).toEqual([]);
});
