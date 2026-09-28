/**
 * Setup section identity.
 *
 * A setup section is a domain concept: the route composes sections, the
 * workspace navigation presents them and the settings search points at them.
 * The identity therefore lives in the feature's model so none of those three
 * has to import another, and the presentation layer keeps only the icon and
 * translation metadata that belongs to it.
 */
export type SetupSectionId =
  | "import"
  | "appearance"
  | "styling"
  | "behavior"
  | "content"
  | "bots"
  | "tts"
  | "rte";
