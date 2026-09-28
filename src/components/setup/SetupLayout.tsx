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
import type { IconSvgObject } from "@hugeicons/core-free-icons/types";
import ArrowUpRightStackIcon from "@hugeicons/core-free-icons/ArrowUpRightStackIcon";
import Blockchain05Icon from "@hugeicons/core-free-icons/Blockchain05Icon";
import BotMessageSquareIcon from "@hugeicons/core-free-icons/BotMessageSquareIcon";
import ColorsIcon from "@hugeicons/core-free-icons/ColorsIcon";
import DashboardSquare03Icon from "@hugeicons/core-free-icons/DashboardSquare03Icon";
import DatabaseImportIcon from "@hugeicons/core-free-icons/DatabaseImportIcon";
import TextIcon from "@hugeicons/core-free-icons/TextIcon";
import VoiceCommentIcon from "@hugeicons/core-free-icons/VoiceCommentIcon";
import { cn } from "~/lib/utils";
import { t } from "~/i18n";
import { Icon } from "~/components/ui/icon";
import type { SetupSectionId } from "~/features/setup/model/setupSections";
import { resolveSetupText, type SetupText } from "./setupText";
import { SetupSwitch } from "./SetupSwitch";

export type ControlRow = {
  label: SetupText;
  control: (labelId: string) => JSX.Element;
  hint?: SetupText;
};

export type ToggleRow = {
  label: SetupText;
  checked: () => boolean;
  onChange: (value: boolean) => void;
  hint?: SetupText;
  disabled?: () => boolean;
};

export const SETUP_NAV: {
  id: SetupSectionId;
  labelKey: "navigation.import.label" | "navigation.appearance.label" | "navigation.styling.label" | "navigation.behavior.label" | "navigation.content.label" | "navigation.bots.label" | "navigation.tts.label" | "navigation.rte.label";
  descriptionKey: "navigation.import.description" | "navigation.appearance.description" | "navigation.styling.description" | "navigation.behavior.description" | "navigation.content.description" | "navigation.bots.description" | "navigation.tts.description" | "navigation.rte.description";
  icon: IconSvgObject;
}[] = [
  {
    id: "import",
    labelKey: "navigation.import.label",
    descriptionKey: "navigation.import.description",
    icon: DatabaseImportIcon,
  },
  {
    id: "appearance",
    labelKey: "navigation.appearance.label",
    descriptionKey: "navigation.appearance.description",
    icon: TextIcon,
  },
  {
    id: "styling",
    labelKey: "navigation.styling.label",
    descriptionKey: "navigation.styling.description",
    icon: ColorsIcon,
  },
  {
    id: "behavior",
    labelKey: "navigation.behavior.label",
    descriptionKey: "navigation.behavior.description",
    icon: ArrowUpRightStackIcon,
  },
  {
    id: "content",
    labelKey: "navigation.content.label",
    descriptionKey: "navigation.content.description",
    icon: DashboardSquare03Icon,
  },
  {
    id: "bots",
    labelKey: "navigation.bots.label",
    descriptionKey: "navigation.bots.description",
    icon: BotMessageSquareIcon,
  },
  {
    id: "tts",
    labelKey: "navigation.tts.label",
    descriptionKey: "navigation.tts.description",
    icon: VoiceCommentIcon,
  },
  {
    id: "rte",
    labelKey: "navigation.rte.label",
    descriptionKey: "navigation.rte.description",
    icon: Blockchain05Icon,
  },
];

export function ControlRows(props: { rows: ControlRow[] }) {
  return (
    <div class="setup-control-list">
      <For each={props.rows}>
        {(row) => {
          const labelId = `setup-control-label-${createUniqueId()}`;
          return (
          <div class="setup-control-row">
            <div class="flex min-w-0 flex-col gap-0.5">
              <div id={labelId} class="text-sm font-medium leading-normal text-foreground">
                {resolveSetupText(row.label)}
              </div>
              <Show when={row.hint !== undefined}>
                <div class="text-xs leading-normal text-muted-foreground">
                  {resolveSetupText(row.hint!)}
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
            label={resolveSetupText(row.label)}
            hint={row.hint === undefined ? undefined : resolveSetupText(row.hint)}
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
  icon?: IconSvgObject;
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
            <Icon
              icon={icon()}
              class="setup-section-heading-icon"
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
  matchedSections?: ReadonlySet<SetupSectionId>;
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
              classList={{ "setup-nav-item--search-match": props.matchedSections?.has(item.id) ?? false }}
              aria-controls={`setup-section-${item.id}`}
              aria-current={active() ? "location" : undefined}
            >
              <Icon icon={item.icon} class="setup-nav-icon" aria-hidden="true" />
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
