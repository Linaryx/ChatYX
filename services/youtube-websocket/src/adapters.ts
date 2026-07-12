type YouTubeRun =
  | { text: string }
  | { emoji: { image: Array<{ url: string; width?: number; height?: number }> } };

type YouTubeBadge = {
  url: string;
  tooltip: string;
};

function normalizeDimension(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function normalizeRuns(runs: any[]): YouTubeRun[] {
  return runs
    .map((run) => {
      if (run?.emoji) {
        const images = Array.isArray(run.emoji.image)
          ? run.emoji.image
              .map((image: any) => ({
                url: String(image?.url || ""),
                width: normalizeDimension(image?.width),
                height: normalizeDimension(image?.height),
              }))
              .filter((image: { url: string }) => image.url)
          : [];
        return { emoji: { image: images } };
      }

      const text = String(run?.text || "");
      return text ? { text } : null;
    })
    .filter((run): run is YouTubeRun => run !== null);
}

function normalizeBadges(author: any): YouTubeBadge[] {
  if (!Array.isArray(author?.badges)) return [];

  return author.badges
    .map((badge: any) => {
      if (badge?.type !== "LiveChatAuthorBadge") return null;

      const url = String(badge.custom_thumbnail?.[0]?.url || "");
      if (!url) return null;

      return {
        url,
        tooltip: String(badge.tooltip || "YouTube badge"),
      };
    })
    .filter((badge: YouTubeBadge | null): badge is YouTubeBadge => badge !== null);
}

function normalizeAuthor(author: any) {
  return {
    name: String(author?.name || "unknown"),
    id: String(author?.id || ""),
    verified: Boolean(author?.is_verified),
    moderator: Boolean(author?.is_moderator),
    badges: normalizeBadges(author),
  };
}

export function textMessageToEvent(item: any) {
  const runs = normalizeRuns(item?.message?.runs || []);

  return {
    type: "message",
    id: String(item?.id || ""),
    message: String(item?.message?.text || ""),
    runs,
    author: normalizeAuthor(item?.author),
    unix: Number(item?.timestamp || Date.now()),
  };
}

export function paidMessageToEvent(item: any) {
  const message = item?.message;
  const hasMessage =
    typeof message?.isEmpty === "function"
      ? !message.isEmpty()
      : Boolean(message?.text);

  return {
    type: "superchat",
    id: String(item?.id || ""),
    purchase_amount: String(item?.purchase_amount || ""),
    hasMessage,
    message: String(message?.text || ""),
    runs: normalizeRuns(message?.runs || []),
    author: normalizeAuthor(item?.author),
    unix: Number(item?.timestamp || Date.now()),
  };
}
