const RTE_PROXY_BASE = "https://ext.rte.net.ru:8443/";

const RTE_PROXY_HTTP_HOSTS: Record<string, true> = {
  "7tv.io": true,
  "cdn.7tv.app": true,
  "api.betterttv.net": true,
  "cdn.betterttv.net": true,
  "api.frankerfacez.com": true,
  "cdn.frankerfacez.com": true,
  "api.ffzap.com": true,
};

const RTE_PROXY_WS_HOSTS: Record<string, true> = {
  "events.7tv.io": true,
};

let rteProxyEnabled = false;

export function setRteProxyEnabled(enabled: boolean): void {
  rteProxyEnabled = enabled;
}

function isPlainUrl(url: URL, protocol: string): boolean {
  return (
    url.protocol === protocol &&
    url.port === "" &&
    url.username === "" &&
    url.password === ""
  );
}

export function adaptRteProxyUrl(target: string, enabled: boolean = rteProxyEnabled): string {
  if (!enabled || !URL.canParse(target)) return target;

  const url = new URL(target);
  const isAllowed = isPlainUrl(url, "https:") && RTE_PROXY_HTTP_HOSTS[url.hostname];

  return isAllowed ? `${RTE_PROXY_BASE}${target}` : target;
}

export function adaptRteProxyWsUrl(target: string, enabled: boolean = rteProxyEnabled): string {
  if (!enabled || !URL.canParse(target)) return target;

  const url = new URL(target);
  const isAllowed = isPlainUrl(url, "wss:") && RTE_PROXY_WS_HOSTS[url.hostname];

  return isAllowed ? `${RTE_PROXY_BASE}${target}` : target;
}

/**
 * Fetch through the RTE proxy first; on proxy failure (or CORS rejection of
 * the original host) fall back to the direct URL. Only proxy-eligible hosts
 * are touched, everything else goes straight to the network.
 */
export async function fetchWithRteProxy(
  target: string,
  init?: RequestInit,
  enabled: boolean = rteProxyEnabled,
): Promise<Response> {
  if (!enabled) return fetch(target, init);

  const proxied = adaptRteProxyUrl(target, true);
  if (proxied === target) return fetch(target, init);

  try {
    const response = await fetch(proxied, init);
    // The proxy signals upstream problems with 5xx; retry direct in that case.
    if (response.status >= 500) {
      return fetch(target, init);
    }
    return response;
  } catch {
    return fetch(target, init);
  }
}
