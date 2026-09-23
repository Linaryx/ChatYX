import { locale, setLocale, t, type Locale } from "~/i18n";
import { getPublicAssetUrl } from "~/utils/appBase";

const options: Locale[] = ["en", "ru"];

const flags: Record<Locale, string> = {
  en: getPublicAssetUrl("img/flag-gb.svg"),
  ru: getPublicAssetUrl("img/flag-ru.svg"),
};

export function LanguageSwitcher() {
  return (
    <div class="setup-language-switch" role="radiogroup" aria-label={t("language.label")}>
      <span
        class="setup-language-switch-thumb"
        aria-hidden="true"
        style={{ transform: locale() === "ru" ? "translateX(100%)" : "translateX(0)" }}
      />
      {options.map((option) => (
        <button
          type="button"
          role="radio"
          aria-checked={locale() === option}
          class="setup-language-switch-option"
          onClick={() => setLocale(option)}
        >
          <img class="setup-language-flag" src={flags[option]} alt="" aria-hidden="true" />
          {option === "en" ? t("language.english") : t("language.russian")}
        </button>
      ))}
    </div>
  );
}