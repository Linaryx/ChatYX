import { expect, test } from "bun:test";
import { resolveSetupText, type SetupText } from "~/components/setup/SetupLayout";
import { setLocale, t } from "~/i18n";

test("resolves setup labels with the active locale", () => {
  const label: SetupText = () => t("setup.messageSize");

  setLocale("ru");
  expect(resolveSetupText(label)).toBe("Размер сообщений");

  setLocale("en");
  expect(resolveSetupText(label)).toBe("Message size");

  setLocale("ru");
});
