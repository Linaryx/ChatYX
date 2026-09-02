const RTE_PROXY_BASE = "https://ext.rte.net.ru:8443/";
const RTE_PROXY_WS_URL = "wss://ext.rte.net.ru:8443/7tv-proxy";
const RTE_PROXY_TIMEOUT_MS = 5000;

const RTE_PROXY_HTTP_HOSTS: Record<string, true> = {
  "7tv.io": true,
  "cdn.7tv.app": true,
  "api.betterttv.net": true,
  "cdn.betterttv.net": true,
  "api.frankerfacez.com": true,
  "cdn.frankerfacez.com": true,
  "api.ffzap.com": true,
  "api.chatterino.com": true,
  "itzalex.github.io": true,
  "chatterinohomies.com": true,
  "fourtf.com": true,
  "cdn.chatterinohomies.com": true,
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

export function rewriteRteHttpUrl(target: string, enabled: boolean = rteProxyEnabled): string {
  if (!enabled || !URL.canParse(target)) return target;

  const url = new URL(target);
  const isAllowed = isPlainUrl(url, "https:") && RTE_PROXY_HTTP_HOSTS[url.hostname];

  return isAllowed ? `${RTE_PROXY_BASE}${target}` : target;
}

export function rewriteRteWebSocketUrl(target: string, enabled: boolean = rteProxyEnabled): string {
  if (!enabled || !URL.canParse(target)) return target;

  const url = new URL(target);
  const isAllowed = isPlainUrl(url, "wss:") && RTE_PROXY_WS_HOSTS[url.hostname];

  return isAllowed ? RTE_PROXY_WS_URL : target;
}

export function canRouteThroughRte(
  target: string,
  protocol: "http" | "websocket" = "http",
): boolean {
  const rewritten = protocol === "websocket"
    ? rewriteRteWebSocketUrl(target, true)
    : rewriteRteHttpUrl(target, true);
  return rewritten !== target;
}

export async function requestThroughRte(
  target: string,
  init?: RequestInit,
  enabled: boolean = rteProxyEnabled,
): Promise<Response> {
  if (!enabled) return fetch(target, init);

  const proxied = rewriteRteHttpUrl(target, true);
  if (proxied === target) return fetch(target, init);

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), RTE_PROXY_TIMEOUT_MS);
  const externalSignal = init?.signal;
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  try {
    return await fetch(proxied, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}
