import { describe, expect, test } from "bun:test";
import {
  getAnimationScrollBehavior,
  getMessageEntryAnimationDuration,
  messageSpeedToIntervalMs,
  normalizeChatAnimationMode,
} from "../src/config/chatAnimation";
import { getAnimationStyles } from "../src/services/chat/runtime/animationStyles";

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
    expect(flowStyles).toContain("@keyframes chatFlowEnter");
    expect(flowStyles).toContain("--chat-flow-entry-shift");
    expect(flowStyles).toContain("translate: 0 var(--chat-flow-entry-shift, 18px)");
    expect(flowStyles).toContain("animation: chatFlowEnter");
    expect(flowStyles).toContain("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(flowStyles).not.toContain("@keyframes flowIn");
    expect(flowStyles).not.toContain("scale:");
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
    expect(getMessageEntryAnimationDuration("flow")).toBe(380);
    expect(getMessageEntryAnimationDuration("fade")).toBe(200);
    expect(getMessageEntryAnimationDuration("none")).toBe(200);
  });

  test("maps preview speed steps to readable intervals", () => {
    expect(messageSpeedToIntervalMs(0)).toBeNull();
    expect(messageSpeedToIntervalMs(10)).toBe(3000);
    expect(messageSpeedToIntervalMs(20)).toBe(2000);
    expect(messageSpeedToIntervalMs(30)).toBe(1500);
    expect(messageSpeedToIntervalMs(40)).toBe(1000);
    expect(messageSpeedToIntervalMs(50)).toBe(750);
    expect(messageSpeedToIntervalMs(60)).toBe(500);
    expect(messageSpeedToIntervalMs(70)).toBe(350);
    expect(messageSpeedToIntervalMs(80)).toBe(250);
    expect(messageSpeedToIntervalMs(90)).toBe(150);
    expect(messageSpeedToIntervalMs(100)).toBe(100);
    expect(messageSpeedToIntervalMs(31)).toBe(1500);
  });
});
