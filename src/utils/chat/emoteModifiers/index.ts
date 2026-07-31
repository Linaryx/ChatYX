export type {
  EmoteModifierEffect,
  EmoteModifierToken,
  EmoteSizeBox,
  ModifierPosition,
  ResolvedEmoteModifier,
  WideLayout,
} from "./types";

export { getEmoteModifier, resolveEmoteModifiers } from "./resolve";

export {
  WIDE_SCALE,
  buildModifierStyleVars,
  computeRotatedLayout,
  computeWideLayout,
  formatPx,
  getRotationDegrees,
  hasRotation,
  scaleNaturalSize,
} from "./layout";

export {
  getRenderedImageSize,
  insertZeroWidthOverlays,
  wrapEmoteModifierContent,
  wrapEmoteModifiers,
  wrapZeroWidthModifiers,
} from "./html";

export {
  attachZeroWidthOverlay,
  type ZeroWidthSegment,
} from "./zeroWidth";

export {
  applyImageSizeAttrsFromData,
  bindWideEmoteSizes,
  buildGigantifiedLine,
  setWideEmoteSize,
} from "./dom";
