import { expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG } from "../src/config/chatUrlParams";
import {
  getOverlayStyleVariables,
  OVERLAY_ATTRIBUTES,
  OVERLAY_STYLE_PROPERTIES,
} from "../src/styles/chatStyles";

const chatCss = await Bun.file(
  new URL("../src/styles/chat.css", import.meta.url),
).text();

test("the property list covers exactly what the variables function publishes", () => {
  // A maximal config, so the conditional shadow and stroke properties are present
  // and the two sets have to match in both directions.
  const variables = getOverlayStyleVariables({
    ...DEFAULT_CHAT_CONFIG,
    shadow: 3,
    stroke: 4,
  });
  const known = new Set<string>(OVERLAY_STYLE_PROPERTIES);

  expect(Object.keys(variables).filter((name) => !known.has(name))).toEqual([]);
  expect([...OVERLAY_STYLE_PROPERTIES].filter((name) => !(name in variables))).toEqual(
    [],
  );
});

test("every published property is consumed by the stylesheet", () => {
  const unused = [...OVERLAY_STYLE_PROPERTIES].filter(
    (name) => !chatCss.includes(`var(${name}`),
  );
  expect(unused).toEqual([]);
});

test("every boolean variant is keyed on an attribute the stylesheet knows", () => {
  for (const attribute of [
    OVERLAY_ATTRIBUTES.hideNames,
    OVERLAY_ATTRIBUTES.nlAfterName,
    OVERLAY_ATTRIBUTES.preview,
  ]) {
    expect(chatCss).toContain(`:root[${attribute}]`);
  }
});

test("the stylesheet no longer depends on generated style elements", () => {
  // The runtime publishes properties and attributes only; nothing appends a
  // stylesheet for the overlay any more.
  for (const id of [
    "chat-size-styles",
    "chat-shadow-styles",
    "chat-stroke-styles",
    "chat-variant-styles",
  ]) {
    expect(chatCss.includes(id)).toBe(false);
  }
});

test("prediction bars reserve space above the message container", () => {
  expect(chatCss).toContain("#chat_chrome.has-prediction #chat_container");
  expect(chatCss).toContain("58px + var(--chat-surface-padding, 10px)");
});

test("event labels and icons keep the opaque event color", () => {
  expect(chatCss).toContain(".chat-event-fact {\n  min-inline-size: 0;\n  color: var(--chat-event-color, #9146ff);");
  expect(chatCss).toContain(".chat-event-icon {\n  inline-size: 0.78em;");
  expect(chatCss).toContain("fill: var(--chat-event-color, #9146ff);");
});
