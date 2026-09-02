import { describe, expect, test } from "bun:test";
import {
  checkDomain,
  getRteProxyDomainChecks,
  type DomainCheckDefinition,
} from "../src/services/diagnostics/domainChecks";
import { canRouteThroughRte } from "../src/services/network/networkClient";

const definition: DomainCheckDefinition = {
  id: "test",
  label: "Test",
  url: "https://example.com/health",
};

describe("domain checks", () => {
  test("selects only RTE-supported endpoints for the proxy status route", () => {
    const checks = getRteProxyDomainChecks();

    expect(checks.length).toBe(4);
    expect(checks.every((check) => canRouteThroughRte(check.url))).toBeTrue();
  });

  test("records successful response status and latency", async () => {
    const result = await checkDomain(
      definition,
      async (_input, init) => {
        expect(init?.cache).toBe("no-store");
        expect(init?.credentials).toBe("omit");
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return new Response(null, { status: 204 });
      },
    );

    expect(result.state).toBe("ok");
    expect(result.status).toBe(204);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeNull();
  });

  test("reports HTTP errors without exposing a network fallback", async () => {
    const result = await checkDomain(definition, async () =>
      new Response(null, { status: 503 }),
    );

    expect(result.state).toBe("error");
    expect(result.status).toBe(503);
    expect(result.error).toBe("HTTP 503");
  });

  test("turns an aborted request into a timeout result", async () => {
    const result = await checkDomain(
      definition,
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
      5,
    );

    expect(result.state).toBe("error");
    expect(result.durationMs).toBeNull();
    expect(result.error).toBe("таймаут > 5 ms");
  });
});
