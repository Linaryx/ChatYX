import { locale, setLocale, t, type Locale } from "~/i18n";

const options: Locale[] = ["en", "ru"];

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
          {option === "en" ? t("language.english") : t("language.russian")}
        </button>
      ))}
    </div>
  );
}
