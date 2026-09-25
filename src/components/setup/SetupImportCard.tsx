import { createSignal, For, Show } from "solid-js";
import {
  parseSetupImport,
  type SetupImportPatch,
  type SetupImportResult,
  type SetupImportSource,
} from "~/config/setupImport";
import {
  BUILT_IN_SETUP_TEMPLATES,
  createUserSetupTemplate,
  deleteUserSetupTemplate,
  readUserSetupTemplates,
  renameUserSetupTemplate,
  writeUserSetupTemplates,
  type TemplateSource,
} from "~/config/setupTemplates";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { t } from "~/i18n";
import { cn } from "~/lib/utils";
import { SectionCard } from "./SetupLayout";
import { SetupSelect } from "./SetupSelect";

type SetupImportCardProps = {
  readonly hidden: boolean;
  readonly onImport: (patch: SetupImportPatch) => void;
  readonly getCurrentTemplateSettings: () => SetupImportPatch;
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
  const [templateName, setTemplateName] = createSignal("");
  const [templateStatus, setTemplateStatus] = createSignal("");
  const [userTemplates, setUserTemplates] = createSignal(readUserSetupTemplates());
  const [editingTemplateId, setEditingTemplateId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal("");
  const [deletePendingId, setDeletePendingId] = createSignal<string | null>(null);
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

  const sourceName = (source: TemplateSource) => {
    switch (source) {
      case "manual": return t("setup.import.templates.manualSource");
      case "chatyx": return "ChatYX";
      case "chatis": return "ChatIS";
      case "cyan": return "Cyan Chat";
      case "davii": return "Davii Chat";
      default: return source satisfies never;
    }
  };

  const fallbackTemplateName = (source: TemplateSource) => source === "manual"
    ? t("setup.import.templates.defaultManualName")
    : t("setup.import.templates.defaultImportName", { source: sourceName(source) });

  const saveTemplate = (settings: SetupImportPatch, source: TemplateSource) => {
    const template = createUserSetupTemplate(settings, {
      name: templateName(),
      fallbackName: fallbackTemplateName(source),
      source,
    }, userTemplates());
    if (!template) {
      setTemplateStatus(t("setup.import.templates.noVisualSettings"));
      return;
    }

    const nextTemplates = [template, ...userTemplates()];
    if (!writeUserSetupTemplates(nextTemplates)) {
      setTemplateStatus(t("setup.import.templates.saveError"));
      return;
    }
    setUserTemplates(nextTemplates);
    setTemplateName("");
    setTemplateStatus(t("setup.import.templates.saved", { name: template.name }));
  };

  const importSettings = () => {
    const next = parseSetupImport(input(), source(), window.location.origin);
    setResult(next);
    if (next.kind === "parsed") {
      props.onImport(next.patch);
      saveTemplate(next.patch, next.source);
    }
  };

  const saveCurrentTemplate = () => saveTemplate(props.getCurrentTemplateSettings(), "manual");

  const requestDeleteTemplate = (id: string) => {
    if (deletePendingId() !== id) {
      setDeletePendingId(id);
      return;
    }

    const nextTemplates = deleteUserSetupTemplate(id, userTemplates());
    if (!writeUserSetupTemplates(nextTemplates)) {
      setTemplateStatus(t("setup.import.templates.saveError"));
      return;
    }
    setUserTemplates(nextTemplates);
    setDeletePendingId(null);
    setTemplateStatus(t("setup.import.templates.deleted"));
  };

  const renameTemplate = (id: string) => {
    const nextTemplates = renameUserSetupTemplate(id, renameValue(), userTemplates());
    if (!writeUserSetupTemplates(nextTemplates)) {
      setTemplateStatus(t("setup.import.templates.saveError"));
      return;
    }
    setUserTemplates(nextTemplates);
    setEditingTemplateId(null);
    setRenameValue("");
    setDeletePendingId(null);
    setTemplateStatus(t("setup.import.templates.renamed"));
  };

  const builtInTemplateName = (id: (typeof BUILT_IN_SETUP_TEMPLATES)[number]["id"]) => {
    switch (id) {
      case "standard": return t("setup.import.templates.standardName");
      case "atom": return t("setup.import.templates.atomName");
      default: return id satisfies never;
    }
  };

  const builtInTemplateDescription = (id: (typeof BUILT_IN_SETUP_TEMPLATES)[number]["id"]) => {
    switch (id) {
      case "standard": return t("setup.import.templates.standardDescription");
      case "atom": return t("setup.import.templates.atomDescription");
      default: return id satisfies never;
    }
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
        <section class="flex flex-col gap-2" aria-labelledby="setup-templates-title">
          <div>
            <h3 id="setup-templates-title" class="text-xs font-medium text-foreground sm:text-sm">
              {t("setup.import.templates.title")}
            </h3>
            <p class="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
              {t("setup.import.templates.description")}
            </p>
          </div>
          <div class="flex flex-col gap-2 rounded-md border border-border px-3 py-2.5">
            <label for="setup-template-name" class="text-xs font-medium text-foreground">
              {t("setup.import.templates.name")}
            </label>
            <div class="flex flex-wrap items-center gap-2">
              <Input
                id="setup-template-name"
                value={templateName()}
                onInput={(event) => {
                  setTemplateName(event.currentTarget.value);
                  setTemplateStatus("");
                }}
                placeholder={t("setup.import.templates.namePlaceholder")}
                class="h-8 min-w-0 flex-1 text-sm"
              />
              <Button type="button" size="sm" variant="secondary" onClick={saveCurrentTemplate}>
                {t("setup.import.templates.saveCurrent")}
              </Button>
            </div>
            <p class="text-[11px] leading-snug text-muted-foreground">
              {t("setup.import.templates.nameHint")}
            </p>
          </div>
          <p role="status" aria-live="polite" class="text-xs leading-snug text-muted-foreground">
            {templateStatus()}
          </p>
          <div class="flex flex-col gap-2">
            <h4 class="text-xs font-medium text-foreground">{t("setup.import.templates.myTemplates")}</h4>
            <For each={BUILT_IN_SETUP_TEMPLATES}>
              {(template) => (
                <div class="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2.5">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-foreground">{builtInTemplateName(template.id)}</p>
                    <p class="text-xs leading-snug text-muted-foreground">{builtInTemplateDescription(template.id)}</p>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => props.onImport(template.settings)}>
                    {t("setup.import.templates.apply")}
                  </Button>
                </div>
              )}
            </For>
            <Show when={userTemplates().length > 0}>
              <For each={userTemplates()}>
                {(template) => (
                  <div class="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5">
                    <div class="min-w-0 flex-1">
                      <Show
                        when={editingTemplateId() === template.id}
                        fallback={<p class="text-sm font-medium text-foreground">{template.name}</p>}
                      >
                        <Input
                          value={renameValue()}
                          onInput={(event) => setRenameValue(event.currentTarget.value)}
                          aria-label={t("setup.import.templates.rename")}
                          class="h-8 text-sm"
                        />
                      </Show>
                      <p class="mt-0.5 text-xs leading-snug text-muted-foreground">
                        {t("setup.import.templates.savedFrom", { source: sourceName(template.source) })}
                      </p>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => props.onImport(template.settings)}>
                        {t("setup.import.templates.apply")}
                      </Button>
                      <Show
                        when={editingTemplateId() === template.id}
                        fallback={(
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingTemplateId(template.id);
                              setRenameValue(template.name);
                              setDeletePendingId(null);
                            }}
                          >
                            {t("setup.import.templates.rename")}
                          </Button>
                        )}
                      >
                        <Button type="button" size="sm" variant="outline" onClick={() => renameTemplate(template.id)}>
                          {t("setup.import.templates.saveName")}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditingTemplateId(null)}>
                          {t("setup.import.templates.cancel")}
                        </Button>
                      </Show>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        class="setup-template-delete-button"
                        onClick={() => requestDeleteTemplate(template.id)}
                      >
                        {deletePendingId() === template.id
                          ? t("setup.import.templates.confirmDelete")
                          : t("setup.import.templates.delete")}
                      </Button>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </section>
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
