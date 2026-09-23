import { createSignal, For, Show } from "solid-js";
import {
  parseSetupImport,
  type SetupImportPatch,
  type SetupImportResult,
  type SetupImportSource,
} from "~/config/setupImport";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { t } from "~/i18n";
import { cn } from "~/lib/utils";
import { SectionCard } from "./SetupLayout";
import { SetupSelect } from "./SetupSelect";

type SetupImportCardProps = {
  readonly hidden: boolean;
  readonly onImport: (patch: SetupImportPatch) => void;
};

function selectedSource(value: string): SetupImportSource {
  switch (value) {
    case "chatyx": return "chatyx";
    case "chatis": return "chatis";
    case "cyan": return "cyan";
    case "davii": return "davii";
    default: return "auto";
  }
}

function statusText(result: SetupImportResult | null): string {
  if (result === null) return t("setup.import.statusInitial");
  switch (result.kind) {
    case "ambiguous":
      return t("setup.import.statusAmbiguous");
    case "unrecognized":
      return t("setup.import.statusUnrecognized");
    case "parsed":
      return result.unsupported.length > 0
        ? t("setup.import.statusPartial", { source: result.sourceLabel })
        : t("setup.import.statusSuccess", { source: result.sourceLabel });
    default:
      return result satisfies never;
  }
}

export function SetupImportCard(props: SetupImportCardProps) {
  const [source, setSource] = createSignal<SetupImportSource>("auto");
  const [input, setInput] = createSignal("");
  const [result, setResult] = createSignal<SetupImportResult | null>(null);
  const unsupported = () => {
    const current = result();
    return current?.kind === "parsed" ? current.unsupported : [];
  };
  const statusClass = () => {
    const current = result();
    if (current === null) return "text-muted-foreground";
    if (current.kind === "parsed" && current.unsupported.length === 0) return "text-foreground";
    return "text-muted-foreground";
  };

  const importSettings = () => {
    const next = parseSetupImport(input(), source(), window.location.origin);
    setResult(next);
    if (next.kind === "parsed") props.onImport(next.patch);
  };

  return (
    <SectionCard
      id="setup-section-import"
      title={t("setup.import.title")}
      description={t("setup.import.description")}
      icon="hgi-database-import"
      hidden={props.hidden}
    >
      <div class="flex flex-col gap-5">
        <div class="flex min-w-0 flex-col gap-1.5">
          <label for="setup-import-source" class="text-xs font-medium text-foreground sm:text-sm">
            {t("setup.import.source")}
          </label>
          <SetupSelect
            id="setup-import-source"
            value={source()}
            onChange={(event) => {
              setSource(selectedSource(event.currentTarget.value));
              setResult(null);
            }}
          >
            <option value="auto">{t("setup.import.sourceAuto")}</option>
            <option value="chatyx">ChatYX</option>
            <option value="chatis">ChatIS</option>
            <option value="cyan">Cyan Chat</option>
            <option value="davii">Davii Chat</option>
          </SetupSelect>
        </div>
        <div class="flex min-w-0 flex-col gap-1.5">
          <label for="setup-import-input" class="text-xs font-medium text-foreground sm:text-sm">
            {t("setup.import.input")}
          </label>
          <Textarea
            id="setup-import-input"
            value={input()}
            onInput={(event) => {
              setInput(event.currentTarget.value);
              setResult(null);
            }}
            aria-describedby="setup-import-helper setup-import-status"
            aria-invalid={result()?.kind === "unrecognized" || result()?.kind === "ambiguous"}
            placeholder="https://chat.ruina.team/chat?c=..."
            class="min-h-[96px] resize-y font-mono text-xs"
          />
          <p id="setup-import-helper" class="text-[11px] leading-snug text-muted-foreground sm:text-xs">
            {t("setup.import.helper")}
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={importSettings}>
          {t("setup.import.action")}
        </Button>
        <p
          id="setup-import-status"
          role="status"
          aria-live="polite"
          class={cn("min-w-0 flex-1 text-xs leading-snug", statusClass())}
        >
          {statusText(result())}
        </p>
      </div>
      <Show when={unsupported().length > 0}>
        <div class="rounded-md border border-border bg-background px-3 py-2.5">
          <p class="text-xs font-medium text-foreground">{t("setup.import.unsupportedTitle")}</p>
          <ul class="mt-1.5 flex flex-wrap gap-1.5" aria-label={t("setup.import.unsupportedLabel")}>
            <For each={unsupported()}>
              {(key) => (
                <li class="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {key}
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </SectionCard>
  );
}
