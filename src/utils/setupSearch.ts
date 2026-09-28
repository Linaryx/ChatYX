function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function words(value: string): string[] {
  return normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** How many extra characters a fuzzy (non-substring) match may skip inside a word. */
const MAX_FUZZY_SKIPS = 1;

/**
 * Matches `query` inside `valueWord` allowing at most `MAX_FUZZY_SKIPS`
 * non-matching characters between matched ones. Leading characters before the
 * first match are ignored, so mid-word matches still work. This keeps the fuzzy
 * mode from stitching letters scattered across a long unrelated word.
 */
function isFuzzyWord(query: string, valueWord: string): boolean {
  let queryIndex = 0;
  let skips = 0;
  for (const char of valueWord) {
    if (char === query[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === query.length) return true;
    } else if (queryIndex > 0) {
      skips += 1;
      if (skips > MAX_FUZZY_SKIPS) return false;
    }
  }
  return false;
}

export function isSetupSearchMatch(query: string, value: string): boolean {
  const normalizedQuery = normalize(query);
  const normalizedValue = normalize(value);
  if (normalizedQuery.length < 3) return false;
  if (normalizedValue.includes(normalizedQuery)) return true;

  const queryWords = words(normalizedQuery);
  const valueWords = words(normalizedValue);
  return queryWords.length > 0 && queryWords.every((queryWord) =>
    valueWords.some((valueWord) => isFuzzyWord(queryWord, valueWord)),
  );
}
