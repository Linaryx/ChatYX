import { describe, expect, test } from "bun:test";
import { isSetupSearchMatch } from "../src/utils/setupSearch";

describe("setup settings search", () => {
  test("finds proxy as a word without stitching letters across unrelated words", () => {
    expect(isSetupSearchMatch("прокси", "RTE прокси для эмоутов и бейджей")).toBe(true);
    expect(isSetupSearchMatch("прокси", "Параметры роли, опции качества и список иконок")).toBe(false);
  });
});
