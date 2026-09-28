import { For, type JSX } from "solid-js";
import { createDynamic } from "solid-js/web";
import type { IconSvgObject } from "@hugeicons/core-free-icons/types";

/**
 * SVG attribute names that are case-sensitive and must not be kebab-cased.
 * Every other camelCase key in an icon payload is a presentation attribute
 * such as `strokeWidth`, which the DOM expects as `stroke-width`.
 */
const CASE_SENSITIVE_SVG_ATTRIBUTES = new Set(["viewBox", "preserveAspectRatio"]);

function toSvgAttributeName(name: string): string {
  return CASE_SENSITIVE_SVG_ATTRIBUTES.has(name)
    ? name
    : name.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

function toSvgProps(
  attributes: Record<string, string | number>,
): Record<string, string | number> {
  const props: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(attributes)) {
    // `key` is a React-only hint carried in the icon payload.
    if (name === "key") continue;
    props[toSvgAttributeName(name)] = value;
  }
  return props;
}

export type IconProps = {
  /** Icon payload from `@hugeicons/core-free-icons`. */
  icon: IconSvgObject;
  class?: string;
  /**
   * Any CSS length. Defaults to `1em` so an icon keeps scaling with the
   * `font-size` of the element it replaced.
   */
  size?: string | number;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
};

/**
 * Renders a Hugeicons icon payload as an inline SVG.
 *
 * Decorative by default: pass `aria-label` to expose the icon to assistive
 * technology as a labelled image.
 */
export const Icon = (props: IconProps): JSX.Element => {
  const label = () => props["aria-label"];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width={props.size ?? "1em"}
      height={props.size ?? "1em"}
      class={props.class}
      role={label() ? "img" : undefined}
      aria-label={label()}
      aria-hidden={label() ? undefined : (props["aria-hidden"] ?? "true")}
    >
      <For each={props.icon}>
        {([tag, attributes]) => createDynamic(() => tag, toSvgProps(attributes))}
      </For>
    </svg>
  );
};
