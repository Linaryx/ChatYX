const RTE_PROXY_BASE = "https://ext.rte.net.ru:8443/";

const RTE_PROXY_HOSTS = new Set([
  "7tv.io",
  "cdn.7tv.app",
  "api.betterttv.net",
  "cdn.betterttv.net",
  "api.frankerfacez.com",
  "cdn.frankerfacez.com",
  "api.ffzap.com",
]);

export function adaptRteProxyUrl(target: string, enabled: boolean): string {
  if (!enabled || !URL.canParse(target)) return target;

  const url = new URL(target);
  const isAllowed =
    url.protocol === "https:" &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    RTE_PROXY_HOSTS.has(url.hostname);

  return isAllowed ? `${RTE_PROXY_BASE}${target}` : target;
}
