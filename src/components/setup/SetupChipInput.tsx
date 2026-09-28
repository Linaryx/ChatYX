import type { JSX } from "solid-js";

export type SetupChipInputProps = {
  /** Current draft value, owned by the caller. */
  value: string;
  onInput: (value: string) => void;
  /** Commits the draft, for example on blur or Enter. */
  onCommit: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  label: string;
  placeholder: string;
};

/**
 * Borderless text field that adds entries to a chip list.
 *
 * The bot, YouTube-bot, Kick-bot and viewer allowlist rows all embed the same
 * control inside their chip container, so it lives here rather than being
 * repeated as raw markup in the route. It is intentionally not the generic
 * `Input` primitive: the field sits inside an existing bordered container and
 * must stay borderless and transparent.
 */
export const SetupChipInput = (props: SetupChipInputProps): JSX.Element => (
  <input
    type="text"
    aria-label={props.label}
    value={props.value}
    onInput={(event) => props.onInput(event.currentTarget.value)}
    onKeyDown={(event) => props.onKeyDown(event)}
    onBlur={props.onCommit}
    placeholder={props.placeholder}
    class="h-[34px] min-w-[150px] flex-1 border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
  />
);
