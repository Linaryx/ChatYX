import {
  computeRotatedLayout,
  computeWideLayout,
  formatPx,
  scaleNaturalSize,
} from "./layout";

export function applyImageSizeAttrsFromData(image: HTMLImageElement): void {
  const width = Number(image.dataset.emoteWidth || image.getAttribute("width"));
  const height = Number(
    image.dataset.emoteHeight || image.getAttribute("height"),
  );
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  if (width <= 0 || height <= 0) return;

  image.setAttribute("width", String(Math.round(width)));
  image.setAttribute("height", String(Math.round(height)));
}

/**
 * BTTV global emotes omit dimensions — fill wide layout vars after the image loads.
 */
export function setWideEmoteSize(
  image: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
): void {
  const container = image.closest(
    ".emote-modifier-wide, .emote-modifier-rotate-left, .emote-modifier-rotate-right",
  ) as HTMLElement | null;
  if (!container) return;

  const isWide = container.classList.contains("emote-modifier-wide");
  const sizeProperty = isWide ? "--emote-wide-width" : "--emote-layout-width";
  if (container.style.getPropertyValue(sizeProperty)) return;

  const rendered = scaleNaturalSize(
    image.naturalWidth,
    image.naturalHeight,
    maxWidth,
    maxHeight,
  );
  if (!rendered) return;

  const rotated =
    container.classList.contains("emote-modifier-rotate-left") ||
    container.classList.contains("emote-modifier-rotate-right");
  const layout = isWide
    ? computeWideLayout(rendered, rotated)
    : computeRotatedLayout(rendered);
  const prefix = isWide ? "--emote-wide" : "--emote-layout";

  container.style.setProperty(`${prefix}-width`, formatPx(layout.width));
  container.style.setProperty(`${prefix}-height`, formatPx(layout.height));
}

export function bindWideEmoteSizes(
  root: ParentNode,
  maxWidth: number,
  maxHeight: number,
): void {
  root
    .querySelectorAll<HTMLImageElement>(
      ".emote-modifier-wide img, .emote-modifier-rotate-left img, .emote-modifier-rotate-right img",
    )
    .forEach((image) => {
      if (image.complete) {
        setWideEmoteSize(image, maxWidth, maxHeight);
        return;
      }
      image.addEventListener(
        "load",
        () => setWideEmoteSize(image, maxWidth, maxHeight),
        { once: true },
      );
    });
}

/** Clone first emote/emoji into a gigantified line, preserving modifier wrappers. */
export function buildGigantifiedLine(
  root: HTMLElement,
): HTMLSpanElement | null {
  const target = root.querySelector("img.emote, img.emoji");
  if (!target) return null;

  const line = document.createElement("span");
  line.className = "gigantified-emote-line";

  const modifierContainer = target.closest(".emote-modified");
  if (modifierContainer) {
    const giantContainer = modifierContainer.cloneNode(true) as HTMLSpanElement;
    const giant = giantContainer.querySelector("img") as HTMLImageElement | null;
    if (giant) {
      giant.removeAttribute("style");
      applyImageSizeAttrsFromData(giant);
      giant.classList.add("gigantified");
    }
    giantContainer.style.removeProperty("--emote-wide-width");
    giantContainer.style.removeProperty("--emote-wide-height");
    giantContainer.style.removeProperty("--emote-layout-width");
    giantContainer.style.removeProperty("--emote-layout-height");
    line.append(giantContainer);
  } else {
    const giant = target.cloneNode(true) as HTMLImageElement;
    giant.removeAttribute("style");
    applyImageSizeAttrsFromData(giant);
    giant.classList.add("gigantified");
    line.append(giant);
  }

  return line;
}
