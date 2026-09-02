import { canRouteThroughRte } from "~/services/network/networkClient";

export type DomainCheckState = "checking" | "ok" | "slow" | "error";

export type DomainCheckDefinition = {
  id: string;
  label: string;
  url: string;
  kind?: "http" | "websocket";
  init?: RequestInit;
};

export type DomainCheckResult = {
  definition: DomainCheckDefinition;
  state: DomainCheckState;
  durationMs: number | null;
  status: number | null;
  error: string | null;
};

export const DOMAIN_CHECK_TIMEOUT_MS = 8000;
export const DOMAIN_CHECK_SLOW_MS = 1000;

const TWITCH_GQL_CLIENT_ID =
  import.meta.env.VITE_TWITCH_GQL_CLIENT_ID || "kimne78kx3ncx6brgo4mv6wki5h1ko";
const GET_ID_FROM_LOGIN_HASH =
  "94e82a7b1e3c21e186daa73ee2afc4b8f23bade1fbbff6fe8ac133f50a2f58ca";

function twitchProbeInit(): RequestInit {
  return {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_GQL_CLIENT_ID,
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify([
      {
        operationName: "GetIDFromLogin",
        variables: { login: "twitch" },
        extensions: {
          persistedQuery: { version: 1, sha256Hash: GET_ID_FROM_LOGIN_HASH },
        },
      },
    ]),
  };
}

export function getDomainChecks(
  origin =
    typeof window !== "undefined" ? window.location.origin : "https://chat.ruina.team",
): DomainCheckDefinition[] {
  return [
    { id: "chatyx", label: "ChatYX", url: `${origin}/` },
    { id: "twitch", label: "Twitch GQL", url: "https://gql.twitch.tv/gql", init: twitchProbeInit() },
    { id: "seven-tv", label: "7TV API", url: "https://7tv.io/v3/emote-sets/global?limit=1" },
    { id: "bttv", label: "BetterTTV API", url: "https://api.betterttv.net/3/cached/emotes/global" },
    { id: "ffz", label: "FrankerFaceZ API", url: "https://api.frankerfacez.com/v1/set/global" },
    { id: "ivr", label: "IVR API", url: "https://api.ivr.fi/v2/twitch/user?login=twitch" },
    { id: "youtube", label: "YouTube bridge", url: "https://ytwss.ruina.team/health" },
    { id: "chatterino", label: "Chatterino API", url: "https://api.chatterino.com/badges" },
    { id: "homies-1", label: "Homies API 1", url: "https://itzalex.github.io/badges" },
    { id: "homies-2", label: "Homies API 2", url: "https://itzalex.github.io/badges2" },
    { id: "homies-3", label: "Homies API 3", url: "https://chatterinohomies.com/api/badges/list" },
    { id: "chatterino-cdn", label: "Chatterino CDN", url: "https://fourtf.com/chatterino/badges/topd.png", init: { mode: "no-cors" } },
    { id: "homies-cdn", label: "Homies CDN", url: "https://cdn.chatterinohomies.com/badges/90b5d49e-b5fd-4a0a-bc92-6a74408bee82/18.webp", init: { mode: "no-cors" } },
    { id: "itzalex-cdn", label: "itzalex CDN", url: "https://itzalex.github.io/badgesusers/dev/badge.png", init: { mode: "no-cors" } },
    { id: "seven-tv-ws", label: "7TV EventAPI", url: "wss://events.7tv.io/v3", kind: "websocket" },
    { id: "youtube-ws", label: "YouTube bridge WS", url: "wss://ytwss.ruina.team/c/twitch", kind: "websocket" },
    {
      id: "rte-proxy",
      label: "RTE proxy",
      url: "https://ext.rte.net.ru:8443/https://7tv.io/v3/emote-sets/global?limit=1",
    },
  ];
}

export function getRteProxyDomainChecks(): DomainCheckDefinition[] {
  const proxyChecks = getDomainChecks().filter(
    (definition) => canRouteThroughRte(
      definition.url,
      definition.kind === "websocket" ? "websocket" : "http",
    ),
  );

  return [
    ...proxyChecks.map((definition) => ({
      ...definition,
      label: `${definition.label} через RTE`,
    })),
    {
      id: "ffzap",
      label: "FFZ:AP через RTE",
      url: "https://api.ffzap.com/v1/supporters",
    },
  ];
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function checkWebSocket(
  definition: DomainCheckDefinition,
  resolveUrl: (target: string) => string,
  timeoutMs: number,
): Promise<DomainCheckResult> {
  const startedAt = performance.now();

  return new Promise((resolve) => {
    let socket: WebSocket | null = null;
    let settled = false;
    const timeout = globalThis.setTimeout(() => {
      if (socket) socket.close();
      finish("error", `таймаут > ${timeoutMs >= 1000 ? timeoutMs / 1000 + " с" : timeoutMs + " ms"}`);
    }, timeoutMs);

    const finish = (state: DomainCheckState, error: string | null) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      const durationMs = Math.round(performance.now() - startedAt);
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "probe complete");
      resolve({ definition, state: state === "ok" && durationMs >= DOMAIN_CHECK_SLOW_MS ? "slow" : state, durationMs, status: null, error });
    };

    try {
      socket = new WebSocket(resolveUrl(definition.url));
      socket.onopen = () => finish("ok", null);
      socket.onerror = () => finish("error", "сетевой сбой");
      socket.onclose = () => finish("error", "соединение закрыто");
    } catch {
      finish("error", "не удалось открыть WebSocket");
    }
  });
}

function formatTimeout(timeoutMs: number): string {
  return timeoutMs >= 1000
    ? `таймаут > ${timeoutMs / 1000} с`
    : `таймаут > ${timeoutMs} ms`;
}

export async function checkDomain(
  definition: DomainCheckDefinition,
  fetcher: Fetcher = fetch,
  timeoutMs = DOMAIN_CHECK_TIMEOUT_MS,
  webSocketResolver: (target: string) => string = (target) => target,
): Promise<DomainCheckResult> {
  if (definition.kind === "websocket") {
    return checkWebSocket(definition, webSocketResolver, timeoutMs);
  }

  const controller = new AbortController();
  const startedAt = performance.now();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(definition.url, {
      ...definition.init,
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    const durationMs = Math.round(performance.now() - startedAt);
    const successful = response.ok || response.type === "opaque";

    return {
      definition,
      state: !successful
        ? "error"
        : durationMs >= DOMAIN_CHECK_SLOW_MS
          ? "slow"
          : "ok",
      durationMs,
      status: response.type === "opaque" ? null : response.status,
      error: successful ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      definition,
      state: "error",
      durationMs: null,
      status: null,
      error: isAbortError(error) ? formatTimeout(timeoutMs) : "сетевой сбой",
    };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function createCheckingResult(
  definition: DomainCheckDefinition,
): DomainCheckResult {
  return {
    definition,
    state: "checking",
    durationMs: null,
    status: null,
    error: null,
  };
}

export async function checkAllDomains(
  definitions: DomainCheckDefinition[],
  fetcher?: Fetcher,
  webSocketResolver?: (target: string) => string,
): Promise<DomainCheckResult[]> {
  return Promise.all(
    definitions.map((definition) =>
      checkDomain(definition, fetcher, DOMAIN_CHECK_TIMEOUT_MS, webSocketResolver),
    ),
  );
}
