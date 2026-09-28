import { Show, type JSX } from "solid-js";
import XIcon from "@hugeicons/core-free-icons/XIcon";
import { Icon } from "~/components/ui/icon";
import { botFallbackName, type BotProfile } from "~/services/setup/botProfiles";

export type UserChipProps = {
  login: string;
  /**
   * The profile map is passed as a getter rather than as one resolved profile,
   * because bot profiles arrive after the chip has rendered and the chip has to
   * pick them up.
   */
  profiles: () => Record<string, BotProfile>;
  onRemove: (login: string) => void;
  /** Localized action, combined with the display name for the remove label. */
  removeLabel: () => string;
};

/**
 * A removable entry in one of the bot or viewer lists: the resolved avatar or a
 * single-letter fallback, the display name, the raw login when the two differ,
 * and a remove button. Backspace and Delete remove it while it has focus.
 */
export function UserChip(props: UserChipProps): JSX.Element {
  const profile = () => props.profiles()[props.login];
  const displayName = () => profile()?.displayName || props.login;
  const avatarUrl = () => profile()?.avatarUrl || "";

  return (
    <div
      class="inline-flex max-w-full items-center gap-2 rounded-[0.5rem] border border-white/50 bg-[#27272a] px-1.5 py-0.5 text-white"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          props.onRemove(props.login);
        }
      }}
    >
      <Show
        when={avatarUrl()}
        fallback={
          <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-white/40 bg-black text-xs font-bold">
            {botFallbackName(props.login)}
          </span>
        }
      >
        <img
          src={avatarUrl()}
          alt=""
          class="size-7 shrink-0 rounded-full border border-white/40 object-cover"
          loading="lazy"
        />
      </Show>
      <span class="flex min-w-0 flex-col justify-center leading-tight">
        <span class="max-w-[150px] truncate text-xs font-bold">
          {displayName()}
        </span>
        <Show when={displayName().toLowerCase() !== props.login}>
          <span class="max-w-[150px] truncate text-[10px] text-white/60">
            @{props.login}
          </span>
        </Show>
      </span>
      <button
        type="button"
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-base leading-none text-white hover:bg-white/10"
        onClick={() => props.onRemove(props.login)}
        aria-label={`${props.removeLabel()}: ${displayName()}`}
      >
        <Icon icon={XIcon} size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
