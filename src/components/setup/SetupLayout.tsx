import type { JSX } from "solid-js";
import {
  createEffect,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { cn } from "~/lib/utils";
import { t } from "~/i18n";
import { SetupSwitch } from "./SetupSwitch";

export type SetupSectionId =
  | "import"
  | "appearance"
  | "styling"
  | "behavior"
  | "content"
  | "bots"
  | "tts"
  | "rte";

export type ControlRow = {
  label: string;
  control: (labelId: string) => JSX.Element;
  hint?: string;
};

export type ToggleRow = {
  label: string;
  checked: () => boolean;
  onChange: (value: boolean) => void;
  hint?: string;
  disabled?: () => boolean;
};

export const SETUP_NAV: {
  id: SetupSectionId;
  labelKey: "navigation.import.label" | "navigation.appearance.label" | "navigation.styling.label" | "navigation.behavior.label" | "navigation.content.label" | "navigation.bots.label" | "navigation.tts.label" | "navigation.rte.label";
  descriptionKey: "navigation.import.description" | "navigation.appearance.description" | "navigation.styling.description" | "navigation.behavior.description" | "navigation.content.description" | "navigation.bots.description" | "navigation.tts.description" | "navigation.rte.description";
  icon: string;
}[] = [
  {
    id: "import",
    labelKey: "navigation.import.label",
    descriptionKey: "navigation.import.description",
    icon: "hgi-database-import",
  },
  {
    id: "appearance",
    labelKey: "navigation.appearance.label",
    descriptionKey: "navigation.appearance.description",
    icon: "hgi-text",
  },
  {
    id: "styling",
    labelKey: "navigation.styling.label",
    descriptionKey: "navigation.styling.description",
    icon: "hgi-colors",
  },
  {
    id: "behavior",
    labelKey: "navigation.behavior.label",
    descriptionKey: "navigation.behavior.description",
    icon: "hgi-arrow-up-right-stack",
  },
  {
    id: "content",
    labelKey: "navigation.content.label",
    descriptionKey: "navigation.content.description",
    icon: "hgi-dashboard-square-03",
  },
  {
    id: "bots",
    labelKey: "navigation.bots.label",
    descriptionKey: "navigation.bots.description",
    icon: "hgi-bot-message-square",
  },
  {
    id: "tts",
    labelKey: "navigation.tts.label",
    descriptionKey: "navigation.tts.description",
    icon: "hgi-voice-comment",
  },
  {
    id: "rte",
    labelKey: "navigation.rte.label",
    descriptionKey: "navigation.rte.description",
    icon: "hgi-blockchain-05",
  },
];

export function ControlRows(props: { rows: ControlRow[] }) {
  return (
    <div class="setup-control-list">
      <For each={props.rows}>
        {(row) => {
          const labelId = `setup-control-label-${createUniqueId()}`;
          return (
          <div class="setup-control-row grid grid-cols-1 items-center gap-2 min-[1100px]:grid-cols-[132px_minmax(0,1fr)] xl:grid-cols-[168px_minmax(0,1fr)] md:max-[1099px]:grid-cols-[180px_minmax(0,1fr)]">
            <div class="flex min-w-0 flex-col gap-0.5">
              <div id={labelId} class="text-sm font-medium leading-normal text-foreground">
                {row.label}
              </div>
              <Show when={row.hint}>
                <div class="text-xs leading-normal text-muted-foreground">
                  {row.hint}
                </div>
              </Show>
            </div>
            <div class="min-w-0 w-full">{row.control(labelId)}</div>
          </div>
          );
        }}
      </For>
    </div>
  );
}

export function ToggleRows(props: { rows: ToggleRow[] }) {
  return (
    <div class="setup-toggle-list">
      <For each={props.rows}>
        {(row) => (
          <SetupSwitch
            checked={row.checked()}
            onChange={row.onChange}
            label={row.label}
            hint={row.hint}
            disabled={row.disabled ? row.disabled() : undefined}
          />
        )}
      </For>
    </div>
  );
}

export function SectionCard(props: {
  title: string;
  description?: string;
  icon?: string;
  children: JSX.Element;
  class?: string;
  id?: string;
  hidden?: boolean;
  compact?: boolean;
}) {
  const titleId = `setup-heading-${createUniqueId()}`;
  return (
    <section
      id={props.id}
      hidden={props.hidden}
      aria-labelledby={titleId}
      class={cn("setup-section", props.compact && "setup-section--compact", props.class)}
    >
      <header class="setup-section-heading">
        <Show when={props.icon}>
          {(icon) => (
            <span
              class={cn("hgi-stroke", "setup-section-heading-icon", icon())}
              aria-hidden="true"
            />
          )}
        </Show>
        <div class="min-w-0">
          <h2 id={titleId}>{props.title}</h2>
          <Show when={props.description}><p>{props.description}</p></Show>
        </div>
      </header>
      <div class="setup-section-content">{props.children}</div>
    </section>
  );
}

export function SetupNav(props: {
  active: SetupSectionId;
  onSelect: (id: SetupSectionId) => void;
}) {
  const [thumbStyle, setThumbStyle] = createSignal<JSX.CSSProperties>({
    opacity: "0",
  });
  const itemRefs = new Map<SetupSectionId, HTMLButtonElement>();
  let navRef: HTMLElement | undefined;

  const updateThumb = () => {
    const activeItem = itemRefs.get(props.active);
    if (!navRef || !activeItem) {
      setThumbStyle({ opacity: "0" });
      return;
    }

    const navRect = navRef.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    setThumbStyle({
      height: `${itemRect.height}px`,
      opacity: "1",
      transform: `translateY(${itemRect.top - navRect.top}px)`,
    });
  };

  createEffect(updateThumb);
  onMount(() => {
    const observer = new ResizeObserver(updateThumb);
    if (navRef) observer.observe(navRef);
    onCleanup(() => observer.disconnect());
  });

  return (
    <nav
      class="setup-nav"
      ref={(element) => (navRef = element)}
      aria-label={t("navigation.label")}
    >
      <div
        class="setup-selection-thumb"
        aria-hidden="true"
        style={thumbStyle()}
      />
      <For each={SETUP_NAV}>
        {(item) => {
          const active = () => props.active === item.id;
          return (
            <button
              type="button"
              onClick={() => props.onSelect(item.id)}
              ref={(element) => itemRefs.set(item.id, element)}
              class="setup-nav-item"
              aria-controls={`setup-section-${item.id}`}
              aria-current={active() ? "location" : undefined}
            >
              <span class="hgi-stroke setup-nav-icon" classList={{ [item.icon]: true }} aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <span class="block text-xs font-medium leading-tight xl:text-sm">
                  {t(item.labelKey)}
                </span>
                <span class="mt-1 block text-xs font-normal leading-normal text-muted-foreground">
                  {t(item.descriptionKey)}
                </span>
              </span>
            </button>
          );
        }}
      </For>
    </nav>
  );
}
