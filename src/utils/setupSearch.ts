function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function words(value: string): string[] {
  return normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function isSubsequence(query: string, value: string): boolean {
  let index = 0;
  for (const char of value) {
    if (char === query[index]) index += 1;
    if (index === query.length) return true;
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
    valueWords.some((valueWord) => isSubsequence(queryWord, valueWord)),
  );
}
