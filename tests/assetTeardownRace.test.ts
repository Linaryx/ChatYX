import { afterEach, describe, expect, test } from "bun:test";
import { badgeService } from "../src/services/badges/badgeService";
import { emoteService } from "../src/services/chat/assets/emoteService";
import { sevenTVCosmeticsService } from "../src/services/chat/seven-tv/cosmeticsService";
import { chatFeatureIntegration } from "../src/services/chat/chatFeatureIntegration";
import { ffzapBadgeService } from "../src/services/badges/ffzapBadgeService";
import { twitchGqlService } from "../src/services/chat/twitch/twitchGqlService";
import { networkClient } from "../src/services/network/networkClient";

/**
 * Teardown is only an ownership boundary if work that started under the old
 * runtime cannot commit into shared state after the new one has started. These
 * tests hold a response open, reset the store, and only then let it resolve.
 */

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const originalRequest = networkClient.request;
let requests: string[] = [];

function stubRequests(handler: (target: string) => Promise<Response>) {
  requests = [];
  networkClient.request = ((target: string) => {
    requests.push(target);
    return handler(target);
  }) as typeof networkClient.request;
}

afterEach(() => {
  networkClient.request = originalRequest;
  emoteService.reset();
  badgeService.reset();
  sevenTVCosmeticsService.clearAllCaches();
  for (const username of Object.keys(sevenTVCosmeticsService.getUserCosmetics())) {
    delete sevenTVCosmeticsService.getUserCosmetics()[username];
  }
  for (const id of Object.keys(sevenTVCosmeticsService.getCosmetics())) {
    delete sevenTVCosmeticsService.getCosmetics()[id];
  }
});

describe("emote store teardown", () => {
  test("a channel load that resolves after reset does not repopulate the store", async () => {
    const sevenTvUser = deferred<Response>();
    stubRequests((target) =>
      target.includes("/v3/users/twitch/123")
        ? sevenTvUser.promise
        : Promise.resolve(jsonResponse({})),
    );

    const load = emoteService.loadEmotes("123", "channel");
    await Promise.resolve();

    emoteService.reset();
    sevenTvUser.resolve(
      jsonResponse({
        emote_set: {
          emotes: [
            {
              name: "ProbeEmote",
              data: {
                id: "emote-1",
                name: "ProbeEmote",
                flags: 0,
                host: {
                  url: "//cdn.7tv.app/emote/emote-1",
                  files: [{ format: "WEBP", name: "4x.webp", width: 32, height: 32 }],
                },
              },
            },
          ],
        },
      }),
    );
    await load;

    expect(emoteService.getEmote("ProbeEmote", "123")).toBeUndefined();
    expect(emoteService.getEmoteData().channelEmotes).toEqual({});
    expect(emoteService.getEmoteData().emotes).toEqual({});
  });

  test("a global load that resolves after reset does not mark the store loaded", async () => {
    const sevenTvGlobal = deferred<Response>();
    stubRequests((target) =>
      target.includes("/emote-sets/global")
        ? sevenTvGlobal.promise
        : Promise.resolve(jsonResponse({})),
    );

    const load = emoteService.loadEmotes("", "channel");
    await Promise.resolve();

    emoteService.reset();
    sevenTvGlobal.resolve(
      jsonResponse({
        emotes: [
          {
            name: "GlobalProbe",
            data: {
              id: "global-1",
              name: "GlobalProbe",
              flags: 0,
              host: {
                url: "//cdn.7tv.app/emote/global-1",
                files: [{ format: "WEBP", name: "4x.webp", width: 32, height: 32 }],
              },
            },
          },
        ],
      }),
    );
    await load;

    expect(emoteService.getEmoteData().emotes).toEqual({});
  });
});

describe("badge store teardown", () => {
  test("a channel badge load that resolves after reset does not repopulate the store", async () => {
    const channelBadges = deferred<Response>();
    let channelRequested = false;
    stubRequests((target) => {
      if (target.includes("badges/channel")) {
        channelRequested = true;
        return channelBadges.promise;
      }
      return Promise.resolve(jsonResponse({}));
    });

    const load = badgeService.loadBadges("channel", "123");
    while (!channelRequested) await new Promise((resolve) => setTimeout(resolve, 0));

    badgeService.reset();
    channelBadges.resolve(
      jsonResponse({
        data: [
          {
            set_id: "probe",
            versions: [
              { id: "9", image_url_4x: "https://example.test/probe-9.png" },
            ],
          },
        ],
      }),
    );
    await load;

    expect(badgeService.getTwitchBadge("probe", "9")).toBeUndefined();
  });

  test("a third-party badge load that resolves after reset does not repopulate the store", async () => {
    const thirdParty = deferred<Response>();
    let thirdPartyRequested = false;
    stubRequests((target) => {
      if (target.includes("api.ffzap.com/v1/supporters")) {
        thirdPartyRequested = true;
        return thirdParty.promise;
      }
      return Promise.resolve(jsonResponse({}));
    });

    const load = badgeService.loadBadges("channel", "123");
    while (!thirdPartyRequested) await new Promise((resolve) => setTimeout(resolve, 0));

    badgeService.reset();
    thirdParty.resolve(
      jsonResponse([
        {
          id: "42",
          tier: "2",
          badge_color: "#fff",
        },
      ]),
    );
    await load;
    // `loadBadges` fires the third-party load without awaiting it, so the test
    // has to let the stale promise chain drain before asserting.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(badgeService.getBadgeData().ffzapBadges).toEqual([]);
  });

  test("a user badge lookup that resolves after reset does not commit into the store", async () => {
    const sender = deferred<{ displayBadges: Array<{ setID: string; version: string; image4x: string }> }>();
    const originalLoadSender = twitchGqlService.loadSender;
    let senderRequested = false;
    (twitchGqlService as unknown as { loadSender: unknown }).loadSender = () => {
      senderRequested = true;
      return sender.promise;
    };
    stubRequests(() => Promise.resolve(jsonResponse({})));

    try {
      const lookup = badgeService.loadUserBadges("viewer", "7", true);
      while (!senderRequested) await new Promise((resolve) => setTimeout(resolve, 0));

      badgeService.reset();
      sender.resolve({
        displayBadges: [
          {
            setID: "probe",
            version: "9",
            image4x: "https://example.test/probe-9.png",
          },
        ],
      });
      await lookup;

      expect(badgeService.getTwitchBadge("probe", "9")).toBeUndefined();
      expect(badgeService.getUserBadges("viewer")).toEqual([]);
    } finally {
      (twitchGqlService as unknown as { loadSender: unknown }).loadSender = originalLoadSender;
    }
  });
});

describe("7TV cosmetics teardown", () => {
  test("the generated paint stylesheet is removed with the runtime", () => {
    const head: Array<{ id: string; remove: () => void; sheet: unknown }> = [];
    const previousDocument = (globalThis as { document?: unknown }).document;

    const makeElement = () => {
      const element = {
        id: "",
        sheet: { cssRules: [], insertRule: () => {}, deleteRule: () => {} },
        remove: () => {
          const index = head.indexOf(element);
          if (index >= 0) head.splice(index, 1);
        },
      };
      return element;
    };

    (globalThis as unknown as { document: unknown }).document = {
      createElement: makeElement,
      head: { appendChild: (element: unknown) => head.push(element as never) },
      querySelectorAll: (selector: string) =>
        selector.includes("chatyx-seventv-paint-styles")
          ? head.filter((element) => element.id === "chatyx-seventv-paint-styles")
          : [],
    };

    try {
      sevenTVCosmeticsService.addCosmetic("paint-1", {
        function: "LINEAR_GRADIENT",
        color: 0xffffffff,
        stops: [
          { at: 0, color: 0xff0000ff },
          { at: 1, color: 0x00ff00ff },
        ],
      });
      sevenTVCosmeticsService.addUserCosmetic("probeuser", "paint-1");

      expect(sevenTVCosmeticsService.calculatePaintCSS("probeuser")).toBeTruthy();
      expect(head).toHaveLength(1);

      // What `ChatPresentationService.cleanup()` does on runtime teardown.
      sevenTVCosmeticsService.clearAllCaches();
      sevenTVCosmeticsService.disposeStylesheet();
      expect(head).toHaveLength(0);

      // The reference was dropped as well, so the next render rebuilds the
      // element instead of writing into the detached sheet.
      expect(sevenTVCosmeticsService.calculatePaintCSS("probeuser")).toBeTruthy();
      expect(head).toHaveLength(1);
    } finally {
      if (previousDocument === undefined) {
        Reflect.deleteProperty(globalThis, "document");
      } else {
        (globalThis as unknown as { document: unknown }).document = previousDocument;
      }
    }
  });

  test("a channel cosmetics load that resolves after the caches were cleared is dropped", async () => {
    const channelUser = deferred<Response>();
    stubRequests(() => channelUser.promise);

    const load = sevenTVCosmeticsService.loadCosmetics("123");
    await Promise.resolve();

    // What `ChatPresentationService.cleanup()` does on runtime teardown.
    sevenTVCosmeticsService.clearAllCaches();
    channelUser.resolve(
      jsonResponse({
        username: "probeuser",
        user: { style: { paint_id: "paint-1" } },
      }),
    );
    await load;

    expect(sevenTVCosmeticsService.getPaintsForUser("probeuser")).toEqual([]);

    // The channel is not marked as loaded either, so the next runtime refetches.
    stubRequests(() => Promise.resolve(jsonResponse({})));
    await sevenTVCosmeticsService.loadCosmetics("123");
    expect(requests).toHaveLength(1);
  });
});

describe("chat feature integration teardown", () => {
  test("an initialization that outlives destroy does not claim the integration", async () => {
    const originalLoadBadges = ffzapBadgeService.loadBadges;
    const badges = deferred<void>();
    let loads = 0;
    ffzapBadgeService.loadBadges = () => {
      loads += 1;
      return badges.promise;
    };
    stubRequests(() => Promise.resolve(jsonResponse({})));

    try {
      // A non-numeric channel keeps the 7TV EventAPI out of the test.
      const initialization = chatFeatureIntegration.initialize("channel");
      await Promise.resolve();

      chatFeatureIntegration.destroy();
      badges.resolve();
      await initialization;

      // The stale initialization must not have marked the integration as
      // initialized, so a second one runs its loaders again.
      const second = chatFeatureIntegration.initialize("channel");
      await Promise.resolve();
      expect(loads).toBe(2);

      chatFeatureIntegration.destroy();
      await second;
    } finally {
      ffzapBadgeService.loadBadges = originalLoadBadges;
    }
  });
});
