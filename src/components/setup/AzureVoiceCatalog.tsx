import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { Input } from "~/components/ui/input";

const AZURE_VOICES_URL = "https://cdn.justdavi.dev/voices.txt";

type AzureVoice = {
  readonly voice: string;
  readonly locale: string;
  readonly gender: string;
  readonly categories: string;
  readonly personalities: string;
};

export function parseAzureVoiceCatalog(source: string): AzureVoice[] {
  const voices: AzureVoice[] = [];

  for (const line of source.split(/\r?\n/)) {
    const columns = line.trim().split(/\s{2,}/);
    const [voice, gender, categories = "", personalities = ""] = columns;
    const localeEnd = voice?.lastIndexOf("-") ?? -1;

    if (!voice?.endsWith("Neural") || !gender || localeEnd <= 0) continue;

    voices.push({
      voice,
      locale: voice.slice(0, localeEnd),
      gender,
      categories,
      personalities,
    });
  }

  return voices.sort((left, right) => left.voice.localeCompare(right.voice));
}

async function loadAzureVoiceCatalog(): Promise<AzureVoice[]> {
  const response = await fetch(AZURE_VOICES_URL, { credentials: "omit" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return parseAzureVoiceCatalog(await response.text());
}

export function AzureVoiceCatalog() {
  const [query, setQuery] = createSignal("");
  const [voices] = createResource(loadAzureVoiceCatalog);
  const filteredVoices = createMemo(() => {
    const normalizedQuery = query().trim().toLowerCase();
    const catalog = voices() ?? [];
    if (!normalizedQuery) return catalog;

    return catalog.filter((voice) =>
      [voice.voice, voice.locale, voice.gender, voice.categories, voice.personalities]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  });

  return (
    <section class="rounded-lg border border-border bg-card/40 p-3" aria-labelledby="azure-voices-title">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="azure-voices-title" class="text-sm font-semibold text-foreground">
            Голоса Azure
          </h3>
          <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Каталог загружается напрямую из voices.txt JustDavi. Используй точное имя после <code class="text-foreground">-v</code>.
          </p>
        </div>
        <a
          href={AZURE_VOICES_URL}
          target="_blank"
          rel="noreferrer"
          class="text-xs font-medium text-foreground underline decoration-white/30 underline-offset-4 hover:decoration-white"
        >
          Открыть voices.txt
        </a>
      </div>

      <Input
        type="search"
        value={query()}
        onInput={(event) => setQuery(event.currentTarget.value)}
        placeholder="Найти голос или локаль, например ru-RU"
        class="mt-3 h-8 text-xs"
        aria-label="Поиск голоса Azure"
      />

      <Show when={voices.loading}>
        <p class="mt-3 text-xs text-muted-foreground">Загружаю каталог голосов…</p>
      </Show>
      <Show when={voices.error}>
        <p class="mt-3 text-xs leading-relaxed text-muted-foreground">
          Не удалось загрузить каталог. Открой <a href={AZURE_VOICES_URL} target="_blank" rel="noreferrer" class="underline decoration-white/30 underline-offset-2 hover:decoration-white">voices.txt</a> напрямую.
        </p>
      </Show>
      <Show when={voices()}>
        <div class="mt-3 max-h-64 overflow-auto rounded-md border border-border">
          <table class="w-full min-w-[560px] border-collapse text-left text-xs">
            <thead class="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th scope="col" class="px-2 py-1.5 font-medium">Голос</th>
                <th scope="col" class="px-2 py-1.5 font-medium">Локаль</th>
                <th scope="col" class="px-2 py-1.5 font-medium">Пол</th>
                <th scope="col" class="px-2 py-1.5 font-medium">Особенности</th>
              </tr>
            </thead>
            <tbody>
              <For each={filteredVoices()}>
                {(voice) => (
                  <tr class="border-t border-border/70 text-foreground">
                    <td class="px-2 py-1.5 font-mono text-[11px]">{voice.voice}</td>
                    <td class="px-2 py-1.5 text-muted-foreground">{voice.locale}</td>
                    <td class="px-2 py-1.5 text-muted-foreground">{voice.gender}</td>
                    <td class="px-2 py-1.5 text-muted-foreground">
                      {[voice.categories, voice.personalities].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          Показано: {filteredVoices().length}
        </p>
      </Show>
    </section>
  );
}
