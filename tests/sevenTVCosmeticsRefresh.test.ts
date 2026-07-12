import { afterEach, describe, expect, test } from "bun:test";
import { SevenTVCosmeticsService } from "../src/services/chat/sevenTVCosmeticsService";
import { SevenTVEventApiService } from "../src/services/chat/sevenTVEventApi";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("7TV cosmetics refresh", () => {
  test("downloads the paint catalog and current user assignments", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://7tv.io/v3/gql") {
        return Response.json({
          data: {
            cosmetics: {
              paints: [
                {
                  id: "paint-1",
                  name: "Test Paint",
                  function: "LINEAR_GRADIENT",
                  color: 0xffffffff,
                  angle: 90,
                  repeat: false,
                  shape: "circle",
                  image_url: "",
                  stops: [],
                  shadows: [],
                },
              ],
            },
          },
        });
      }
      if (url === "https://7tv.io/v3/users/twitch/123") {
        return Response.json({ user: { style: { paint_id: "paint-1" } } });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const service = new SevenTVCosmeticsService();
    await service.reloadCosmetics([{ username: "Alice", userId: "123" }]);

    expect(service.getCosmetics()["paint-1"]?.name).toBe("Test Paint");
    expect(service.getUserCosmetics().alice).toEqual(["paint-1"]);
  });

  test("replaces paints in EventAPI while preserving badges", () => {
    const api = new SevenTVEventApiService();
    api.cosmetics.set("old-paint", { _kind: "PAINT" });
    api.cosmetics.set("badge-1", { _kind: "BADGE" });
    api.userCosmetics.set("alice", ["old-paint", "badge-1"]);

    api.replacePaintCosmetics(
      { "paint-1": { id: "paint-1", name: "New Paint" } },
      { alice: ["paint-1"] },
    );

    expect(api.cosmetics.has("old-paint")).toBeFalse();
    expect(api.cosmetics.has("badge-1")).toBeTrue();
    expect(api.getUserPaint("alice")?.id).toBe("paint-1");
    expect(api.userCosmetics.get("alice")).toEqual(["badge-1", "paint-1"]);
  });
});
