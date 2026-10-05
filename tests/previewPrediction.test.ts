import { expect, test } from "bun:test";
import { createPreviewPredictionEvent } from "../src/services/predictions/previewPrediction";

test("preview predictions contain four distinct funded outcomes", () => {
  const event = createPreviewPredictionEvent(1_800_000_000_000);

  expect(event.status).toBe("ACTIVE");
  expect(event.outcomes).toHaveLength(4);
  expect(new Set(event.outcomes.map((outcome) => outcome.id)).size).toBe(4);
  expect(new Set(event.outcomes.map((outcome) => outcome.title)).size).toBe(4);
  for (const outcome of event.outcomes) {
    expect(outcome.totalPoints).toBeGreaterThan(0);
    expect(outcome.totalUsers).toBeGreaterThan(0);
    expect(outcome.isWinner).toBe(false);
  }
});
