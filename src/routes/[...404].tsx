export default function NotFound() {
  return (
    <main class="grid min-h-dvh place-items-center bg-[#09090b] px-6 py-12 text-zinc-100">
      <section class="w-full max-w-2xl border-s border-white/15 ps-6 sm:ps-8">
        <div class="flex items-start gap-4">
          <img
            src="https://cdn.7tv.app/emote/01JJ3FP4GD1EPEQSCRCREVHSGV/4x.webp"
            alt="oop"
            width="148"
            height="128"
            class="size-16 shrink-0 rounded-md object-contain outline outline-1 -outline-offset-1 outline-white/10 sm:size-20"
          />
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Ошибка 404
            </p>
            <h1 class="mt-2 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Страница не найдена
            </h1>
          </div>
        </div>
        <p class="mt-6 max-w-xl text-pretty text-sm leading-6 text-zinc-400 sm:text-base">
          Проверь адрес или вернись к настройке чат-оверлея. Если это ссылка
          для OBS, параметры должны идти после знака вопроса.
        </p>
        <a
          href="/"
          class="mt-6 inline-flex items-center gap-2 border-b border-white/35 pb-1 text-sm font-semibold text-white transition-colors duration-150 hover:border-white hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#09090b]"
        >
          Вернуться к настройке
          <span aria-hidden="true">→</span>
        </a>
      </section>
    </main>
  );
}
