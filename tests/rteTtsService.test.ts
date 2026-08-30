import { describe, expect, test } from "bun:test";
import {
  RteTtsService,
  buildAzureTtsUrl,
  buildChatIsTtsUrl,
  type RteTtsAudio,
  type RteTtsRequest,
} from "../src/services/chat/rteTtsService";

function deferred<T>() {
  let resolve = (_value: T): void => {};
  let reject = (_error: Error): void => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class FakeAudio implements RteTtsAudio {
  volume = 1;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pauseCalls = 0;
  playResult: Promise<void> = Promise.resolve();

  play(): Promise<void> {
    return this.playResult;
  }

  pause(): void {
    this.pauseCalls += 1;
  }

  end(): void {
    this.onended?.();
  }

  fail(): void {
    this.onerror?.();
  }
}

function request(id: string, overrides: Partial<RteTtsRequest> = {}): RteTtsRequest {
  return {
    provider: "azure",
    messageId: id,
    userId: `user-${id}`,
    username: `viewer-${id}`,
    text: `text ${id}`,
    ...overrides,
  };
}

function createHarness(
  fetcher?: (url: string, init: RequestInit) => Promise<Response>,
) {
  const urls: string[] = [];
  const inits: RequestInit[] = [];
  const audios: FakeAudio[] = [];
  const revoked: string[] = [];
  let objectUrlIndex = 0;
  const service = new RteTtsService({
    fetch: async (url, init) => {
      urls.push(url);
      inits.push(init);
      return fetcher
        ? fetcher(url, init)
        : new Response(new Blob(["mp3"], { type: "audio/mpeg" }), {
            headers: { "content-type": "audio/mpeg" },
          });
    },
    createAudio: () => {
      const audio = new FakeAudio();
      audios.push(audio);
      return audio;
    },
    createObjectUrl: () => `blob:rte-${++objectUrlIndex}`,
    revokeObjectUrl: (url) => revoked.push(url),
  });
  service.updateConfig({
    azureEnabled: true,
    chatisEnabled: false,
    azureVoice: "ru-RU-DmitryNeural",
    chatisVoice: "Brian",
    volume: 0.5,
    maxLength: 400,
  });
  return { service, urls, inits, audios, revoked };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function settleUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 20 && !predicate(); index += 1) {
    await Promise.resolve();
  }
}

describe("RTE Azure TTS", () => {
  test("encodes the exact proxied Azure request URL", () => {
    expect(buildAzureTtsUrl("Привет & hello?", "en-US-GuyNeural")).toBe(
      "https://ext.rte.net.ru:8443/https://chatsemban.justdavi.dev/api/tts?text=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82%20%26%20hello%3F&voice=en-US-GuyNeural",
    );
  });

  test("plays accepted requests in FIFO order", async () => {
    const firstFetch = deferred<Response>();
    const { service, urls, audios } = createHarness((url) =>
      url.includes("text=text%20one")
        ? firstFetch.promise
        : Promise.resolve(
            new Response(new Blob(["mp3"], { type: "audio/mpeg" }), {
              headers: { "content-type": "audio/mpeg" },
            }),
          ),
    );

    expect(service.enqueue(request("one"))).toEqual({ kind: "accepted" });
    expect(service.enqueue(request("two"))).toEqual({ kind: "accepted" });
    expect(urls).toHaveLength(1);

    firstFetch.resolve(
      new Response(new Blob(["mp3"], { type: "audio/mpeg" }), {
        headers: { "content-type": "audio/mpeg" },
      }),
    );
    await settleUntil(() => audios.length === 1);
    expect(audios[0]?.volume).toBe(0.5);
    expect(urls).toHaveLength(1);

    audios[0]?.end();
    await settle();
    expect(urls[1]).toContain("text=text%20two");
  });

  test("bounds the active and pending FIFO to twenty requests", () => {
    const blocked = deferred<Response>();
    const { service } = createHarness(() => blocked.promise);

    const results = Array.from({ length: 21 }, (_, index) =>
      service.enqueue(request(String(index))),
    );

    expect(results.slice(0, 20).every((result) => result.kind === "accepted")).toBeTrue();
    expect(results[20]).toEqual({ kind: "rejected", error: "queue_full" });
    expect(service.getQueueLength()).toBe(20);
  });

  test("uses Unicode code points for the configured text limit", () => {
    const { service } = createHarness();
    service.updateConfig({
      azureEnabled: true,
      chatisEnabled: false,
      azureVoice: "ru-RU-DmitryNeural",
      chatisVoice: "Brian",
      volume: 1,
      maxLength: 2,
    });

    expect(service.enqueue(request("emoji", { text: "😀😀" }))).toEqual({
      kind: "accepted",
    });
    expect(service.enqueue(request("long", { text: "😀😀😀" }))).toEqual({
      kind: "rejected",
      error: "text_too_long",
    });
  });

  test("skip cleans the current audio and advances to the next request", async () => {
    const { service, audios, revoked, urls } = createHarness();
    service.enqueue(request("one"));
    service.enqueue(request("two"));
    await settle();

    service.skip();
    await settle();

    expect(audios[0]?.pauseCalls).toBe(1);
    expect(revoked).toEqual(["blob:rte-1"]);
    expect(urls[1]).toContain("text=text%20two");
  });

  test("clear removes pending requests while stop also cleans current audio", async () => {
    const { service, audios, revoked, urls } = createHarness();
    service.enqueue(request("one"));
    service.enqueue(request("two"));
    await settle();

    service.clear();
    audios[0]?.end();
    await settle();
    expect(urls).toHaveLength(1);

    service.enqueue(request("three"));
    await settle();
    service.stop();
    expect(audios[1]?.pauseCalls).toBe(1);
    expect(revoked).toContain("blob:rte-2");
    expect(service.getQueueLength()).toBe(0);
  });

  test("cancels queued or current speech by message and user", async () => {
    const { service, audios, urls } = createHarness();
    service.enqueue(request("one", { username: "Alice", userId: "10" }));
    service.enqueue(request("two", { username: "Bob", userId: "20" }));
    service.enqueue(request("three", { username: "Alice", userId: "10" }));
    await settle();

    service.cancelMessage("two");
    service.cancelUser({ username: "alice" });
    await settle();

    expect(audios[0]?.pauseCalls).toBe(1);
    expect(urls).toHaveLength(1);
    expect(service.getQueueLength()).toBe(0);
  });

  test("advances after HTTP and audio playback errors", async () => {
    let calls = 0;
    const { service, audios, urls } = createHarness(async () => {
      calls += 1;
      if (calls === 1) return new Response(null, { status: 503 });
      return new Response(new Blob(["mp3"], { type: "audio/mpeg" }), {
        headers: { "content-type": "audio/mpeg" },
      });
    });
    service.enqueue(request("one"));
    service.enqueue(request("two"));
    service.enqueue(request("three"));
    await settle();

    expect(urls[1]).toContain("text=text%20two");
    await settleUntil(() => audios.length === 1);
    audios[0]?.fail();
    await settleUntil(() => urls.length === 3);
    expect(urls[2]).toContain("text=text%20three");
    expect(service.getLastError()?.code).toBe("audio_failed");
  });

  test("destroy is idempotent and revokes the current object URL", async () => {
    const { service, audios, revoked } = createHarness();
    service.enqueue(request("one"));
    await settle();

    service.destroy();
    service.destroy();

    expect(audios[0]?.pauseCalls).toBe(1);
    expect(revoked).toEqual(["blob:rte-1"]);
    expect(service.getState()).toEqual({ kind: "idle" });
  });
});

describe("RTE ChatIS TTS", () => {
  test("posts a text/plain JSON request and plays its transient Streamlabs URL", async () => {
    const { service, urls, inits, audios, revoked } = createHarness(async () =>
      new Response(
        JSON.stringify({
          success: true,
          speak_url: "https://polly.streamlabs.com/v1/speech?signature=redacted",
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    service.updateConfig({
      azureEnabled: false,
      chatisEnabled: true,
      azureVoice: "ru-RU-DmitryNeural",
      chatisVoice: "Brian",
      volume: 0.25,
      maxLength: 400,
    });

    expect(
      service.enqueue({ ...request("chatis"), provider: "chatis", text: "hello" }),
    ).toEqual({ kind: "accepted" });
    await settleUntil(() => audios.length === 1);

    expect(urls).toEqual([buildChatIsTtsUrl()]);
    expect(inits[0]).toMatchObject({
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ text: "hello", voice: "Brian" }),
      credentials: "omit",
    });
    expect(audios[0]?.volume).toBe(0.25);
    audios[0]?.end();
    expect(revoked).toEqual([]);
  });
});
