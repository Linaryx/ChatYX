import { describe, expect, test } from "bun:test";
import { shouldShowPrediction } from "../src/features/chat-overlay/model/predictionVisibility";
import { createPreviewPredictionEvent } from "../src/services/predictions/previewPrediction";

describe("prediction visibility", () => {
  test("shows all received statuses when the active-only filter is off", () => {
    const prediction = { ...createPreviewPredictionEvent(), status: "LOCKED" as const };

    expect(shouldShowPrediction(prediction, false)).toBe(true);
  });

  test("shows only active predictions when the filter is on", () => {
    const active = createPreviewPredictionEvent();
    const locked = { ...active, status: "LOCKED" as const };
    const resolved = { ...active, status: "RESOLVED" as const };

    expect(shouldShowPrediction(active, true)).toBe(true);
    expect(shouldShowPrediction(locked, true)).toBe(false);
    expect(shouldShowPrediction(resolved, true)).toBe(false);
    expect(shouldShowPrediction(null, true)).toBe(false);
  });
});
