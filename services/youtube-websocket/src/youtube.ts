import { Innertube, Log } from "youtubei.js/web";

Log.setLevel(Log.Level.ERROR);

let cachedInnertube: Innertube | null = null;
const proxyUrl = process.env.YOUTUBE_PROXY_URL ?? "";

function proxiedFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (!proxyUrl) return fetch(input, init);

  return fetch(input, {
    ...init,
    proxy: proxyUrl,
  } as RequestInit & { proxy: string });
}

export async function getInnertube(): Promise<Innertube> {
  cachedInnertube ??= await Innertube.create({
    fetch: proxiedFetch as typeof fetch,
    retrieve_player: false,
  });
  return cachedInnertube;
}

export function getYouTubeProxyUrl() {
  return proxyUrl;
}

export function normalizeChannelIdentifier(raw: string): string {
  const trimmed = raw.trim();
  if (/^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) return trimmed;
  return `@${trimmed.replace(/^@/, "")}`;
}

export function isVideoId(raw: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(raw);
}

export async function resolveLiveVideoIds(channelIdentifier: string) {
  const youtube = await getInnertube();
  const niceId = normalizeChannelIdentifier(channelIdentifier);
  const streamData = await youtube
    .resolveURL(`https://www.youtube.com/${niceId}/live`)
    .catch(() => null);
  const primaryVideoId = streamData?.payload?.videoId;

  if (!primaryVideoId) {
    throw new Error(`Could not find a live stream for ${niceId}`);
  }

  const additionalVideoIds: string[] = [];

  try {
    let channelId = /^UC[A-Za-z0-9_-]{22}$/.test(niceId) ? niceId : "";
    if (!channelId) {
      const videoInfo = await youtube.getInfo(primaryVideoId);
      channelId = videoInfo.secondary_info?.owner?.author?.id || "";
    }

    if (channelId) {
      const channel = await youtube.getChannel(channelId);
      if (channel.has_live_streams) {
        const liveTab = await channel.getLiveStreams();
        for (const video of liveTab.videos as any[]) {
          if (video?.is_live && video.id && video.id !== primaryVideoId) {
            additionalVideoIds.push(String(video.id));
          }
        }
      }
    }
  } catch (error) {
    console.warn("[youtube-ws] Failed to detect additional live streams", error);
  }

  return [primaryVideoId, ...additionalVideoIds];
}
