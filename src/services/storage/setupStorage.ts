/**
 * Browser storage adapter for the setup page.
 *
 * Owns every `localStorage` access the setup feature performs, so the route
 * does not talk to the platform API directly and the templates module does not
 * carry its own second copy of the same guards.
 */

/** Minimal storage surface, so tests can inject an in-memory implementation. */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Storage addresses for the persisted setup state.
 *
 * The `config` key is versioned because older payloads are migrated by
 * `config/setupImport`, not by this adapter.
 */
export const SETUP_STORAGE_KEYS = {
  config: "chatyx.setup.config.v1",
  twitchChannel: "chatyx.setup.twitchChannel",
  previewStageBackdrop: "chatyx.setup.previewStageBackdrop",
  previewStageColor: "chatyx.setup.previewStageColor",
} as const;

/** Returns the browser storage, or null when it is missing or blocked. */
export function getSetupStorage(): StorageLike | null {
  if (typeof window === "undefined" || !("localStorage" in window)) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Reads a stored setup value, returning `""` when storage is unavailable. */
export function readStoredSetupValue(
  key: string,
  storage: StorageLike | null = getSetupStorage(),
): string {
  if (!storage) return "";
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
}

/** Writes a trimmed value, or removes the key when the value is empty. */
export function writeStoredSetupValue(
  key: string,
  value: string,
  storage: StorageLike | null = getSetupStorage(),
): void {
  if (!storage) return;
  try {
    const normalized = value.trim();
    if (normalized) {
      storage.setItem(key, normalized);
    } else {
      storage.removeItem(key);
    }
  } catch {
    // Storage can be blocked in private windows; setup must still work.
  }
}
