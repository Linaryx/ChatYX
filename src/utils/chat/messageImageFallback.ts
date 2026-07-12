const MESSAGE_IMAGE_SELECTOR = "img.emote, img.emoji, img.cheer_emote";

function getPositiveNumber(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value || "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function hideBrokenMessageImage(image: HTMLImageElement) {
  const rect = image.getBoundingClientRect();
  const width =
    rect.width ||
    getPositiveNumber(image.style.width) ||
    getPositiveNumber(image.getAttribute("width")) ||
    getPositiveNumber(image.dataset.emoteWidth);
  const height =
    rect.height ||
    getPositiveNumber(image.style.height) ||
    getPositiveNumber(image.getAttribute("height")) ||
    getPositiveNumber(image.dataset.emoteHeight);

  image.alt = "";
  image.removeAttribute("src");
  image.removeAttribute("srcset");
  image.setAttribute("aria-hidden", "true");
  image.style.width = width ? `${width}px` : "1em";
  image.style.height = height ? `${height}px` : "1em";
  image.style.opacity = "0";
  image.style.visibility = "hidden";
}

export function installMessageImageFallback(container: HTMLElement): () => void {
  const handleError = (event: Event) => {
    const image = event.target;
    if (
      image instanceof HTMLImageElement &&
      image.matches(MESSAGE_IMAGE_SELECTOR)
    ) {
      hideBrokenMessageImage(image);
    }
  };

  container.addEventListener("error", handleError, true);

  container.querySelectorAll(MESSAGE_IMAGE_SELECTOR).forEach((node) => {
    if (
      node instanceof HTMLImageElement &&
      node.complete &&
      node.naturalWidth === 0
    ) {
      hideBrokenMessageImage(node);
    }
  });

  return () => container.removeEventListener("error", handleError, true);
}
