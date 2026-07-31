import type { EmoteModifierEffect, EmoteSizeBox, WideLayout } from "./types";

export const WIDE_SCALE = 4;

export function getRotationDegrees(effects: EmoteModifierEffect[]): number {
  return (
    (effects.includes("rotate-right") ? 90 : 0) -
    (effects.includes("rotate-left") ? 90 : 0)
  );
}

export function hasRotation(effects: EmoteModifierEffect[]): boolean {
  return getRotationDegrees(effects) !== 0;
}

export function computeRotatedLayout(size: EmoteSizeBox): WideLayout {
  const fit = Math.max(size.width, size.height);
  return { width: fit, height: fit, rotated: true };
}

/** Plain wide stretches ×4; rotate+wide only fits the rotated box (no stretch). */
export function computeWideLayout(size: EmoteSizeBox, rotated: boolean): WideLayout {
  if (rotated) {
    return computeRotatedLayout(size);
  }

  return {
    width: size.width * WIDE_SCALE,
    height: size.height,
    rotated: false,
  };
}

export function formatPx(value: number): string {
  return `${value.toFixed(3)}px`;
}

export function buildModifierStyleVars(
  effects: EmoteModifierEffect[],
  imageSize?: EmoteSizeBox,
): string[] {
  const rotation = getRotationDegrees(effects);
  const styleValues = [
    `--emote-scale-x: ${effects.includes("flip-x") ? -1 : 1}`,
    `--emote-scale-y: ${effects.includes("flip-y") ? -1 : 1}`,
    `--emote-rotation: ${rotation}deg`,
    `--emote-transform-origin: center`,
  ];

  if (imageSize) {
    if (effects.includes("wide")) {
      const layout = computeWideLayout(imageSize, rotation !== 0);
      styleValues.push(
        `--emote-wide-width: ${formatPx(layout.width)}`,
        `--emote-wide-height: ${formatPx(layout.height)}`,
      );
    } else if (rotation !== 0) {
      const layout = computeRotatedLayout(imageSize);
      styleValues.push(
        `--emote-layout-width: ${formatPx(layout.width)}`,
        `--emote-layout-height: ${formatPx(layout.height)}`,
      );
    }
  }

  return styleValues;
}

export function scaleNaturalSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): EmoteSizeBox | undefined {
  if (!naturalWidth || !naturalHeight) return undefined;
  if (!Number.isFinite(maxWidth) || !Number.isFinite(maxHeight)) return undefined;

  const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  };
}
