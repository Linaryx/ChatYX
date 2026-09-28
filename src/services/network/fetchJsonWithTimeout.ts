/**
 * Fetches a URL, parses the JSON body, and aborts after `timeoutMs`.
 *
 * Non-2xx responses throw, so callers can treat every failure — network,
 * timeout and HTTP status — through the same catch path.
 */
export async function fetchJsonWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = 8000,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}
