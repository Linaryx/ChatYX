import { For, type JSX } from "solid-js";

export type BrandGlyphName = "twitch" | "youtube" | "seven-tv";

type GlyphDefinition = {
  viewBox: string;
  paths: readonly string[];
};

/**
 * Monochrome brand marks, tinted through `currentColor`.
 *
 * Deliberately not part of `components/ui`: the generic primitive layer must
 * not know about streaming providers, and these are brand assets rather than
 * UI icons (see `documents/REFACTORING.md` section 9).
 *
 * The filled brand chips under `public/img/platform-*.svg` are a different
 * rendering of the same brands for the overlay badges and stay there. This
 * module owns only the monochrome glyph form so the same path data is not
 * re-declared at each call site.
 */
const BRAND_GLYPHS: Record<BrandGlyphName, GlyphDefinition> = {
  twitch: {
    viewBox: "0 0 24 24",
    paths: [
      "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z",
    ],
  },
  youtube: {
    viewBox: "0 0 24 24",
    paths: [
      "M23.5 6.19a3.02 3.02 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.51A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.123 2.136c1.872.509 9.377.509 9.377.509s7.505 0 9.377-.51a3.02 3.02 0 0 0 2.122-2.135C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
    ],
  },
  "seven-tv": {
    viewBox: "0 0 28 20",
    paths: [
      "M20.7465 5.48825 21.9799 3.33745 22.646 2.20024 21.4125 0.0494437V0H14.8259L17.2928 4.3016 17.9836 5.48825H20.7465Z",
      "M7.15395 19.9258 14.5546 7.02104 15.4673 5.43884 13.0004 1.13724 12.3097 0.0247596H1.8995L0.666057 2.17556 0 3.31276 1.23344 5.46356V5.51301H9.12745L2.96025 16.267 2.09685 17.7998 3.33029 19.9506V20H7.15395",
      "M17.4655 19.9257H21.2398L26.1736 11.3225 27.037 9.83924 25.8036 7.68844V7.63899H22.0046L19.5377 11.9406 19.365 12.262 16.8981 7.96038 16.7255 7.63899 14.2586 11.9406 13.5679 13.1272 17.2682 19.5796 17.4655 19.9257Z",
    ],
  },
};

export const PlatformGlyph = (props: {
  name: BrandGlyphName;
  class?: string;
}): JSX.Element => (
  <svg
    viewBox={BRAND_GLYPHS[props.name].viewBox}
    class={props.class}
    aria-hidden="true"
  >
    <For each={BRAND_GLYPHS[props.name].paths}>
      {(path) => <path d={path} />}
    </For>
  </svg>
);
