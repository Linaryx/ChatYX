/**
 * Settings search for the setup workspace.
 *
 * The matcher itself is pure and lives in `utils/setupSearch`. This module owns
 * the DOM half: which elements are searchable, which section each hit belongs
 * to, the highlight class, the counter format and the reveal scroll. The scroll
 * callback is passed in because the workspace's scroll state belongs to the
 * route.
 */
import type { SetupSectionId } from "~/components/setup/SetupLayout";
import { isSetupSearchMatch } from "~/utils/setupSearch";

/**
 * Rows and field headings are searchable. The selector is a layout contract, so
 * it stays next to the highlight class that the workspace stylesheet expects.
 */
const SEARCHABLE_SELECTOR =
  ".setup-section .setup-control-row, .setup-section .setup-switch-row, .setup-section .setup-field-group > h3";

const SECTION_SELECTOR = ".setup-section";
const SECTION_ID_PREFIX = "setup-section-";
const HIGHLIGHT_CLASS = "setup-search-match";

/** Shortest query the search acts on; below it every query matches everything. */
export const MIN_SETUP_SEARCH_LENGTH = 3;

export type SetupSearchHit = {
  element: HTMLElement;
  /** Undefined when a matched element sits outside any section. */
  sectionId: SetupSectionId | undefined;
};

function sectionIdOf(element: HTMLElement): SetupSectionId | undefined {
  const id = element
    .closest<HTMLElement>(SECTION_SELECTOR)
    ?.id.replace(SECTION_ID_PREFIX, "");
  return id ? (id as SetupSectionId) : undefined;
}

/** Collects the searchable elements that match `query`, in document order. */
export function collectSetupSearchHits(query: string): SetupSearchHit[] {
  if (typeof document === "undefined") return [];

  return Array.from(document.querySelectorAll<HTMLElement>(SEARCHABLE_SELECTOR))
    .filter((element) => isSetupSearchMatch(query, element.textContent ?? ""))
    .map((element) => ({ element, sectionId: sectionIdOf(element) }));
}

/** Formats the "current / total" counter, which reads "0" with no hits. */
export function formatSetupSearchCounter(index: number, total: number): string {
  if (total === 0) return "0";
  return `${Math.min(index, total - 1) + 1} / ${total}`;
}

/** Marks exactly `hits`, clearing the class from every previous hit. */
export function highlightSetupSearchHits(hits: readonly SetupSearchHit[]): void {
  document
    .querySelectorAll(`.${HIGHLIGHT_CLASS}`)
    .forEach((element) => element.classList.remove(HIGHLIGHT_CLASS));
  for (const hit of hits) hit.element.classList.add(HIGHLIGHT_CLASS);
}

/**
 * Brings a hit into view: the owning section is scrolled first so the element
 * exists in the visible column, then the element itself. The double frame waits
 * for that section switch to lay out.
 */
export function revealSetupSearchHit(
  hit: SetupSearchHit,
  scrollToSection: (section: SetupSectionId) => void,
): void {
  if (hit.sectionId) scrollToSection(hit.sectionId);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      hit.element.scrollIntoView({ behavior: "smooth", block: "start" });
    }),
  );
}
