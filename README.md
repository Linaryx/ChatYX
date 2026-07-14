<div align="center">

# ChatYX

**Чат, который не стыдно поставить на стрим.**

Twitch и YouTube Live Chat в одном аккуратном OBS-оверлее.

[![Build](https://img.shields.io/github/actions/workflow/status/Linaryx/ChatYX/deploy-pages.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=build)](https://github.com/Linaryx/ChatYX/actions/workflows/deploy-pages.yml)
[![Frontend](https://img.shields.io/website?url=https%3A%2F%2Fchat.ruina.team%2F&style=for-the-badge&label=frontend&up_message=online&down_message=offline)](https://chat.ruina.team/)
[![YouTube WebSocket](https://img.shields.io/website?url=https%3A%2F%2Fytwss.ruina.team%2Fhealth&style=for-the-badge&logo=youtube&logoColor=white&label=YouTube%20WebSocket&up_message=online&down_message=offline)](https://ytwss.ruina.team/health)
[![License](https://img.shields.io/github/license/Linaryx/ChatYX?style=for-the-badge)](LICENSE)

### [Открыть настройку оверлея](https://chat.ruina.team/)

</div>

ChatYX превращает Twitch и YouTube чат в настраиваемый Browser Source для OBS.
Он показывает эмоуты, бейджи, 7TV-пейнты, cheers и ответы, не ломая строку при
zero-width эмоутах и динамических обновлениях косметики.

## Что внутри

- Twitch IRC в реальном времени, без стороннего чат-сервера.
- YouTube Live Chat через hosted Innertube bridge с возможностью self-hosting.
- 7TV, BTTV и FFZ эмоуты, включая персональные и zero-width эмоуты.
- Twitch, 7TV, BTTV, FFZ:AP, Chatterino и ChatIS бейджи.
- 7TV-пейнты, косметика и обновления эмоутов без перезагрузки оверлея.
- Ответы, гигантские эмоуты, cheers, автомодерация и удаление сообщений.
- Живое превью прямо на странице настройки.
- Встроенная debug-панель с FPS, frame time, памятью и long tasks.

## Статус сервисов

| Сервис | Статус | Использование |
|---|---|---|
| ChatYX frontend | [![Frontend status](https://img.shields.io/website?url=https%3A%2F%2Fchat.ruina.team%2F&style=flat-square&label=status&up_message=online&down_message=offline)](https://chat.ruina.team/) | Настройка и Browser Source |
| YouTube bridge | [![YouTube bridge status](https://img.shields.io/website?url=https%3A%2F%2Fytwss.ruina.team%2Fhealth&style=flat-square&logo=youtube&label=status&up_message=online&down_message=offline)](https://ytwss.ruina.team/health) | Innertube → WebSocket |
| Twitch IRC | ![Twitch IRC](https://img.shields.io/badge/connection-direct-9146FF?style=flat-square&logo=twitch&logoColor=white) | Сообщения и moderation events |
| 7TV API | [![7TV API status](https://img.shields.io/website?url=https%3A%2F%2F7tv.io%2Fv3%2Femote-sets%2Fglobal&style=flat-square&logo=7tv&label=status&up_message=online&down_message=offline)](https://7tv.io/) | Эмоуты, пейнты и EventAPI |
| BetterTTV API | [![BetterTTV API status](https://img.shields.io/website?url=https%3A%2F%2Fapi.betterttv.net%2F3%2Fcached%2Femotes%2Fglobal&style=flat-square&label=status&up_message=online&down_message=offline)](https://betterttv.com/) | Глобальные и канальные эмоуты |
| FrankerFaceZ | [![FrankerFaceZ status](https://img.shields.io/website?url=https%3A%2F%2Fwww.frankerfacez.com%2F&style=flat-square&label=status&up_message=online&down_message=offline)](https://www.frankerfacez.com/) | API эмоутов и бейджей |
| IVR API | [![IVR API status](https://img.shields.io/website?url=https%3A%2F%2Fapi.ivr.fi%2Fv2%2Ftwitch%2Fuser%3Flogin%3Dtwitch&style=flat-square&label=status&up_message=online&down_message=offline)](https://api.ivr.fi/) | Twitch metadata и fallback-бейджи |

Статусные бейджи проверяют доступность HTTP endpoints при загрузке README. Twitch
IRC подключается из Browser Source напрямую и не зависит от backend ChatYX.

## Как это работает

```text
Twitch IRC / GQL ───────────────┐
7TV / BTTV / FFZ / IVR APIs ────┼──> ChatYX frontend ──> OBS Browser Source
YouTube ──> Innertube bridge ───┘
```

Frontend остаётся статическим и публикуется на GitHub Pages. Только YouTube чат
проходит через отдельный WebSocket bridge, поскольку браузерные запросы к
Innertube ограничены CORS.

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

По умолчанию локальный bridge слушает `http://localhost:9905`, а production
overlay подключается к `wss://ytwss.ruina.team`. Для локальной разработки адрес
можно переопределить на странице настройки или параметром `ytws=ws://localhost:9905`.

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

В production backend используется только при заданном `VITE_API_URL`. Локальный
API на `localhost:3002` проверяется только при запуске frontend через Vite в
режиме разработки. Остальной Twitch-оверлей работает напрямую.

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

GitHub Pages размещает только frontend. По умолчанию он подключается к hosted
YouTube bridge на `wss://ytwss.ruina.team`; Docker-инструкция выше позволяет
запустить собственный экземпляр.

## Стек

<p align="center">
  <a href="https://www.solidjs.com/"><img alt="SolidJS" src="https://img.shields.io/badge/SolidJS-2C4F7C?style=for-the-badge&logo=solid&logoColor=white"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"></a>
  <a href="https://vite.dev/"><img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white"></a>
  <a href="https://bun.sh/"><img alt="Bun" src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white"></a>
  <a href="https://www.docker.com/"><img alt="Docker" src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white"></a>
  <a href="https://ytjs.dev/"><img alt="YouTube.js" src="https://img.shields.io/badge/YouTube.js-FF0000?style=for-the-badge&logo=youtube&logoColor=white"></a>
  <a href="https://www.twitch.tv/"><img alt="Twitch" src="https://img.shields.io/badge/Twitch_IRC-9146FF?style=for-the-badge&logo=twitch&logoColor=white"></a>
  <a href="https://oxc.rs/docs/guide/usage/linter"><img alt="Oxlint" src="https://img.shields.io/badge/Oxlint-34D058?style=for-the-badge&logo=eslint&logoColor=white"></a>
</p>

| Слой | Технологии |
|---|---|
| UI | SolidJS, TypeScript, Vite |
| Runtime | Bun |
| YouTube bridge | YouTube.js, Bun WebSocket server |
| Интеграции | Twitch IRC/GQL, 7TV, BetterTTV, FrankerFaceZ, IVR |
| Качество | Oxlint, TypeScript, Bun Test, GitHub Actions |
| Деплой | GitHub Pages, Docker, Northflank |

## Лицензия

[MIT](LICENSE). Используйте, переделывайте и собирайте свой оверлей.
