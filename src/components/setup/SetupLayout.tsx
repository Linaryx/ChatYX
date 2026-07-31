import type { JSX } from "solid-js";
import { createUniqueId, For, Show } from "solid-js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";
import { SetupSwitch } from "./SetupSwitch";

export type SetupSectionId =
  | "appearance"
  | "styling"
  | "behavior"
  | "content"
  | "bots";

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
};

export const SETUP_NAV: {
  id: SetupSectionId;
  label: string;
  description: string;
}[] = [
  {
    id: "appearance",
    label: "Текст и размер",
    description: "Шрифт, вес и эмоуты",
  },
  {
    id: "styling",
    label: "Внешний вид",
    description: "Тень, фон, цвета",
  },
  {
    id: "behavior",
    label: "Поведение",
    description: "Анимация и порядок",
  },
  {
    id: "content",
    label: "Контент и бейджи",
    description: "Что показывать",
  },
  {
    id: "bots",
    label: "Боты и фильтры",
    description: "Списки и скрытие",
  },
];

export function ControlRows(props: { rows: ControlRow[] }) {
  return (
    <div class="flex flex-col gap-3">
      <For each={props.rows}>
        {(row) => {
          const labelId = `setup-control-label-${createUniqueId()}`;
          return (
          <div class="setup-control-row grid grid-cols-1 items-center gap-2 min-[1100px]:grid-cols-[132px_minmax(0,1fr)] xl:grid-cols-[168px_minmax(0,1fr)] md:max-[1099px]:grid-cols-[180px_minmax(0,1fr)]">
            <div class="flex min-w-0 flex-col gap-0.5">
              <div id={labelId} class="text-xs font-medium text-foreground sm:text-sm">
                {row.label}
              </div>
              <Show when={row.hint}>
                <div class="text-[11px] leading-snug text-muted-foreground sm:text-xs">
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
    <div class="flex flex-col gap-2">
      <For each={props.rows}>
        {(row) => (
          <div class="setup-toggle-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
            <div class="flex min-w-0 flex-col gap-0.5">
              <div class="text-xs font-medium text-foreground sm:text-sm">
                {row.label}
              </div>
              <Show when={row.hint}>
                <div class="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                  {row.hint}
                </div>
              </Show>
            </div>
            <SetupSwitch
              checked={row.checked()}
              onChange={row.onChange}
              label={row.label}
            />
          </div>
        )}
      </For>
    </div>
  );
}

function SectionHeader(props: {
  title: string;
  description?: string;
  collapsible?: boolean;
  compact?: boolean;
}) {
  return (
    <CardHeader
      class={cn(
        "space-y-1",
        props.compact ? "p-3.5" : "p-4 xl:p-5",
        props.collapsible
          ? props.compact
            ? "cursor-pointer select-none pb-3.5"
            : "cursor-pointer select-none pb-4 xl:pb-5"
          : "pb-2.5",
      )}
    >
      <div class="flex items-start justify-between gap-2.5">
        <div class="min-w-0 space-y-0.5">
          <CardTitle class="text-[11px] font-bold uppercase tracking-[0.08em] sm:text-xs">
            {props.title}
          </CardTitle>
          <Show when={props.description}>
            <CardDescription class="text-[11px] leading-snug sm:text-xs sm:leading-relaxed">
              {props.description}
            </CardDescription>
          </Show>
        </div>
        <Show when={props.collapsible}>
          <span
            class="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background/40 text-muted-foreground transition-transform duration-200 group-data-[expanded]:rotate-180 sm:size-7"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-3.5 sm:size-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </Show>
      </div>
    </CardHeader>
  );
}

export function SectionCard(props: {
  title: string;
  description?: string;
  children: JSX.Element;
  class?: string;
  id?: string;
  compact?: boolean;
  collapsible?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isCollapsible = () => props.collapsible === true;
  const pad = () =>
    props.compact
      ? "flex flex-col gap-3 p-3.5 pt-0"
      : "flex flex-col gap-3 p-4 pt-0 xl:gap-4 xl:p-5 xl:pt-0";

  return (
    <Show
      when={isCollapsible()}
      fallback={
        <Card
          id={props.id}
          class={cn(
            "scroll-mt-4 border-border/80 bg-card/80 shadow-none",
            props.class,
          )}
        >
          <SectionHeader
            title={props.title}
            description={props.description}
            compact={props.compact}
          />
          <CardContent class={cn(pad(), "min-h-0 flex-1")}>
            {props.children}
          </CardContent>
        </Card>
      }
    >
      <Collapsible
        open={props.open}
        defaultOpen={props.defaultOpen ?? false}
        onOpenChange={props.onOpenChange}
        class="group"
      >
        <Card
          id={props.id}
          class={cn(
            "scroll-mt-4 border-border/80 bg-card/80 shadow-none",
            props.class,
          )}
        >
          <CollapsibleTrigger class="w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <SectionHeader
              title={props.title}
              description={props.description}
              collapsible
              compact={props.compact}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent class={pad()}>{props.children}</CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </Show>
  );
}

export function SetupNav(props: {
  active: SetupSectionId;
  onSelect: (id: SetupSectionId) => void;
}) {
  return (
    <nav class="flex flex-col gap-0.5">
      <For each={SETUP_NAV}>
        {(item) => {
          const active = () => props.active === item.id;
          return (
            <button
              type="button"
              onClick={() => props.onSelect(item.id)}
              class={cn(
                "rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active()
                  ? "border-border bg-secondary text-foreground"
                  : "border-transparent bg-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
              aria-current={active() ? "location" : undefined}
            >
              <div class="text-xs font-medium leading-tight xl:text-sm">
                {item.label}
              </div>
              <div class="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {item.description}
              </div>
            </button>
          );
        }}
      </For>
    </nav>
  );
}
