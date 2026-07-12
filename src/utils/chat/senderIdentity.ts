// ---------------------------------------------------------------------------
// Pure typed helpers for resolving chat-message sender identity and merging
// badge arrays by set ID.  No dependencies on DOM, SolidJS, or runtime
// services – all functions are deterministic and fully testable.
// ---------------------------------------------------------------------------

export type ResolvedIdentity = {
  displayName: string;
  color: string;
};

export type BadgeInput = {
  setID?: string;
  setId?: string;
  version?: string;
};

export type MessageLike = {
  userId?: string;
  displayName: string;
  color: string;
  badges: string[];
};

/**
 * Resolve a message's display identity by preferring non-empty IRC values
 * over the (potentially stale) GQL cache.
 *
 * Order of precedence:
 *  1. `ircDisplayName` if non-empty
 *  2. `gqlDisplayName` otherwise
 *  Same for `ircColor` vs `gqlColor`.
 */
export function resolveSenderIdentity(
  ircDisplayName: string,
  ircColor: string,
  gqlDisplayName: string,
  gqlColor: string,
): ResolvedIdentity {
  return {
    displayName: ircDisplayName || gqlDisplayName,
    color: ircColor || gqlColor,
  };
}

/**
 * Merge two badge lists by set ID.  GQL values replace IRC values for the
 * same set ID; GQL sets that do not appear in the IRC list are appended.
 *
 * Rules
 * -----
 * - Input IRC badges are strings of the form `"setId/version"`.
 * - Output preserves the order of IRC entries, replacing versions in place.
 * - New GQL sets are appended in iteration order after all IRC entries.
 * - GQL entries with an empty `setId` or `version` are silently skipped.
 */
export function mergeBadgesBySetId(
  ircBadges: readonly string[],
  gqlBadges: readonly BadgeInput[],
): string[] {
  const result: string[] = [];
  const setIndex = new Map<string, number>();

  for (const badge of ircBadges) {
    const slashIdx = badge.indexOf("/");
    if (slashIdx === -1) continue;
    const setId = badge.slice(0, slashIdx);
    const version = badge.slice(slashIdx + 1);
    if (!setId || !version) continue;
    const existingIndex = setIndex.get(setId);
    if (existingIndex !== undefined) {
      result[existingIndex] = badge;
    } else {
      setIndex.set(setId, result.length);
      result.push(badge);
    }
  }

  for (const badge of gqlBadges) {
    const setId = badge.setID || badge.setId || "";
    const version = badge.version || "";
    if (!setId || !version) continue;

    const idx = setIndex.get(setId);
    if (idx !== undefined) {
      result[idx] = `${setId}/${version}`;
    } else {
      setIndex.set(setId, result.length);
      result.push(`${setId}/${version}`);
    }
  }

  return result;
}


