import { describe, expect, test } from "bun:test";
import { SourceRegistry } from "../services/youtube-websocket/src/source-registry";
import type { ChatSourceListener, ChatSourceWorker } from "../services/youtube-websocket/src/source-events";

describe("SourceRegistry", () => {
  test("shares one worker per source and stops it after the last client leaves", async () => {
    let starts = 0;
    let stops = 0;
    let emit: ChatSourceListener | undefined;
    const registry = new SourceRegistry();
    const createWorker = (): ChatSourceWorker => ({
      start(listener) {
        starts += 1;
        emit = listener;
        listener({
          type: "history",
          platform: "kick",
          messages: [{ type: "message", platform: "kick", id: "history-1", message: "Earlier", author: { name: "Viewer" }, unix: 1 }],
        });
        listener({ type: "status", platform: "kick", state: "connected" });
        return Promise.resolve();
      },
      stop() {
        stops += 1;
      },
    });
    const first: string[] = [];
    const second: string[] = [];

    const unsubscribeFirst = await registry.subscribe("kick:chatyx", createWorker, (event) => first.push(event.type));
    const unsubscribeSecond = await registry.subscribe("kick:chatyx", createWorker, (event) => second.push(event.type));
    emit?.({ type: "message", platform: "kick", id: "message-1", message: "Hello", author: { name: "Viewer" }, unix: Date.now() });

    expect(starts).toBe(1);
    expect(first).toEqual(["history", "status", "message"]);
    expect(second).toEqual(["history", "message"]);
    unsubscribeFirst();
    expect(stops).toBe(0);
    unsubscribeSecond();
    expect(stops).toBe(1);
  });
});
