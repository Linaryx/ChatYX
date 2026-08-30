import { RteRuntimeController } from "./rteRuntimeController";
import { RteTtsService } from "./rteTtsService";
import type { RteTtsAudio } from "./rteTtsTypes";

class BrowserRteTtsAudio implements RteTtsAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private readonly audio: HTMLAudioElement;

  constructor(url: string) {
    this.audio = new Audio(url);
    this.audio.onended = () => this.onended?.();
    this.audio.onerror = () => this.onerror?.();
  }

  get volume(): number {
    return this.audio.volume;
  }

  set volume(value: number) {
    this.audio.volume = value;
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  set currentTime(value: number) {
    this.audio.currentTime = value;
  }

  play(): Promise<void> {
    return this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }
}

export function createBrowserRteRuntime(): RteRuntimeController {
  return new RteRuntimeController(
    new RteTtsService({
      fetch: (url, init) => fetch(url, init),
      createAudio: (url) => new BrowserRteTtsAudio(url),
      createObjectUrl: (blob) => URL.createObjectURL(blob),
      revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    }),
  );
}
