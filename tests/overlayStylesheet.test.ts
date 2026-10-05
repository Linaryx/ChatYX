import { expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG } from "../src/config/chatUrlParams";
import {
  getOverlayStyleVariables,
  OVERLAY_ATTRIBUTES,
  OVERLAY_STYLE_PROPERTIES,
} from "../src/styles/chatStyles";
import { createChromeStyle, createContainerStyle } from "../src/features/chat-overlay";

const chatCss = (
  await Bun.file(new URL("../src/styles/chat.css", import.meta.url)).text()
).replace(/\r\n/g, "\n");

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
  expect(chatCss).toContain("#chat_surface.has-prediction {\n  --chat-prediction-meta-height: 22px;");
  expect(chatCss).toContain("var(--chat-prediction-meta-height) + var(--chat-prediction-gap)");
  expect(chatCss).toContain(
    "#chat_surface.has-prediction > #chat_chrome {\n  padding-top: var(--chat-prediction-reserved-height);\n}",
  );
  expect(chatCss).not.toContain("#chat_chrome.has-prediction");
  expect(createChromeStyle()).not.toHaveProperty("padding");
});

test("the prediction slot belongs to the fixed surface, not the growing message chrome", async () => {
  const route = await Bun.file(
    new URL("../src/routes/chat/channel.tsx", import.meta.url),
  ).text();
  const surfaceStart = route.indexOf('id="chat_surface"');
  const slotStart = route.indexOf('class="chat-prediction-slot"');
  const chromeStart = route.indexOf('id="chat_chrome"');
  expect(surfaceStart).toBeGreaterThan(0);
  expect(slotStart).toBeGreaterThan(surfaceStart);
  expect(chromeStart).toBeGreaterThan(slotStart);
  expect(route.slice(surfaceStart, slotStart)).toContain(
    'classList={{ "has-prediction": hasPredictionBar() }}',
  );
  expect(route.slice(chromeStart)).not.toContain('"has-prediction"');
});

test("event labels and icons keep the opaque event color", () => {
  expect(chatCss).toContain(".chat-event-fact {\n  min-inline-size: 0;\n  color: var(--chat-event-color, #9146ff);");
  expect(chatCss).toContain(".chat-event-icon {\n  inline-size: 0.78em;");
  expect(chatCss).toContain("fill: var(--chat-event-color, #9146ff);");
});

test("horizontal event rows do not shrink into vertical columns", () => {
  expect(chatCss).toContain(
    "#chat_container.layout-horizontal .chat_line.chat-event:not(.gigantified-emote) {\n  flex: 0 0 auto;",
  );
});

test("horizontal chat aligns the message baseline rather than row bottoms", () => {
  expect(chatCss).toContain(
    "#chat_container.layout-horizontal {\n  align-items: last baseline;",
  );
});

test("horizontal chat reserves a small trailing viewport inset", () => {
  const horizontalRule = chatCss.match(
    /#chat_container\.layout-horizontal \{([^}]+)\}/,
  )?.[1];
  expect(horizontalRule).toContain(
    "padding-inline-end: var(--chat-message-pad-inline);",
  );
  expect(createContainerStyle()).not.toHaveProperty("padding");
  expect(createContainerStyle()["box-sizing"]).toBe("border-box");
});

test("horizontal reply previews follow the body width without widening the item", () => {
  expect(chatCss).toContain(
    "#chat_container.layout-horizontal .reply_line {\n  inline-size: 0;\n  min-inline-size: 100%;\n}",
  );
  expect(chatCss).toContain(
    ".reply_text {\n  min-inline-size: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}",
  );
});

test("media rows fit the surface height without consuming the prediction lane", () => {
  expect(chatCss).toContain("#chat_surface {\n  container-type: size;\n}");
  const mediaRule = chatCss.match(
    /:is\(\.gigantified-emote, \.gif-message\) \{([^}]+)\}/,
  )?.[1];
  expect(mediaRule).toContain("grid-template-rows: auto minmax(0, 1fr);");
  expect(mediaRule).toContain("100cqb - var(--chat-prediction-reserved-height, 0px)");
  expect(chatCss).toContain("padding-top: var(--chat-prediction-reserved-height);");
});

test("media headers stay on one bounded line instead of overlapping the next item", () => {
  const headerRule = chatCss.match(
    /\.gigantified-emote-header,\s*\.gif-message-header \{([^}]+)\}/,
  )?.[1];
  expect(headerRule).toContain("max-inline-size: 100%;");
  expect(headerRule).toContain("white-space: nowrap;");
  expect(headerRule).toContain("overflow: hidden;");
  expect(headerRule).toContain("text-overflow: ellipsis;");
});

test("giant images and modifier layers can shrink within their media track", () => {
  const imageRule = chatCss.match(
    /(?:^|\n)\.gigantified-emote-line img\.gigantified \{([^}]+)\}/,
  )?.[1];
  expect(imageRule).toContain("inline-size: 100% !important;");
  expect(imageRule).toContain("block-size: 100% !important;");
  expect(imageRule).toContain("max-block-size: 100% !important;");
  expect(imageRule).toContain("object-fit: contain;");
  expect(chatCss).toContain(".gigantified-emote-line .emote-animation-layer {\n  display: grid;\n  min-block-size: 0;");
});

test("media does not add a second line break after its existing author track", () => {
  expect(chatCss).toContain(
    ":root[data-nl-after-name] .gigantified-emote > .message::before,\n:root[data-nl-after-name] .gif-message-line > .message::before {\n  content: none;\n}",
  );
});

test("horizontal giants put their author and media in one bottom-aligned row", () => {
  const rule = chatCss.match(
    /#chat_container\.layout-horizontal \.gigantified-emote \{([^}]+)\}/,
  )?.[1];
  expect(rule).toContain("grid-template-columns:");
  expect(rule).toContain("minmax(0, max-content) minmax(0, var(--chat-horizontal-giant-size))");
  expect(rule).toContain("grid-template-rows: minmax(0, auto);");
  expect(rule).toContain("align-items: end;");
  expect(rule).toContain("align-self: flex-end;");
  expect(rule).toContain("inline-size: fit-content;");
  expect(rule).toContain("var(--chat-gigantified-emote-max-size)");
  expect(rule).toContain("100cqb - var(--chat-prediction-reserved-height, 0px)");
  expect(chatCss).toContain(
    "grid-row: 1 / -1;\n  inline-size: var(--chat-horizontal-giant-size);\n  block-size: auto;\n  aspect-ratio: 1;",
  );
  expect(chatCss).toContain(
    "#chat_container.layout-horizontal .gigantified-emote-line img.gigantified {\n  object-position: center bottom;\n}",
  );
  expect(chatCss).toContain(
    "#chat_container.layout-horizontal .gigantified-emote-line .emote-modified {\n  margin: 0;\n}",
  );
});

test("horizontal giant replies stay above the author, not in the media column", () => {
  expect(chatCss).toContain(
    "#chat_container.layout-horizontal .gigantified-emote:has(> .reply_line) {\n  grid-template-rows: minmax(0, 1fr) auto;\n}",
  );
  expect(chatCss).toContain(
    "#chat_container.layout-horizontal .gigantified-emote > .reply_line {\n  grid-column: 1;\n  grid-row: 1;\n  align-self: end;\n}",
  );
  expect(chatCss).toContain(
    "#chat_container.layout-horizontal .gigantified-emote > .gigantified-emote-header {\n  grid-column: 1;\n  grid-row: -2;\n}",
  );
  expect(chatCss).toContain(
    "#chat_container.layout-horizontal .gigantified-emote > .message {\n  grid-column: 2;\n  grid-row: 1 / -1;",
  );
});
