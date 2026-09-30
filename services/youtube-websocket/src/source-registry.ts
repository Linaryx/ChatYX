import type {
  ChatSourceHistory,
  ChatSourceListener,
  ChatSourceWorker,
} from "./source-events";

export type SourceClient = {
  listener: ChatSourceListener;
  receivedHistory: boolean;
};

export type SourceSubscribeOptions = {
  /**
   * Aborts a pending subscription. The registry then drops the client and stops
   * the worker immediately, even if the upstream lookup never settles, so a
   * socket that closes mid-start cannot strand upstream work.
   */
  readonly signal?: AbortSignal;
};

type SourceEntry = {
  clients: Set<SourceClient>;
  worker: ChatSourceWorker;
  start: Promise<void>;
  history?: ChatSourceHistory;
};

export type SourceCapacityIssue = "source_limit" | "client_limit";

export type SourceRegistryOptions = {
  /** Distinct channels followed at once. */
  readonly maxSources?: number;
  /** Browser sources sharing one upstream channel. */
  readonly maxClientsPerSource?: number;
};

export class SourceCapacityError extends Error {
  constructor(readonly issue: SourceCapacityIssue) {
    super(
      issue === "source_limit"
        ? "The bridge is following as many channels as it can"
        : "This channel already has as many viewers as it can serve",
    );
    this.name = "SourceCapacityError";
  }
}

// A channel is read once regardless of how many browser sources are open for it.
export class SourceRegistry {
  private readonly entries = new Map<string, SourceEntry>();

  constructor(private readonly options: SourceRegistryOptions = {}) {}

  get sourceCount(): number {
    return this.entries.size;
  }

  get clientCount(): number {
    let total = 0;
    for (const entry of this.entries.values()) total += entry.clients.size;
    return total;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  private get maxSources(): number {
    return this.options.maxSources ?? Number.POSITIVE_INFINITY;
  }

  private get maxClientsPerSource(): number {
    return this.options.maxClientsPerSource ?? Number.POSITIVE_INFINITY;
  }

  /** Capacity check without side effects, so callers can reject before upgrading. */
  capacityIssue(key: string): SourceCapacityIssue | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return this.entries.size >= this.maxSources ? "source_limit" : null;
    }
    return entry.clients.size >= this.maxClientsPerSource ? "client_limit" : null;
  }

  async subscribe(
    key: string,
    createWorker: () => ChatSourceWorker,
    listener: ChatSourceListener,
    options: SourceSubscribeOptions = {},
  ): Promise<() => void> {
    const issue = this.capacityIssue(key);
    if (issue) throw new SourceCapacityError(issue);
    if (options.signal?.aborted) throw abortError();

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

    const release = () => {
      const current = this.entries.get(key);
      if (!current) return;
      current.clients.delete(client);
      if (current.clients.size !== 0) return;
      this.entries.delete(key);
      current.worker.stop();
    };

    entry.clients.add(client);
    try {
      await raceWithAbort(entry.start, options.signal);
    } catch (error) {
      release();
      throw error;
    }

    if (entry.history && !client.receivedHistory) {
      client.listener(entry.history);
      client.receivedHistory = true;
    }

    return release;
  }
}

function abortError(): DOMException {
  return new DOMException("The subscription was aborted", "AbortError");
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}
