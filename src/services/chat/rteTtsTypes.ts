export type RteTtsProvider = "azure" | "chatis";

export type RteTtsConfig = {
  readonly azureEnabled: boolean;
  readonly chatisEnabled: boolean;
  readonly azureVoice: string;
  readonly chatisVoice: string;
  readonly volume: number;
  readonly maxLength: number;
};

export type RteTtsRequest = {
  readonly provider: RteTtsProvider;
  readonly messageId: string;
  readonly userId?: string;
  readonly username: string;
  readonly text: string;
  readonly voice?: string;
};

export type RteTtsState =
  | { readonly kind: "idle" }
  | { readonly kind: "fetching"; readonly request: RteTtsRequest }
  | { readonly kind: "playing"; readonly request: RteTtsRequest };

export type RteTtsErrorCode =
  | "fetch_failed"
  | "http_failed"
  | "invalid_audio"
  | "play_failed"
  | "audio_failed";

export type RteTtsError = {
  readonly code: RteTtsErrorCode;
  readonly messageId: string;
};

export type RteTtsEnqueueResult =
  | { readonly kind: "accepted" }
  | {
      readonly kind: "rejected";
      readonly error: "disabled" | "queue_full" | "text_too_long";
    };

export type RteTtsUser = {
  readonly userId?: string;
  readonly username?: string;
};

export interface RteTtsAudio {
  volume: number;
  currentTime: number;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play(): Promise<void>;
  pause(): void;
}

export type RteTtsEnvironment = {
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  readonly createAudio: (url: string) => RteTtsAudio;
  readonly createObjectUrl: (blob: Blob) => string;
  readonly revokeObjectUrl: (url: string) => void;
};
