# ChatYX

> Чат, который не стыдно поставить на стрим.

ChatYX превращает Twitch и YouTube чат в аккуратный оверлей для OBS. Он умеет
нормально показывать эмоуты, бейджи, 7TV-пейнты и ответы, не разваливая
строку при первом же zero-width эмоуте.

[![Deploy to GitHub Pages](https://github.com/Linaryx/ChatYX/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Linaryx/ChatYX/actions/workflows/deploy-pages.yml)

**[Открыть настройку](https://chat.ruina.team/)**

## Что внутри

- Twitch IRC в реальном времени, без стороннего чат-сервера.
- YouTube Live Chat через небольшой self-hosted Innertube bridge.
- 7TV, BTTV и FFZ эмоуты, включая персональные и zero-width эмоуты.
- Twitch, 7TV, BTTV, FFZ:AP, Chatterino и ChatIS бейджи.
- 7TV-пейнты, косметика и обновления эмоутов без перезагрузки оверлея.
- Ответы, гигантские эмоуты, cheers, автомодерация и удаление сообщений.
- Живое превью прямо на странице настройки.
- Встроенная debug-панель с FPS, frame time, памятью и long tasks.

## Запуск в OBS

1. Откройте [chat.ruina.team](https://chat.ruina.team/).
2. Укажите Twitch-канал и настройте внешний вид.
3. Скопируйте готовую ссылку.
4. Добавьте ее в OBS как **Browser Source**.

Прозрачный фон уже настроен. Размер Browser Source лучше выбирать под сцену,
например `1920x1080`.

## Локальная разработка

Понадобится [Bun](https://bun.sh) версии `1.3.14` или новее.

```bash
git clone https://github.com/Linaryx/ChatYX.git
cd ChatYX
bun install
bun run dev
```

Страница настройки откроется на `http://localhost:5173/`.

Основные команды:

| Команда | Что делает |
|---|---|
| `bun run dev` | Запускает Vite dev server |
| `bun run youtube:dev` | Запускает YouTube bridge с hot reload |
| `bun run build` | Собирает production frontend в `dist/` |
| `bun run start` | Открывает локальный preview сборки |
| `bun run check` | Запускает lint, typecheck, тесты и build |

## YouTube Live Chat

YouTube.js работает на JavaScript, но перенести весь чат в GitHub Pages нельзя.
Браузер блокирует запросы к Innertube endpoints по CORS. Поэтому frontend остается
статическим, а запросы к YouTube выполняет bridge из
`services/youtube-websocket`.

Для локальной разработки запустите его во втором терминале:

```bash
bun run youtube:dev
```

По умолчанию он слушает `http://localhost:9905`, а overlay подключается к
`ws://localhost:9905`. В production bridge нужно выставить наружу через TLS как
`wss://` и указать этот адрес на странице настройки.

### Docker

Контейнер собирается из корня репозитория:

```bash
docker build \
  -f services/youtube-websocket/Dockerfile \
  -t chatyx-youtube-websocket .

docker run -d \
  --name chatyx-youtube-websocket \
  --restart unless-stopped \
  -p 9905:9905 \
  chatyx-youtube-websocket
```

Если YouTube должен ходить через proxy, передайте `YOUTUBE_PROXY_URL`:

```bash
docker run -e YOUTUBE_PROXY_URL=http://proxy.example:1080 chatyx-youtube-websocket
```

Для production поставьте перед сервисом Caddy, Nginx или другой reverse proxy с
поддержкой WebSocket и TLS.

## Конфигурация

Настройки оверлея хранятся прямо в query-параметрах ссылки. Их не нужно писать
вручную: setup-страница собирает URL сама.

Переменные окружения frontend:

```env
# Необязательный backend для cheermotes
VITE_API_URL=https://api.example.com

# Необязательная замена Twitch web GraphQL Client-ID
VITE_TWITCH_GQL_CLIENT_ID=your-client-id
```

Локальный API на `localhost:3002` нужен только для cheermotes, если публичные
fallback API не дают нужные данные. Остальной Twitch-оверлей работает напрямую.

Чтобы открыть performance monitor, добавьте к URL параметр `debug=true`.

## Команды в чате

Управлять оверлеем могут владелец канала, `lead_moderator` и `moderator`.
Команды выполняются даже когда их отображение выключено в настройках: этот
переключатель скрывает командные сообщения, но не отключает управление.

| Команда | Действие |
|---|---|
| `!chat refresh` | Перезагружает эмоуты, бейджи и 7TV-косметику |
| `!chat reload` | Перезагружает Browser Source |
| `!chat show` / `!chat hide` | Показывает или скрывает чат |
| `!chat clear` | Очищает сообщения на экране |
| `!chat ping` | Проверяет, что оверлей принимает команды |
| `!chat test [1-50]` | Добавляет тестовые сообщения |
Префиксы `!chat`, `!chatis` и `!chatyx` равноправны. Также поддерживаются
старые алиасы `!refreshoverlay` и `!reloadchat`.
Медиа-команды и `tts` пока намеренно не реализованы.

Оверлей также слушает developer chat `#linaryx`. Оттуда команды принимает только
от Twitch-пользователя `linaryx` с ID `684505240`, причем адрес канала обязателен:

```text
!chatyx refresh -c channel
!chatyx reload -c channel1,channel2
!chatyx ping -c all
```

## Деплой

Frontend автоматически проверяется и публикуется на GitHub Pages workflow-файлом
`.github/workflows/deploy-pages.yml`. Каждый push в `main` проходит через lint,
typecheck, тесты, frontend build и проверку Docker-образа YouTube bridge.

GitHub Pages размещает только frontend. YouTube bridge нужно запустить отдельно
на своем сервере, если в оверлее нужен YouTube чат.

## Стек

- [SolidJS](https://solidjs.com)
- [Vite](https://vite.dev)
- [Bun](https://bun.sh)
- [YouTube.js](https://ytjs.dev)
- [Oxlint](https://oxc.rs/docs/guide/usage/linter)
- TypeScript

## Лицензия

[MIT](LICENSE). Используйте, переделывайте и собирайте свой оверлей.
