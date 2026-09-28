/**
 * Document-level lifecycle for the setup workspace.
 *
 * Setup lays itself out in fixed columns and therefore takes over document
 * scrolling, and it pauses the demo when the user prefers reduced motion. Both
 * are concerns of the document rather than of a component, so they live here and
 * the route only wires the results into its signals.
 *
 * The lock is a state marker, not a style: it puts `data-setup-document` on the
 * root and the setup stylesheet owns what that means. The workspace paints its
 * own surface on `.setup-root`, and the app keeps the document background
 * transparent for OBS, so this module owns no colour at all.
 */

/** Marks the setup document lock; the setup stylesheet owns the rules. */
const SETUP_DOCUMENT_ATTRIBUTE = "data-setup-document";

/**
 * Locks document scrolling while the setup workspace is mounted. Returns the
 * release function, which restores exactly the attribute state that was in place
 * before the lock.
 */
export function lockSetupDocument(): () => void {
  const root = document.documentElement;
  const previous = root.getAttribute(SETUP_DOCUMENT_ATTRIBUTE);
  root.setAttribute(SETUP_DOCUMENT_ATTRIBUTE, "");

  return () => {
    if (previous === null) root.removeAttribute(SETUP_DOCUMENT_ATTRIBUTE);
    else root.setAttribute(SETUP_DOCUMENT_ATTRIBUTE, previous);
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
