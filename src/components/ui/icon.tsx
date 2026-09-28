import { HugeiconsIcon } from "@hugeicons/solid-js";
import type { IconSvgObject } from "@hugeicons/core-free-icons/types";
import type { JSX } from "solid-js";

export type IconProps = {
  /** Icon payload from `@hugeicons/core-free-icons`. */
  icon: IconSvgObject;
  class?: string;
  /**
   * Any CSS length. Defaults to `1em` so an icon keeps scaling with the
   * `font-size` of the element that owns it; project stylesheets set that size
   * per control instead of passing pixels per call site.
   */
  size?: string | number;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
};

/**
 * Renders a Hugeicons icon through the vendor's Solid renderer.
 *
 * The wrapper owns only the project convention: `currentColor`, `1em` as the
 * default size, and decorative-by-default accessibility. Stroke width is left
 * to the icon payload, which carries its own value; forcing one here would give
 * a stroke to a fill-only icon. Pass `aria-label` to expose the icon as a
 * labelled image.
 */
export const Icon = (props: IconProps): JSX.Element => {
  const label = () => props["aria-label"];
  return (
    <HugeiconsIcon
      icon={props.icon}
      class={props.class}
      size={props.size ?? "1em"}
      color="currentColor"
      role={label() ? "img" : undefined}
      aria-label={label()}
      aria-hidden={label() ? undefined : (props["aria-hidden"] ?? "true")}
    />
  );
};
