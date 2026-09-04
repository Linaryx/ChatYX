import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { Input } from "~/components/ui/input";

const VOICES_URL = "/voices.txt";

const PROVIDERS = [
  {
    id: "ChatIS / Streamlabs",
    title: "ChatIS / Streamlabs",
    command: "!chat tts -s Maxim текст",
  },
  {
    id: "JustDavi / Azure",
    title: "JustDavi / Azure",
    command: "!chat tts -s Dmitriy текст",
  },
] as const;

type VoiceProvider = (typeof PROVIDERS)[number]["id"];

type Voice = {
  readonly provider: VoiceProvider;
  readonly voice: string;
  readonly locale: string;
  readonly gender: string;
  readonly features: string;
};

function isVoiceProvider(value: string): value is VoiceProvider {
  return PROVIDERS.some((provider) => provider.id === value);
}

export function parseVoiceCatalog(source: string): Voice[] {
  const voices: Voice[] = [];
  let provider: VoiceProvider | undefined;

  for (const line of source.split(/\r?\n/)) {
    const section = /^\[(.+)]$/.exec(line.trim());
    if (section) {
      const candidate = section[1] ?? "";
      provider = isVoiceProvider(candidate) ? candidate : undefined;
      continue;
    }
    if (!provider || !line.startsWith("|")) continue;

    const [voice, locale, gender, features] = line
      .split("|")
      .slice(1, -1)
      .map((column) => column.trim());
    if (
      !voice ||
      voice === "Voice" ||
      voice.startsWith("---") ||
      !locale ||
      !gender ||
      features === undefined
    ) {
      continue;
    }

    voices.push({ provider, voice, locale, gender, features });
  }

  return voices.sort(
    (left, right) =>
      PROVIDERS.findIndex((provider) => provider.id === left.provider) -
        PROVIDERS.findIndex((provider) => provider.id === right.provider) ||
      left.voice.localeCompare(right.voice),
  );
}

async function loadVoiceCatalog(): Promise<Voice[]> {
  const response = await fetch(VOICES_URL, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return parseVoiceCatalog(await response.text());
}

export function VoiceCatalog() {
  const [query, setQuery] = createSignal("");
  const [voices] = createResource(loadVoiceCatalog);
  const filteredVoices = createMemo(() => {
    const normalizedQuery = query().trim().toLowerCase();
    const catalog = voices() ?? [];
    if (!normalizedQuery) return catalog;

    return catalog.filter((voice) =>
      [voice.voice, voice.locale, voice.gender, voice.features]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  });

  return (
    <section class="rounded-lg border border-border bg-card/40 p-3" aria-labelledby="voice-catalog-title">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="voice-catalog-title" class="text-sm font-semibold text-foreground">
            Каталог голосов
          </h3>
          <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            В ChatYX доступны пять русских вариантов имён голосов. Команды: <code class="text-foreground">!chat tts</code> или короче <code class="text-foreground">!tts</code>.
          </p>
        </div>
        <a
          href={VOICES_URL}
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
        aria-label="Поиск голоса"
      />

      <Show when={voices.loading}>
        <p class="mt-3 text-xs text-muted-foreground">Загружаю каталог голосов…</p>
      </Show>
      <Show when={voices.error}>
        <p class="mt-3 text-xs leading-relaxed text-muted-foreground">
          Не удалось загрузить каталог. Открой <a href={VOICES_URL} target="_blank" rel="noreferrer" class="underline decoration-white/30 underline-offset-2 hover:decoration-white">voices.txt</a> напрямую.
        </p>
      </Show>
      <Show when={voices()}>
        <div class="mt-3 flex flex-col gap-3">
          <For each={PROVIDERS}>
            {(provider) => {
              const providerVoices = () =>
                filteredVoices().filter((voice) => voice.provider === provider.id);

              return (
                <section aria-labelledby={`voice-provider-${provider.id}`}>
                  <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h4 id={`voice-provider-${provider.id}`} class="text-xs font-semibold text-foreground">
                      {provider.title}
                    </h4>
                    <code class="text-[11px] text-muted-foreground">{provider.command}</code>
                  </div>
                  <div class="mt-1.5 max-h-48 overflow-auto rounded-md border border-border">
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
                        <For each={providerVoices()}>
                          {(voice) => (
                            <tr class="border-t border-border/70 text-foreground">
                              <td class="px-2 py-1.5 font-mono text-[11px]">{voice.voice}</td>
                              <td class="px-2 py-1.5 text-muted-foreground">{voice.locale}</td>
                              <td class="px-2 py-1.5 text-muted-foreground">{voice.gender}</td>
                              <td class="px-2 py-1.5 text-muted-foreground">{voice.features || "—"}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                  <p class="mt-1 text-[11px] text-muted-foreground">Показано: {providerVoices().length}</p>
                </section>
              );
            }}
          </For>
        </div>
      </Show>
    </section>
  );
}
