/**
 * Login vocabulary for the setup page.
 *
 * Bot lists, the viewer allowlist and the channel search all accept the same
 * kind of value — a Twitch/Kick login a user pasted, possibly with a leading
 * `@`. Keeping the normalization in one place is what lets those three inputs
 * behave identically.
 *
 * `config/chatUrlParams` deliberately does *not* strip the `@` when it parses
 * URL values, so URL parsing and input normalization stay separate.
 */

/** Normalizes one pasted login: trims, strips one leading `@`, lowercases. */
export function normalizeLogin(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

/** The single-letter avatar fallback used before a profile arrives. */
export function loginFallbackName(login: string): string {
  return login.slice(0, 1).toUpperCase();
}

/** Splits a pasted comma/space separated login list. */
export function splitLogins(raw: string): string[] {
  return raw.split(/[\s,]+/).map(normalizeLogin).filter(Boolean);
}

/** Appends the logins in `raw` that `current` does not already contain. */
export function mergeUniqueLogins(current: string[], raw: string): string[] {
  const nextLogins = splitLogins(raw);
  if (nextLogins.length === 0) return current;

  const seen = new Set(current);
  const merged = [...current];

  for (const login of nextLogins) {
    if (seen.has(login)) continue;
    seen.add(login);
    merged.push(login);
  }

  return merged;
}
