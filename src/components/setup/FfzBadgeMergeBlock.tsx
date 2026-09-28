import { For, type JSX } from "solid-js";
import { cn } from "~/lib/utils";
import { t } from "~/i18n";
import { getPublicAssetUrl } from "~/utils/appBase";

export type FfzBadgeMergeOption = {
  label: () => string;
  /** Role colour shown behind the badge preview. */
  badgeColor: string;
  checked: () => boolean;
  onChange: (checked: boolean) => void;
};

export type FfzBadgeMergeBlockProps = {
  options: readonly FfzBadgeMergeOption[];
  /**
   * Role badges cannot be merged while FFZ badges are off or every badge is
   * hidden, so the pills are disabled rather than hidden.
   */
  disabled: boolean;
};

const BADGE_PREVIEW_URL = getPublicAssetUrl("img/ffz-bot-badge.png");

/**
 * Chooses which role badge the FFZ bot badge is drawn next to.
 *
 * The pills are bespoke controls rather than the generic `Button`: each one
 * carries a coloured swatch, a pressed state and a desaturated disabled tint,
 * all of which the shared button base styles would fight.
 */
export function FfzBadgeMergeBlock(props: FfzBadgeMergeBlockProps): JSX.Element {
  const disabled = () => props.disabled;

  return (
    <div class="setup-role-merge grid grid-cols-1 gap-3 rounded-lg border border-border bg-black/40 p-3.5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
      <div class="flex min-w-0 flex-col gap-1.5">
        <div class="text-sm font-bold text-foreground">
          {t("setup.botBadgeNearRole")}
        </div>
        <div class="text-xs leading-snug text-muted-foreground">
          {t("setup.botBadgeNearRoleHint")}
        </div>
      </div>
      <div class="setup-role-pills grid grid-cols-1 gap-2 sm:grid-cols-3">
        <For each={props.options}>
          {(option) => {
            const active = () => option.checked();
            return (
              <button
                type="button"
                disabled={disabled()}
                class={cn(
                  "flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors",
                  disabled()
                    ? "cursor-not-allowed text-white/35"
                    : active()
                      ? "text-white hover:bg-[#27272a]"
                      : "text-white/55 hover:bg-[#27272a] hover:text-white/80",
                )}
                onClick={() => option.onChange(!active())}
                aria-pressed={active()}
              >
                <span
                  class={cn(
                    "inline-flex size-[31px] items-center justify-center rounded-lg border p-0.5 transition-[filter,border-color]",
                    active() && !disabled() ? "border-white/70" : "border-white/25",
                    (!active() || disabled()) && "saturate-0",
                  )}
                  style={{ background: option.badgeColor }}
                >
                  <img
                    src={BADGE_PREVIEW_URL}
                    alt=""
                    class="block size-full object-contain"
                    loading="lazy"
                  />
                </span>
                <span class="text-center leading-tight">
                  {option.label()}
                </span>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
}
