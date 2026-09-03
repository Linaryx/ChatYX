import { describe, expect, test } from "bun:test";
import {
  getAnimationScrollBehavior,
  getAnimationStyles,
  getMessageEntryAnimationDuration,
  normalizeChatAnimationMode,
} from "../src/utils/ui/animationUtils";

const options = {
  enabled: true,
  duration: 200,
  easing: "ease-out",
} as const;

describe("chat animation modes", () => {
  test("generates distinct entry animations", () => {
    const fadeStyles = getAnimationStyles({ ...options, type: "fade" });
    expect(fadeStyles).toContain("fadeIn");
    expect(fadeStyles).toContain("prefers-reduced-motion: reduce");
    const flowStyles = getAnimationStyles({ ...options, type: "flow" });
    expect(flowStyles).toContain("flowIn");
    expect(flowStyles).toContain("clip-path: inset(100% 0 0 0)");
    expect(flowStyles).toContain("scale: 1 0.82");
    expect(flowStyles).toContain("transform-origin: center bottom");
    expect(flowStyles).toContain("cubic-bezier(0.2, 0, 0, 1)");
    expect(flowStyles).toContain("prefers-reduced-motion: reduce");
    expect(getAnimationStyles({ ...options, type: "scroll" })).toBe("");
    expect(getAnimationStyles({ ...options, type: "none" })).toBe("");
  });

  test("normalizes unsupported modes", () => {
    expect(normalizeChatAnimationMode("flow")).toBe("flow");
    expect(normalizeChatAnimationMode("unknown")).toBe("fade");
    expect(getAnimationScrollBehavior("scroll")).toBe("smooth");
    expect(getAnimationScrollBehavior("flow")).toBe("auto");
  });

  test("gives flow enough time to read while keeping fade compact", () => {
    expect(getMessageEntryAnimationDuration("flow")).toBe(300);
    expect(getMessageEntryAnimationDuration("fade")).toBe(200);
    expect(getMessageEntryAnimationDuration("none")).toBe(200);
  });
});
