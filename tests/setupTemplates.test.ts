import { expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG } from "../src/config/chatUrlParams";
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
  });
  expect(standard?.settings).not.toHaveProperty("channel");
  expect(standard?.settings).not.toHaveProperty("youtubeChannel");
  expect(standard?.settings).not.toHaveProperty("kickChannel");
  expect(standard?.settings).not.toHaveProperty("animation");
  expect(standard?.settings).not.toHaveProperty("gifScale");
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

  expect(settings).toEqual({ font: 4, overlayBackgroundColor: "#123456" });
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
