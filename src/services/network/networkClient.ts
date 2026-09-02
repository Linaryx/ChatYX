import {
  canRouteThroughRte,
  requestThroughRte,
  rewriteRteHttpUrl,
  rewriteRteWebSocketUrl,
  setRteProxyEnabled,
} from "./rteProxyTransport";

export type NetworkRoute = "direct" | "rte" | "rte-required";
export type NetworkRequestOptions = {
  route?: NetworkRoute;
  init?: RequestInit;
};

export const networkClient = {
  request(
    target: string,
    options: NetworkRequestOptions = {},
  ): Promise<Response> {
    const route = options.route ?? "direct";
    const init = options.init;
    if (route === "direct") return fetch(target, init);

    if (route === "rte-required" && !canRouteThroughRte(target)) {
      return Promise.reject(new Error(`RTE route is not available for ${target}`));
    }

    return requestThroughRte(
      target,
      init,
      route === "rte-required" ? true : undefined,
    );
  },

  resolveHttpUrl(target: string, route: NetworkRoute = "direct"): string {
    if (route === "direct") return target;
    const rewritten = rewriteRteHttpUrl(target, route === "rte-required" ? true : undefined);
    if (route === "rte-required" && rewritten === target) {
      throw new Error(`RTE route is not available for ${target}`);
    }
    return rewritten;
  },

  resolveWebSocketUrl(target: string, route: NetworkRoute = "direct"): string {
    if (route === "direct") return target;
    const rewritten = rewriteRteWebSocketUrl(target, route === "rte-required" ? true : undefined);
    if (route === "rte-required" && rewritten === target) {
      throw new Error(`RTE route is not available for ${target}`);
    }
    return rewritten;
  },
};

export { canRouteThroughRte, setRteProxyEnabled };
