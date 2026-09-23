import { expect, test } from "bun:test";
import { locale, setLocale, t } from "~/i18n";

test("switches setup translations between Russian and English", () => {
  setLocale("ru");
  expect(locale()).toBe("ru");
  expect(t("toolbar.reportIssue")).toBe("Сообщить об ошибке");

  setLocale("en");
  expect(locale()).toBe("en");
  expect(t("toolbar.reportIssue")).toBe("Report an issue");

  setLocale("ru");
});
