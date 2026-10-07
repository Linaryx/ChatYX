import { expect, test } from "bun:test";
import { ExternalChatService } from "../src/services/chat/external/externalChatService";

test("disconnected sockets cannot deliver messages or interfere with a new connection", () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousWebSocket = globalThis.WebSocket;
  const sockets: FakeSocket[] = [];
  let delivered = 0;
  const connections: boolean[] = [];
  class FakeSocket {
    onopen?: () => void;
    onmessage?: (event: { data: string }) => void;
    onclose?: (event: { code: number }) => void;
    closed = false;
    constructor(_url: string) { sockets.push(this); }
    close() { this.closed = true; }
  }
  (globalThis as unknown as { window: unknown }).window = {};
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  const service = new ExternalChatService();
  const callbacks = {
    onMessage: () => { delivered += 1; },
    onHistory: () => {},
    onDelete: () => {},
    onBan: () => {},
    onConnectionChange: (connected: boolean) => connections.push(connected),
  };
  try {
    service.connect("youtube", "streamer", "ws://localhost:8787", callbacks);
    const oldSocket = sockets[0];
    oldSocket.onopen?.();
    service.disconnect();
    expect(oldSocket.closed).toBe(true);
    service.connect("youtube", "streamer", "ws://localhost:8787", callbacks);
    sockets[1].onopen?.();
    oldSocket.onclose?.({ code: 1006 });
    const message = { data: JSON.stringify({ type: "message", platform: "youtube", message: "hello" }) };
    oldSocket.onmessage?.(message);
    expect(delivered).toBe(0);
    expect(connections).toEqual([true, true]);
    sockets[1].onmessage?.(message);
    expect(delivered).toBe(1);
  } finally {
    service.disconnect();
    globalThis.WebSocket = previousWebSocket;
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as unknown as { window: unknown }).window = previousWindow;
  }
});
