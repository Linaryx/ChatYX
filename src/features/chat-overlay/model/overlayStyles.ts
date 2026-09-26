import type { ChatConfig } from "~/utils/chat";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string): string {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "0, 0, 0";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function createOverlayRootStyle(visible: boolean) {
  return {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    "max-height": "100vh",
    display: "flex",
    "flex-direction": "column",
    "align-items": "stretch",
    "box-sizing": "border-box",
    "z-index": "10000",
    "pointer-events": "none",
    opacity: visible ? "1" : "0",
    overflow: "hidden",
    transition: "opacity 0.5s ease-in",
  } as const;
}

export function createSurfaceStyle(config: ChatConfig, fadeDurationMs: number) {
  const backgroundOpacity = clamp(config.overlayBackgroundOpacity, 0, 100) / 100;
  const borderWidth = clamp(config.overlayBorderWidth, 0, 8);
  const borderRadius = clamp(config.overlayBackgroundRadius, 0, 128);
  const padding = borderRadius > 0 ? clamp(config.overlayPadding, 0, 128) : 0;

  return {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    "flex-direction": "column",
    "align-items": "stretch",
    "justify-content":
      config.reverseLineOrder && !config.horizontal ? "flex-start" : "flex-end",
    padding: `${padding}px`,
    "box-sizing": "border-box",
    "pointer-events": "none",
    overflow: "hidden",
    "background-color": `rgba(${hexToRgb(config.overlayBackgroundColor)}, ${backgroundOpacity})`,
    border: borderWidth > 0
      ? `${borderWidth}px solid ${config.overlayBorderColor}`
      : "none",
    "border-radius": `${borderRadius}px`,
    "--chat-surface-padding": `${padding}px`,
    transition: [
      `background-color ${fadeDurationMs}ms ease-out`,
      `border-color ${fadeDurationMs}ms ease-out`,
    ].join(", "),
  } as const;
}

export function createChromeStyle() {
  return {
    position: "relative",
    width: "100%",
    "max-width": "100%",
    "max-height": "100%",
    display: "block",
    "flex-shrink": "1",
    padding: "0",
    "box-sizing": "border-box",
    "pointer-events": "none",
    overflow: "hidden",
  } as const;
}

export function createLoadingBackground(config: ChatConfig) {
  const opacity = clamp(config.overlayBackgroundOpacity, 0, 100) / 100;
  return `rgba(${hexToRgb(config.overlayBackgroundColor)}, ${opacity})`;
}

export function createContainerStyle() {
  return {
    position: "relative",
    width: "100%",
    "max-width": "100%",
    "max-height": "100%",
    padding: "0",
    "box-sizing": "border-box",
    "pointer-events": "none",
    overflow: "hidden",
    "z-index": "1",
  } as const;
}
