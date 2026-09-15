import type { TwitchPredictionEvent } from "./twitchPredictions";

export function createPreviewPredictionEvent(
  now = Date.now(),
): TwitchPredictionEvent {
  return {
    id: "preview-prediction",
    title: "Кто победит в раунде?",
    status: "ACTIVE",
    createdAt: new Date(now - 34_000).toISOString(),
    lockedAt: null,
    endedAt: null,
    predictionWindowSeconds: 120,
    winningOutcomeId: null,
    outcomes: [
      {
        id: "blue",
        title: "Синие",
        color: "BLUE",
        totalPoints: 128_400,
        totalUsers: 214,
        badgeUrl: "",
        isWinner: false,
      },
      {
        id: "pink",
        title: "Розовые",
        color: "PINK",
        totalPoints: 86_250,
        totalUsers: 173,
        badgeUrl: "",
        isWinner: false,
      },
    ],
    updatedAt: now,
    source: "gql",
  };
}
