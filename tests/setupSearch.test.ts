import { describe, expect, test } from "bun:test";
import { isSetupSearchMatch } from "../src/utils/setupSearch";

describe("setup settings search", () => {
  test("finds proxy as a word without stitching letters across unrelated words", () => {
    expect(isSetupSearchMatch("прокси", "RTE прокси для эмоутов и бейджей")).toBe(true);
    expect(isSetupSearchMatch("прокси", "Параметры роли, опции качества и список иконок")).toBe(false);
  });

  test("tolerates a single extra letter inside a word", () => {
    expect(isSetupSearchMatch("пркси", "RTE прокси")).toBe(true);
  });

  test("rejects letters scattered across an unrelated word", () => {
    expect(isSetupSearchMatch("сти", "Систематика настроек")).toBe(false);
  });

  test("still matches plain substrings", () => {
    expect(isSetupSearchMatch("бейдж", "Скрыть все бейджи")).toBe(true);
  });

  test("ignores queries shorter than three characters", () => {
    expect(isSetupSearchMatch("бе", "Скрыть все бейджи")).toBe(false);
  });
});
