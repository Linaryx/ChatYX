/**
 * Chat animation vocabulary: the modes, the speed bounds and the pure mappings
 * between them.
 *
 * Kept free of DOM access so the URL contract, the setup form and the runtime
 * queue can all depend on it; the stylesheet generation lives with the overlay
 * runtime in `services/chat/runtime/animationStyles`.
 */

export const CHAT_ANIMATION_MODES = [
  "fade",
  "flow",
  "scroll",
  "none",
] as const;
export type ChatAnimationMode = (typeof CHAT_ANIMATION_MODES)[number];

export interface AnimationOptions {
  enabled: boolean;
  duration: number;
  easing: string;
  type: ChatAnimationMode;
}

export const MIN_MESSAGE_SPEED = 0;
export const MAX_MESSAGE_SPEED = 100;
export const DEFAULT_MESSAGE_SPEED = 31;
export const MIN_MESSAGE_INTERVAL_MS = 80;
export const MAX_MESSAGE_INTERVAL_MS = 3000;

export const DEFAULT_ANIMATION_OPTIONS: AnimationOptions = {
  enabled: true,
  duration: 200,
  easing: "ease-in-out",
  type: "fade",
};
export const FLOW_ANIMATION_DURATION = 380;

export function getMessageEntryAnimationDuration(
  mode: ChatAnimationMode,
): number {
  return mode === "flow"
    ? FLOW_ANIMATION_DURATION
    : DEFAULT_ANIMATION_OPTIONS.duration;
}

export function normalizeChatAnimationMode(
  value: unknown,
  fallback: ChatAnimationMode = "fade",
): ChatAnimationMode {
  return CHAT_ANIMATION_MODES.includes(value as ChatAnimationMode)
    ? (value as ChatAnimationMode)
    : fallback;
}

export function hasMessageEntryAnimation(mode: ChatAnimationMode): boolean {
  return mode === "fade" || mode === "flow";
}

export function getAnimationScrollBehavior(
  mode: ChatAnimationMode,
): ScrollBehavior {
  return mode === "scroll" ? "smooth" : "auto";
}

export function clampMessageSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return DEFAULT_MESSAGE_SPEED;
  return Math.min(
    Math.max(Math.round(speed), MIN_MESSAGE_SPEED),
    MAX_MESSAGE_SPEED,
  );
}

/**
 * Maps the 1..100 speed control onto a message interval, or null when the speed
 * is at its minimum, which means "no automatic pacing".
 */
export function messageSpeedToIntervalMs(speed: number): number | null {
  const clamped = clampMessageSpeed(speed);
  if (clamped <= MIN_MESSAGE_SPEED) return null;

  const normalized = (clamped - 1) / (MAX_MESSAGE_SPEED - 1);
  const ratio = MIN_MESSAGE_INTERVAL_MS / MAX_MESSAGE_INTERVAL_MS;

  return Math.round(MAX_MESSAGE_INTERVAL_MS * ratio ** normalized);
}
