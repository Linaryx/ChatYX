import type {
  ChatSourceHistory,
  ChatSourceListener,
  ChatSourceWorker,
} from "./source-events";

type SourceClient = {
  listener: ChatSourceListener;
  receivedHistory: boolean;
};

type SourceEntry = {
  clients: Set<SourceClient>;
  worker: ChatSourceWorker;
  start: Promise<void>;
  history?: ChatSourceHistory;
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
    const client: SourceClient = { listener, receivedHistory: false };
    if (!entry) {
      const clients = new Set<SourceClient>();
      const worker = createWorker();
      const newEntry: SourceEntry = {
        clients,
        worker,
        start: Promise.resolve(),
      };
      this.entries.set(key, newEntry);
      newEntry.start = Promise.resolve().then(() => worker.start((event) => {
        if (event.type === "history") newEntry.history = event;
        for (const client of clients) {
          client.listener(event);
          if (event.type === "history") client.receivedHistory = true;
        }
      }));
      entry = newEntry;
    }
    entry.clients.add(client);
    try {
      await entry.start;
    } catch (error) {
      entry.clients.delete(client);
      if (entry.clients.size === 0 && this.entries.get(key) === entry) {
        this.entries.delete(key);
        entry.worker.stop();
      }
      throw error;
    }

    if (entry.history && !client.receivedHistory) {
      client.listener(entry.history);
      client.receivedHistory = true;
    }

    return () => {
      const current = this.entries.get(key);
      if (!current) return;
      current.clients.delete(client);
      if (current.clients.size !== 0) return;
      this.entries.delete(key);
      current.worker.stop();
    };
  }
}
