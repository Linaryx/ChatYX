import { describe, expect, test } from "bun:test";
import { RteCosmeticsService } from "../src/services/chat/rteCosmeticsService";

function sequenceFetch(responses: Array<Response | Error>) {
  const urls: string[] = [];
  let index = 0;
  const fetch = async (url: string): Promise<Response> => {
    urls.push(url);
    const result = responses[index];
    index += 1;
    if (result instanceof Error) throw result;
    return result ?? new Response(null, { status: 500 });
  };
  return { fetch, urls };
}

describe("RTE cosmetics service", () => {
  test("caches an empty Reyohoho badge response per user", async () => {
    const { fetch, urls } = sequenceFetch([new Response(null, { status: 204 })]);
    const service = new RteCosmeticsService(fetch);

    expect(await service.loadBadge("123")).toBeNull();
    expect(await service.loadBadge("123")).toBeNull();
    expect(urls).toEqual([
      "https://ext.rte.net.ru:8443/api/badge-users/123",
    ]);
  });

  test("parses a valid HTTPS Reyohoho badge defensively", async () => {
    const { fetch } = sequenceFetch([
      Response.json({
        data: {
          badge_url: "https://cdn.example.com/reyohoho.webp",
          tooltip: "Reyohoho",
        },
      }),
    ]);
    const service = new RteCosmeticsService(fetch);

    expect(await service.loadBadge("123")).toEqual({
      source: "rte-reyohoho",
      description: "Reyohoho",
      url: "https://cdn.example.com/reyohoho.webp",
    });
  });

  test("soft-fails malformed badge data without caching the failure", async () => {
    const { fetch, urls } = sequenceFetch([
      Response.json({ badge_url: "javascript:alert(1)" }),
      Response.json({ url: "https://cdn.example.com/reyohoho.webp" }),
    ]);
    const service = new RteCosmeticsService(fetch);

    expect(await service.loadBadge("123")).toBeNull();
    expect(await service.loadBadge("123")).not.toBeNull();
    expect(urls).toHaveLength(2);
  });

  test("caches the observed empty paint schema", async () => {
    const { fetch, urls } = sequenceFetch([
      Response.json({ twitch_id: "123", paint_id: null, has_paint: false }),
    ]);
    const service = new RteCosmeticsService(fetch);

    expect(await service.loadPaint("123")).toBeNull();
    expect(await service.loadPaint("123")).toBeNull();
    expect(urls).toEqual(["https://ext.rte.net.ru:8443/api/paint/123"]);
  });

  test("converts a valid custom paint into the existing renderer shape", async () => {
    const { fetch } = sequenceFetch([
      Response.json({
        twitch_id: "123",
        paint_id: "paint-1",
        has_paint: true,
        paint: {
          id: "paint-1",
          name: "Sunset",
          function: "LINEAR_GRADIENT",
          color: 4294967295,
          angle: 90,
          stops: [
            { at: 0, color: 4278190335 },
            { at: 1, color: 16711935 },
          ],
          shadows: [
            { x_offset: 1, y_offset: 2, radius: 3, color: 255 },
          ],
        },
      }),
    ]);
    const service = new RteCosmeticsService(fetch);

    expect(await service.loadPaint("123")).toEqual({
      id: "paint-1",
      name: "Sunset",
      function: "LINEAR_GRADIENT",
      color: 4294967295,
      angle: 90,
      stops: [
        { at: 0, color: 4278190335 },
        { at: 1, color: 16711935 },
      ],
      shadows: [{ x_offset: 1, y_offset: 2, radius: 3, color: 255 }],
    });
  });

  test("soft-fails malformed JSON and retries later", async () => {
    const { fetch, urls } = sequenceFetch([
      new Response("{", { headers: { "content-type": "application/json" } }),
      Response.json({ twitch_id: "123", paint_id: null, has_paint: false }),
    ]);
    const service = new RteCosmeticsService(fetch);

    expect(await service.loadPaint("123")).toBeNull();
    expect(await service.loadPaint("123")).toBeNull();
    expect(urls).toHaveLength(2);
  });

  test("soft-fails network errors without exposing them", async () => {
    const { fetch } = sequenceFetch([new TypeError("offline")]);
    const service = new RteCosmeticsService(fetch);

    expect(await service.loadBadge("123")).toBeNull();
  });
});
