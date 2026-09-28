/**
 * Setup label text.
 *
 * A label is either a resolved string or a getter, so a row descriptor can be
 * built once and still read the active locale when it renders. This module has
 * no JSX so the resolver stays testable without a DOM.
 */
export type SetupText = string | (() => string);

export function resolveSetupText(value: SetupText): string {
  return typeof value === "function" ? value() : value;
}
