import { describe, expect, test } from "bun:test";
import {
  getAnimationScrollBehavior,
  getAnimationStyles,
  normalizeChatAnimationMode,
} from "../src/utils/ui/animationUtils";

const options = {
  enabled: true,
  duration: 200,
  easing: "ease-out",
} as const;

describe("chat animation modes", () => {
  test("generates distinct entry animations", () => {
    expect(getAnimationStyles({ ...options, type: "fade" })).toContain("fadeIn");
    expect(getAnimationStyles({ ...options, type: "flow" })).toContain("flowIn");
    expect(getAnimationStyles({ ...options, type: "scroll" })).toBe("");
    expect(getAnimationStyles({ ...options, type: "none" })).toBe("");
  });

  test("normalizes unsupported modes", () => {
    expect(normalizeChatAnimationMode("flow")).toBe("flow");
    expect(normalizeChatAnimationMode("unknown")).toBe("fade");
    expect(getAnimationScrollBehavior("scroll")).toBe("smooth");
    expect(getAnimationScrollBehavior("flow")).toBe("auto");
  });
});
