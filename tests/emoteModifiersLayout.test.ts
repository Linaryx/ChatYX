import { describe, expect, test } from "bun:test";
import {
  WIDE_SCALE,
  attachZeroWidthOverlay,
  buildModifierStyleVars,
  computeRotatedLayout,
  computeWideLayout,
  getRotationDegrees,
  insertZeroWidthOverlays,
  wrapEmoteModifiers,
  wrapZeroWidthModifiers,
} from "../src/utils/chat/emoteModifiers";

describe("emote modifier layout", () => {
  test("plain wide stretches by WIDE_SCALE and keeps height", () => {
    expect(computeWideLayout({ width: 25, height: 25 }, false)).toEqual({
      width: 25 * WIDE_SCALE,
      height: 25,
      rotated: false,
    });
  });

  test("rotated wide fits the box without stretch", () => {
    expect(computeWideLayout({ width: 40, height: 20 }, true)).toEqual({
      width: 40,
      height: 40,
      rotated: true,
    });
  });

  test("plain rotation reserves a square layout box", () => {
    expect(computeRotatedLayout({ width: 40, height: 20 })).toEqual({
      width: 40,
      height: 40,
      rotated: true,
    });
    expect(
      buildModifierStyleVars(["rotate-left"], { width: 40, height: 20 }),
    ).toContain("--emote-layout-width: 40.000px");
    expect(
      buildModifierStyleVars(["rotate-left"], { width: 40, height: 20 }),
    ).toContain("--emote-layout-height: 40.000px");
  });

  test("rotation degrees cancel when both left and right are present", () => {
    expect(getRotationDegrees(["rotate-left", "rotate-right"])).toBe(0);
    expect(getRotationDegrees(["rotate-right"])).toBe(90);
    expect(getRotationDegrees(["rotate-left"])).toBe(-90);
  });

  test("wrapEmoteModifiers nests transform layers and wide vars", () => {
    const html =
      '<span class="emote-container"><img class="emote" src="x" style="width: 25px; height: 25px;" /></span>';
    const wrapped = wrapEmoteModifiers(html, ["wide", "flip-x"], "w! h! Kappa");

    expect(wrapped).toContain('class="emote-container emote-modified emote-modifier-wide emote-modifier-flip-x"');
    expect(wrapped).toContain('aria-label="w! h! Kappa"');
    expect(wrapped).toContain("--emote-wide-width: 100.000px");
    expect(wrapped).toContain("--emote-wide-height: 25.000px");
    expect(wrapped).toContain("--emote-scale-x: -1");
    expect(wrapped).toContain("emote-transform-layer");
    expect(wrapped).toContain("emote-filter-layer");
    expect(wrapped).toContain("emote-animation-layer");
  });

  test("insertZeroWidthOverlays marks data-zw-group and keeps overlays inside", () => {
    const base =
      '<span class="emote-container emote-modified emote-modifier-wide" style="--emote-wide-width: 100px;"><span class="emote-transform-layer"><img class="emote" src="base" /></span></span>';
    const next = insertZeroWidthOverlays(base, [
      '<img class="emote zerowidth" src="zw" />',
    ]);

    expect(next).toContain('data-zw-group="true"');
    expect(next).toContain('<img class="emote zerowidth" src="zw" />');
    expect(next?.indexOf("zerowidth")).toBeLessThan(
      next?.lastIndexOf("</span") ?? -1,
    );
  });

  test("wraps each emoji in a multi-emoji token without cross-nesting", () => {
    const emoji = (name: string) =>
      `<span class="emoji-container"><img class="emoji" src="${name}" width="24" height="24" /></span>`;
    const wrapped = wrapEmoteModifiers(
      `${emoji("one")}${emoji("two")}`,
      ["wide"],
      "w! 😀😂",
    );

    expect(wrapped.match(/emote-modified/g)?.length).toBe(2);
    expect(wrapped.match(/emote-transform-layer/g)?.length).toBe(2);
    expect(wrapped.match(/emote-animation-layer/g)?.length).toBe(2);
    expect(wrapped).toContain('src="one" width="24" height="24" /></span></span></span></span>');
    expect(wrapped).toContain('src="two" width="24" height="24" /></span></span></span></span>');
  });

  test("composes base modifiers around an independently modified zero-width overlay", () => {
    const base = wrapEmoteModifiers(
      '<span class="emote-container"><img class="emote" src="base" style="width: 28px; height: 28px;" /></span>',
      ["flip-x"],
      "h! Base",
    );
    const overlay = wrapZeroWidthModifiers(
      '<img class="emote zerowidth" src="overlay" style="width: 56px; height: 28px;" />',
      ["party"],
      "p! Overlay",
    );
    const segments = [
      {
        kind: "target",
        html: base,
        effects: ["flip-x"] as const,
        accessibleText: "h! Base",
      },
    ];

    expect(attachZeroWidthOverlay(segments, overlay)).toBe(true);
    expect(segments[0].html).toContain('data-zw-group="true"');
    expect(segments[0].html.match(/emote-modifier-flip-x/g)?.length).toBe(2);
    expect(segments[0].html).toContain("emote-modifier-party");
    expect(segments[0].html).toContain("width: 56px; height: 28px;");
    expect(segments[0].html.indexOf("emote-modifier-flip-x")).toBeLessThan(
      segments[0].html.indexOf("emote-modifier-party"),
    );
    expect(overlay).toContain("emote-zero-width-overlay");
  });
});
