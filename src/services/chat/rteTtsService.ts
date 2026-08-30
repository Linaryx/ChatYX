const AZURE_TTS_ENDPOINT = "https://chatsemban.justdavi.dev/api/tts";
const CHATIS_TTS_ENDPOINT = "https://chatis.is2511.com/v2/tts/";
const RTE_PROXY_BASE = "https://ext.rte.net.ru:8443/";
const DEFAULT_MAX_QUEUE_SIZE = 20;

import type {
  RteTtsAudio,
  RteTtsConfig,
  RteTtsEnqueueResult,
  RteTtsEnvironment,
  RteTtsError,
  RteTtsErrorCode,
  RteTtsRequest,
  RteTtsState,
  RteTtsUser,
} from "./rteTtsTypes";

export type {
  RteTtsAudio,
  RteTtsConfig,
  RteTtsEnqueueResult,
  RteTtsError,
  RteTtsErrorCode,
  RteTtsRequest,
  RteTtsState,
  RteTtsUser,
} from "./rteTtsTypes";

type ActiveSpeech = {
  readonly request: RteTtsRequest;
  readonly controller: AbortController;
  audio: RteTtsAudio | null;
  objectUrl: string | null;
};

export function buildAzureTtsUrl(text: string, voice: string): string {
  return `${RTE_PROXY_BASE}${AZURE_TTS_ENDPOINT}?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
}

export function buildChatIsTtsUrl(): string {
  return `${RTE_PROXY_BASE}${CHATIS_TTS_ENDPOINT}`;
}

export class RteTtsService {
  private config: RteTtsConfig = {
    azureEnabled: false,
    chatisEnabled: false,
    azureVoice: "ru-RU-DmitryNeural",
    chatisVoice: "Brian",
    volume: 1,
    maxLength: 400,
  };
  private readonly queue: RteTtsRequest[] = [];
  private active: ActiveSpeech | null = null;
  private state: RteTtsState = { kind: "idle" };
  private lastError: RteTtsError | null = null;
  private destroyed = false;

  constructor(
    private readonly environment: RteTtsEnvironment,
    private readonly maxQueueSize = DEFAULT_MAX_QUEUE_SIZE,
  ) {}

  updateConfig(config: RteTtsConfig): void {
    this.config = {
      ...config,
      volume: Math.min(Math.max(config.volume, 0), 1),
      maxLength: Math.max(config.maxLength, 1),
    };
    if (!this.config.azureEnabled && !this.config.chatisEnabled) this.stop();
  }

  enqueue(request: RteTtsRequest): RteTtsEnqueueResult {
    if (!this.isProviderEnabled(request.provider) || this.destroyed) {
      return { kind: "rejected", error: "disabled" };
    }
    if (Array.from(request.text).length > this.config.maxLength) {
      return { kind: "rejected", error: "text_too_long" };
    }
    if (this.getQueueLength() >= this.maxQueueSize) {
      return { kind: "rejected", error: "queue_full" };
    }

    this.queue.push(request);
    this.startNext();
    return { kind: "accepted" };
  }

  getQueueLength(): number {
    return this.queue.length + (this.active ? 1 : 0);
  }

  getState(): RteTtsState {
    return this.state;
  }

  getLastError(): RteTtsError | null {
    return this.lastError;
  }

  skip(): void {
    if (this.active) this.finishActive(true);
  }

  clear(): void {
    this.queue.length = 0;
  }

  stop(): void {
    this.clear();
    this.cleanupActive();
  }

  cancelMessage(messageId: string): void {
    this.removeQueued((request) => request.messageId === messageId);
    if (this.active?.request.messageId === messageId) this.finishActive(true);
  }

  cancelUser(user: RteTtsUser): void {
    const normalizedUsername = user.username?.toLowerCase();
    const matches = (request: RteTtsRequest) =>
      (Boolean(user.userId) && request.userId === user.userId) ||
      (Boolean(normalizedUsername) &&
        request.username.toLowerCase() === normalizedUsername);

    this.removeQueued(matches);
    if (this.active && matches(this.active.request)) this.finishActive(true);
  }

  cancelAll(): void {
    this.stop();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
  }

  private startNext(): void {
    if (this.active || this.destroyed) return;
    const request = this.takeNextEnabledRequest();
    if (!request) {
      this.state = { kind: "idle" };
      return;
    }

    const active: ActiveSpeech = {
      request,
      controller: new AbortController(),
      audio: null,
      objectUrl: null,
    };
    this.active = active;
    this.state = { kind: "fetching", request };
    void this.loadAndPlay(active);
  }

  private takeNextEnabledRequest(): RteTtsRequest | undefined {
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (request && this.isProviderEnabled(request.provider)) return request;
    }
    return undefined;
  }

  private async loadAndPlay(active: ActiveSpeech): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchSpeech(active);
    } catch (error) {
      if (this.active !== active) return;
      const code = error instanceof DOMException && error.name === "AbortError"
        ? null
        : "fetch_failed";
      this.finishWithError(active, code);
      return;
    }

    if (this.active !== active) return;
    if (!response.ok) {
      this.finishWithError(active, "http_failed");
      return;
    }
    const audioUrl = await this.resolveAudioUrl(active, response);
    if (!audioUrl) return;
    if (this.active !== active) {
      if (active.request.provider === "azure") {
        this.environment.revokeObjectUrl(audioUrl);
      }
      return;
    }

    const audio = this.environment.createAudio(audioUrl);
    active.audio = audio;
    active.objectUrl = active.request.provider === "azure" ? audioUrl : null;
    audio.volume = this.config.volume;
    audio.onended = () => this.finishActive(true, false);
    audio.onerror = () => this.finishWithError(active, "audio_failed");
    this.state = { kind: "playing", request: active.request };

    try {
      await audio.play();
    } catch (error) {
      if (this.active !== active) return;
      if (error instanceof Error) {
        this.finishWithError(active, "play_failed");
        return;
      }
      throw error;
    }
  }

  private finishWithError(
    active: ActiveSpeech,
    code: RteTtsErrorCode | null,
  ): void {
    if (code) this.lastError = { code, messageId: active.request.messageId };
    this.finishActive(true);
  }

  private finishActive(advance: boolean, pause = true): void {
    this.cleanupActive(pause);
    if (advance) this.startNext();
  }

  private cleanupActive(pause = true): void {
    const active = this.active;
    if (!active) {
      this.state = { kind: "idle" };
      return;
    }

    this.active = null;
    active.controller.abort();
    if (active.audio) {
      active.audio.onended = null;
      active.audio.onerror = null;
      if (pause) active.audio.pause();
      active.audio.currentTime = 0;
    }
    if (active.objectUrl) this.environment.revokeObjectUrl(active.objectUrl);
    this.state = { kind: "idle" };
  }

  private removeQueued(predicate: (request: RteTtsRequest) => boolean): void {
    const retained = this.queue.filter((request) => !predicate(request));
    this.queue.length = 0;
    this.queue.push(...retained);
  }

  private isProviderEnabled(provider: RteTtsRequest["provider"]): boolean {
    return provider === "azure"
      ? this.config.azureEnabled
      : this.config.chatisEnabled;
  }

  private fetchSpeech(active: ActiveSpeech): Promise<Response> {
    if (active.request.provider === "azure") {
      return this.environment.fetch(
        buildAzureTtsUrl(
          active.request.text,
          active.request.voice ?? this.config.azureVoice,
        ),
        { signal: active.controller.signal, credentials: "omit" },
      );
    }

    return this.environment.fetch(buildChatIsTtsUrl(), {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({
        text: active.request.text,
        voice: active.request.voice ?? this.config.chatisVoice,
      }),
      signal: active.controller.signal,
      credentials: "omit",
    });
  }

  private async resolveAudioUrl(
    active: ActiveSpeech,
    response: Response,
  ): Promise<string | null> {
    if (active.request.provider === "azure") {
      if (!response.headers.get("content-type")?.toLowerCase().startsWith("audio/mpeg")) {
        this.finishWithError(active, "invalid_audio");
        return null;
      }
      return this.environment.createObjectUrl(await response.blob());
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      this.finishWithError(active, "invalid_audio");
      return null;
    }
    const audioUrl = getChatIsSpeakUrl(payload);
    if (!audioUrl) {
      this.finishWithError(active, "invalid_audio");
      return null;
    }
    return audioUrl;
  }
}

function getChatIsSpeakUrl(payload: unknown): string | null {
  if (!isRecord(payload) || payload.success !== true || typeof payload.speak_url !== "string") {
    return null;
  }
  try {
    const url = new URL(payload.speak_url);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
