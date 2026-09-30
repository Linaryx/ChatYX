import { describe, expect, test } from "bun:test";
import { SourceCapacityError, SourceRegistry } from "./source-registry";
import type { ChatSourceEvent, ChatSourceListener, ChatSourceWorker } from "./source-events";

type FakeWorker = ChatSourceWorker & {
  readonly started: number;
  readonly stopped: number;
  emit: (event: ChatSourceEvent) => void;
  fail: (error: Error) => void;
};

function createFakeWorker(): FakeWorker {
  let listener: ChatSourceListener | null = null;
  const worker = {
    started: 0,
    stopped: 0,
    start(next: ChatSourceListener) {
      worker.started += 1;
      listener = next;
      return Promise.resolve();
    },
    stop() {
      worker.stopped += 1;
    },
    emit(event: ChatSourceEvent) {
      listener?.(event);
    },
    fail() {
      listener = null;
    },
  };
  return worker;
}

function failingWorker(): ChatSourceWorker {
  return {
    start() {
      return Promise.reject(new Error("upstream refused"));
    },
    stop() {},
  };
}

const received: ChatSourceEvent[] = [];
function record(): ChatSourceListener {
  return (event) => received.push(event);
}

describe("SourceRegistry", () => {
  test("reads a channel once and fans out to every client", async () => {
    const registry = new SourceRegistry();
    const worker = createFakeWorker();

    const first = await registry.subscribe("kick:xqc", () => worker, record());
    const second = await registry.subscribe("kick:xqc", () => worker, record());

    expect(worker.started).toBe(1);
    expect(registry.sourceCount).toBe(1);
    expect(registry.clientCount).toBe(2);
    expect(registry.has("kick:xqc")).toBe(true);

    worker.emit({ type: "status", platform: "kick", state: "connected" });
    expect(received).toHaveLength(2);

    first();
    expect(worker.stopped).toBe(0);
    second();
    expect(worker.stopped).toBe(1);
    expect(registry.sourceCount).toBe(0);
    expect(registry.clientCount).toBe(0);
  });

  test("stops a source when its worker fails to start", async () => {
    const registry = new SourceRegistry();

    await expect(registry.subscribe("kick:dead", failingWorker, record())).rejects.toThrow(
      "upstream refused",
    );
    expect(registry.sourceCount).toBe(0);
    expect(registry.has("kick:dead")).toBe(false);
  });

  test("reports capacity instead of starting more sources", () => {
    const registry = new SourceRegistry({ maxSources: 1, maxClientsPerSource: 1 });
    const worker = createFakeWorker();

    expect(registry.capacityIssue("kick:first")).toBeNull();
    void registry.subscribe("kick:first", () => worker, record());

    expect(registry.capacityIssue("kick:second")).toBe("source_limit");
    expect(registry.capacityIssue("kick:first")).toBe("client_limit");
  });

  test("refuses subscriptions over capacity with a typed error", async () => {
    const registry = new SourceRegistry({ maxSources: 1, maxClientsPerSource: 1 });
    const worker = createFakeWorker();
    await registry.subscribe("kick:first", () => worker, record());

    const secondSource = registry.subscribe("kick:second", () => createFakeWorker(), record());
    await expect(secondSource).rejects.toThrow(SourceCapacityError);
    await expect(secondSource).rejects.toMatchObject({ issue: "source_limit" });

    const secondClient = registry.subscribe("kick:first", () => worker, record());
    await expect(secondClient).rejects.toMatchObject({ issue: "client_limit" });
  });

  test("releases a pending subscription when the caller aborts", async () => {
    const registry = new SourceRegistry();
    const controller = new AbortController();
    let releaseStart = () => {};
    const startGate = new Promise<void>((resolve) => {
      releaseStart = resolve;
    });
    let stopped = 0;
    const slowWorker: ChatSourceWorker = {
      start() {
        return startGate;
      },
      stop() {
        stopped += 1;
      },
    };

    const pending = registry.subscribe("kick:slow", () => slowWorker, record(), {
      signal: controller.signal,
    });
    await Promise.resolve();
    expect(registry.sourceCount).toBe(1);
    expect(registry.clientCount).toBe(1);

    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(stopped).toBe(1);
    expect(registry.sourceCount).toBe(0);
    expect(registry.clientCount).toBe(0);

    // The same channel can be started again right away.
    const replacement = await registry.subscribe("kick:slow", () => createFakeWorker(), record());
    expect(registry.sourceCount).toBe(1);
    replacement();
    releaseStart();
  });

  test("refuses an already aborted signal without touching the registry", async () => {
    const registry = new SourceRegistry();
    const controller = new AbortController();
    controller.abort();

    await expect(
      registry.subscribe("kick:aborted", () => createFakeWorker(), record(), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(registry.sourceCount).toBe(0);
  });
});
