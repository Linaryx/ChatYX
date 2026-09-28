/**
 * Local font capability for the setup page.
 *
 * The Local Font Access API is Chromium-only *and* additionally gated behind a
 * permission prompt, so both the browser sniff and the enumeration live here.
 * The route only maps the typed result onto its status signal.
 */

type LocalFontData = {
  family: string;
  fullName?: string;
  postscriptName?: string;
  style?: string;
};

type LocalFontWindow = Window & {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
};

export type LocalFontOption = {
  family: string;
  styles: string[];
};

export type LocalFontQueryResult =
  | { kind: "unsupported" }
  | { kind: "found"; fonts: LocalFontOption[] }
  | { kind: "empty" }
  | { kind: "error" };

/**
 * Names the browser when it exposes the Local Font Access API, or null when the
 * API is missing. Callers use the name in the UI copy, so a non-null result also
 * serves as the "this browser can enumerate fonts" answer.
 */
export function detectLocalFontBrowser(): string | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  const hasApi =
    typeof (window as LocalFontWindow).queryLocalFonts === "function";
  if (!hasApi) return null;

  const ua = navigator.userAgent;
  const vendor = navigator.vendor || "";

  if (/Edg\//.test(ua)) return "Edge";
  if (/(OPR|Opera)\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && vendor.includes("Google")) return "Chrome";

  return null;
}

/**
 * Collapses the raw per-face font records into one entry per family with the
 * distinct styles it provides, both sorted for a stable list order.
 */
export function normalizeLocalFonts(fonts: LocalFontData[]): LocalFontOption[] {
  const families = new Map<string, Set<string>>();

  for (const font of fonts) {
    const family = font.family?.trim();
    if (!family) continue;

    const styles = families.get(family) ?? new Set<string>();
    if (font.style) styles.add(font.style);
    families.set(family, styles);
  }

  return Array.from(families.entries())
    .map(([family, styles]) => ({
      family,
      styles: Array.from(styles).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

/**
 * Enumerates installed fonts. Never rejects: a denied permission prompt and a
 * call made without user activation both surface as `error`, and an absent API
 * as `unsupported`.
 */
export async function loadLocalFontOptions(): Promise<LocalFontQueryResult> {
  if (!detectLocalFontBrowser()) return { kind: "unsupported" };

  const query = (window as LocalFontWindow).queryLocalFonts;
  if (typeof query !== "function") return { kind: "unsupported" };

  try {
    const fonts = normalizeLocalFonts(await query());
    return fonts.length > 0 ? { kind: "found", fonts } : { kind: "empty" };
  } catch {
    return { kind: "error" };
  }
}
