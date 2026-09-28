/**
 * Document-level lifecycle for the setup workspace.
 *
 * Setup lays itself out in fixed columns and therefore takes over document
 * scrolling, and it pauses the demo when the user prefers reduced motion. Both
 * are concerns of the document rather than of a component, so they live here and
 * the route only wires the results into its signals.
 */

/** The document surface setup paints behind its columns. */
const SETUP_BACKGROUND = "#09090b";

type DocumentStyleSnapshot = {
  htmlBackground: string;
  htmlOverflow: string;
  bodyBackground: string;
  bodyOverflow: string;
  bodyHeight: string;
  rootOverflow: string;
  rootHeight: string;
};

function captureDocumentStyles(root: HTMLElement | null): DocumentStyleSnapshot {
  const html = document.documentElement;
  const body = document.body;
  return {
    htmlBackground: html.style.background,
    htmlOverflow: html.style.overflow,
    bodyBackground: body.style.background,
    bodyOverflow: body.style.overflow,
    bodyHeight: body.style.height,
    rootOverflow: root?.style.overflow ?? "",
    rootHeight: root?.style.height ?? "",
  };
}

/**
 * Paints the setup background on the document and disables document scrolling,
 * because setup scrolls inside its own columns. Returns the release function,
 * which restores exactly the values that were in place before the lock.
 */
export function lockSetupDocument(): () => void {
  const html = document.documentElement;
  const body = document.body;
  const root = document.getElementById("root");
  const previous = captureDocumentStyles(root);

  html.style.background = SETUP_BACKGROUND;
  html.style.overflow = "hidden";
  body.style.background = SETUP_BACKGROUND;
  body.style.overflow = "hidden";
  body.style.height = "100%";
  if (root) {
    root.style.overflow = "hidden";
    root.style.height = "100%";
  }

  return () => {
    html.style.background = previous.htmlBackground;
    html.style.overflow = previous.htmlOverflow;
    body.style.background = previous.bodyBackground;
    body.style.overflow = previous.bodyOverflow;
    body.style.height = previous.bodyHeight;
    if (root) {
      root.style.overflow = previous.rootOverflow;
      root.style.height = previous.rootHeight;
    }
  };
}

/**
 * Reports the reduced-motion preference immediately and again on every change,
 * so callers do not need a separate initial read. Returns the unsubscribe
 * function.
 */
export function watchReducedMotion(
  onChange: (matches: boolean) => void,
): () => void {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sync = () => onChange(query.matches);

  sync();
  query.addEventListener("change", sync);
  return () => query.removeEventListener("change", sync);
}
