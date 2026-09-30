import type { TwitchPredictionEvent } from "~/services/predictions/twitchPredictions";

export function shouldShowPrediction(
  prediction: TwitchPredictionEvent | null,
  activeOnly: boolean,
): boolean {
  return prediction !== null && (!activeOnly || prediction.status === "ACTIVE");
}
