/**
 * Coercion from raw form input to configuration values.
 *
 * The setup form keeps every field as a string so the inputs stay controlled,
 * and the URL contract in `chatUrlParams` describes the same value shapes
 * through its `ParamKind` vocabulary (`int`, `float`, `intOrFalse`,
 * `secondsOrFalse`). These helpers are the form-side counterpart of that
 * vocabulary, so a value typed into the form and the same value arriving in a
 * URL land on identical types.
 */

/** Accepts `#rrggbb`, or `#rrggbbaa` when `allowAlpha` is set. */
export function normalizeHexColor(
  raw: string,
  fallback: string,
  allowAlpha = false,
): string {
  const value = raw.trim();
  const withHash = value.startsWith("#") ? value : `#${value}`;
  const pattern = allowAlpha ? /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/ : /^#[0-9a-fA-F]{6}$/;
  return pattern.test(withHash) ? withHash : fallback;
}

export function toInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function toClampedInt(
  raw: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number.parseInt(raw, 10);
  const value = Number.isFinite(n) ? n : fallback;
  return Math.min(Math.max(value, min), max);
}

export function toFloat(raw: string, fallback: number): number {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Positive integer, or `false` when the input is not a positive number.
 *
 * This covers both the `intOrFalse` and `secondsOrFalse` URL kinds, which
 * `chatUrlParams` already parses and serializes identically, and it replaces two
 * byte-identical route helpers that differed only in name.
 */
export function toPositiveIntOrFalse(raw: string): number | false {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : false;
}
