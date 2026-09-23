import type { dictionary as russianDictionary } from "./ru";

type TranslateLeaves<T> = T extends string
  ? string
  : { [Key in keyof T]: TranslateLeaves<T[Key]> };

export type Dictionary = TranslateLeaves<typeof russianDictionary>;
