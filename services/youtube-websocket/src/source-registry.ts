import type { ChatSourceListener, ChatSourceWorker } from "./source-events";

type SourceEntry = {
  clients: Set<ChatSourceListener>;
  worker: ChatSourceWorker;
  start: Promise<void>;
};

// A channel is read once regardless of how many browser sources are open for it.
export class SourceRegistry {
  private readonly entries = new Map<string, SourceEntry>();

  async subscribe(
    key: string,
    createWorker: () => ChatSourceWorker,
    listener: ChatSourceListener,
  ): Promise<() => void> {
    let entry = this.entries.get(key);
    if (!entry) {
      const clients = new Set<ChatSourceListener>();
      const worker = createWorker();
      entry = {
        clients,
        worker,
        start: Promise.resolve(),
      };
      this.entries.set(key, entry);
      entry.clients.add(listener);
      entry.start = Promise.resolve().then(() => worker.start((event) => {
        for (const client of clients) client(event);
      }));
    } else {
      entry.clients.add(listener);
    }
    try {
      await entry.start;
    } catch (error) {
      entry.clients.delete(listener);
      if (entry.clients.size === 0 && this.entries.get(key) === entry) {
        this.entries.delete(key);
        entry.worker.stop();
      }
      throw error;
    }

    return () => {
      const current = this.entries.get(key);
      if (!current) return;
      current.clients.delete(listener);
      if (current.clients.size !== 0) return;
      this.entries.delete(key);
      current.worker.stop();
    };
  }
}
