import { flatten, resolveTemplate, translator } from "@solid-primitives/i18n";
import { createSignal } from "solid-js";
import { dictionary as english } from "./en";
import { dictionary as russian } from "./ru";

export type Locale = "ru" | "en";

const STORAGE_KEY = "chatyx.locale";
const dictionaries = { ru: russian, en: english };

function getInitialLocale(): Locale {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ru";
  } catch {
    return "ru";
  }
}

const [locale, setLocaleSignal] = createSignal<Locale>(getInitialLocale());
const dictionary = () => flatten(dictionaries[locale()]);

if (typeof document !== "undefined") {
  document.documentElement.lang = locale();
}

export const t = translator(dictionary, resolveTemplate);
export { locale };

export function setLocale(next: Locale) {
  setLocaleSignal(next);
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Language selection remains available when browser storage is blocked.
  }
}
