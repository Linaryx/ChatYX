import { canRouteThroughRte } from "~/services/network/networkClient";

export type DomainCheckState = "checking" | "ok" | "slow" | "error";

export type DomainCheckDefinition = {
  id: string;
  label: string;
  url: string;
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
    {
      id: "rte-proxy",
      label: "RTE proxy",
      url: "https://ext.rte.net.ru:8443/https://7tv.io/v3/emote-sets/global?limit=1",
    },
  ];
}

export function getRteProxyDomainChecks(): DomainCheckDefinition[] {
  const proxyChecks = getDomainChecks().filter(
    (definition) => canRouteThroughRte(definition.url),
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

function formatTimeout(timeoutMs: number): string {
  return timeoutMs >= 1000
    ? `таймаут > ${timeoutMs / 1000} с`
    : `таймаут > ${timeoutMs} ms`;
}

export async function checkDomain(
  definition: DomainCheckDefinition,
  fetcher: Fetcher = fetch,
  timeoutMs = DOMAIN_CHECK_TIMEOUT_MS,
): Promise<DomainCheckResult> {
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
): Promise<DomainCheckResult[]> {
  return Promise.all(definitions.map((definition) => checkDomain(definition, fetcher)));
}
