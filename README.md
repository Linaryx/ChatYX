<div align="center">

<img src="public/img/emote-1x.webp" alt="Маскот ChatYX" width="70" />

# ChatYX

**OBS-оверлей чата: Twitch, YouTube и Kick в одном Browser Source.**

[![Build](https://img.shields.io/github/actions/workflow/status/Linaryx/ChatYX/deploy-pages.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=build)](https://github.com/Linaryx/ChatYX/actions/workflows/deploy-pages.yml)
[![Version](https://img.shields.io/github/package-json/v/Linaryx/ChatYX?style=for-the-badge&label=version)](https://github.com/Linaryx/ChatYX/blob/main/package.json)
[![Frontend](https://img.shields.io/website?url=https%3A%2F%2Fchat.ruina.team%2F&style=for-the-badge&label=frontend&up_message=online&down_message=offline)](https://chat.ruina.team/)
[![Chat sources](https://img.shields.io/website?url=https%3A%2F%2Fytwss.ruina.team%2Fhealth&style=for-the-badge&label=Chat%20sources&up_message=online&down_message=offline)](https://ytwss.ruina.team/health)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue?style=for-the-badge)](LICENSE)

### [Открыть настройку оверлея](https://chat.ruina.team/)

[Возможности](#-возможности) •
[Отличия](#-отличия) •
[Быстрый старт](#-быстрый-старт) •
[Атрибуты](#-атрибуты-сообщений) •
[Разработка](#-разработка) •
[Команды](#-команды-в-чате)

</div>

## Что это

ChatYX — открытый оверлей чата для стрима. Один Browser Source показывает
Twitch, YouTube и Kick одновременно: эмоуты, бейджи, 7TV-пейнты, cheers,
ответы и события канала. Строка не ломается на zero-width эмоутах, косметика
обновляется без перезагрузки, настройки живут прямо в ссылке.

## ✨ Возможности

**Платформы**

- Twitch IRC в реальном времени, напрямую из браузера.
- YouTube Live Chat через hosted bridge с возможностью self-hosting.
- Kick через public realtime bridge — без OAuth и токенов.

**Эмоуты и косметика**

- 7TV, BTTV и FFZ, включая персональные и zero-width эмоуты.
- Бейджи Twitch, 7TV, BTTV, FFZ:AP, Chatterino и ChatIS.
- 7TV-пейнты ников и живые обновления через EventAPI.
- Гигантские эмоуты, cheers, Twitch GIF.

**Оверлей**

- Ответы, события канала, автомодерация и удаление сообщений.
- Плавная flow-анимация без наложений строк.
- Живое превью на странице настройки.
- Debug-панель: FPS, frame time, память, long tasks.
- Управление командами прямо из чата.

## 🆚 Отличия

| | ChatYX | Облачные виджеты ¹ | Десктоп-клиенты ² |
|---|---|---|---|
| Twitch, YouTube и Kick в одном оверлее | ✅ | ➖ | ❌ |
| Работа без аккаунта | ✅ | ❌ | ✅ |
| Открытый исходный код | ✅ GPL-3.0 | ❌ | ✅ |
| Self-hosting | ✅ | ❌ | ➖ |
| Прямой Twitch IRC без посредников | ✅ | ➖ | ✅ |
| 7TV-пейнты ников | ✅ | ➖ | ➖ |
| Zero-width эмоуты | ✅ | ➖ | ➖ |
| Живое превью при настройке | ✅ | ✅ | ➖ |

¹ StreamElements, Streamlabs и подобные. ² Chatterino и подобные.
➖ — нет из коробки или устроено иначе.

## 🚀 Быстрый старт

1. Откройте [chat.ruina.team](https://chat.ruina.team/).
2. Укажите канал и настройте внешний вид.
3. Скопируйте готовую ссылку.
4. Добавьте её в OBS как **Browser Source** размером под сцену, например `1920x1080`.

Прозрачный фон уже настроен.

## 🧩 Атрибуты сообщений

Каждая строка чата — `.chat_line` со стабильными хуками. Удобно для своих
скриптов, тем и отладки:

| Хук | Где | Содержимое |
|---|---|---|
| `data-platform` | `.chat_line` | `twitch`, `youtube` или `kick` |
| `data-nick` | `.chat_line` | Логин автора |
| `data-user-id` | `.chat_line` | ID автора |
| `data-time` | `.chat_line` | Unix-время сообщения в мс |
| `data-id` | `.chat_line` | ID сообщения |
| `data-event` | `.chat_line` | Тип Twitch-события, если есть |
| `.badge` | строка | Бейджи автора по порядку |
| `.user_info`, `.nick`, `.colon` | строка | Ник и разделитель |
| `.message` | строка | Текст и эмоуты сообщения |
| `.emote-container` | `.message` | Обёртка эмоута |
| `.reply_line` | строка | Превью ответа |
| `.mention`, `.chat-link` | `.message` | Упоминания и ссылки |

## 🛠 Разработка

Понадобится [Bun](https://bun.sh) версии `1.3.14` или новее.

```bash
git clone https://github.com/Linaryx/ChatYX.git
cd ChatYX
bun install
bun run dev
```

Страница настройки откроется на `http://localhost:5173/`.

| Команда | Что делает |
|---|---|
| `bun run dev` | Vite dev server |
| `bun run sources:dev` | YouTube/Kick bridge с hot reload (`youtube:dev` — alias) |
| `bun run build` | Production-сборка frontend в `dist/` |
| `bun run start` | Локальный preview сборки |
| `bun run check` | Lint, typecheck, тесты и build |

### Chat sources bridge

Браузер блокирует запросы к Innertube по CORS, поэтому YouTube и Kick идут
через отдельный WebSocket bridge из `services/youtube-websocket`. Kick
использует public metadata и анонимную realtime-подписку: никаких OAuth
секретов ни в OBS, ни в репозитории.

```bash
bun run sources:dev
```

Локальный bridge слушает `http://localhost:9905` (production —
`wss://ytwss.ruina.team`). Переопределить адрес можно на странице настройки
или параметрами `ytws=ws://localhost:9905` и `kickws=ws://localhost:9905`.

<details>
<summary>Docker</summary>

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

Proxy для YouTube задаётся через `YOUTUBE_PROXY_URL`:

```bash
docker run -e YOUTUBE_PROXY_URL=http://proxy.example:1080 chatyx-youtube-websocket
```

В production перед сервисом нужен reverse proxy с WebSocket и TLS
(Caddy, Nginx и подобные).

</details>

### Конфигурация

Настройки живут в query-параметрах ссылки — писать их вручную не нужно,
setup-страница собирает URL сама.

```env
# Необязательный backend для cheermotes
VITE_API_URL=https://api.example.com

# Необязательная замена Twitch web GraphQL Client-ID
VITE_TWITCH_GQL_CLIENT_ID=your-client-id
```

Backend используется только при заданном `VITE_API_URL`. Параметр `debug=true`
открывает performance monitor.

### Деплой

Каждый push в `main` проходит lint, typecheck, тесты, build frontend и проверку
Docker-образа (`.github/workflows/deploy-pages.yml`), затем публикуется на
GitHub Pages. По умолчанию frontend ходит за YouTube/Kick на hosted
`wss://ytwss.ruina.team`; свой bridge поднимается инструкцией выше.

## 💬 Команды в чате

Доступны владельцу канала, `lead_moderator` и `moderator`. Выполняются, даже
если их отображение выключено: переключатель скрывает сообщения, но не
отключает управление.

| Команда | Действие |
|---|---|
| `!chat refresh` | Перезагружает эмоуты, бейджи и 7TV-косметику |
| `!chat reload` | Перезагружает Browser Source |
| `!chat show` / `!chat hide` | Показывает или скрывает чат |
| `!chat clear` | Очищает сообщения на экране |
| `!chat ping` | Проверяет, что оверлей принимает команды |
| `!chat test [1-50]` | Добавляет тестовые сообщения |

Префиксы `!chat`, `!chatis` и `!chatyx` равноправны, также работают старые
алиасы `!refreshoverlay` и `!reloadchat`. Медиа-команды и `tts` намеренно
не реализованы.

Команды из developer chat `#linaryx` принимает только Twitch-пользователь
`linaryx` (`684505240`), адрес канала обязателен:

```text
!chatyx refresh -c channel
!chatyx reload -c channel1,channel2
!chatyx ping -c all
```

## ⚙️ Как это работает

```text
Twitch IRC / GQL ───────────────┐
7TV / BTTV / FFZ / IVR APIs ────┼──> ChatYX frontend ──> OBS Browser Source
YouTube / Kick ──> chat sources bridge ───┘
```

Frontend статический. Twitch IRC подключается из Browser Source напрямую,
поэтому чат не зависит от backend ChatYX.

<details>
<summary>Статус сервисов</summary>

| Сервис | Статус | Использование |
|---|---|---|
| Frontend | [![Frontend status](https://img.shields.io/website?url=https%3A%2F%2Fchat.ruina.team%2F&style=flat-square&label=status&up_message=online&down_message=offline)](https://chat.ruina.team/) | Настройка и Browser Source |
| Chat sources bridge | [![Chat sources status](https://img.shields.io/website?url=https%3A%2F%2Fytwss.ruina.team%2Fhealth&style=flat-square&label=status&up_message=online&down_message=offline)](https://ytwss.ruina.team/health) | YouTube Innertube и Kick realtime → WebSocket |
| Twitch IRC | ![Twitch IRC](https://img.shields.io/badge/connection-direct-9146FF?style=flat-square&logo=twitch&logoColor=white) | Сообщения и moderation events |
| 7TV API | [![7TV API status](https://img.shields.io/website?url=https%3A%2F%2F7tv.io%2Fv3%2Femote-sets%2Fglobal&style=flat-square&logo=7tv&label=status&up_message=online&down_message=offline)](https://7tv.io/) | Эмоуты, пейнты и EventAPI |
| BetterTTV API | [![BetterTTV API status](https://img.shields.io/website?url=https%3A%2F%2Fapi.betterttv.net%2F3%2Fcached%2Femotes%2Fglobal&style=flat-square&label=status&up_message=online&down_message=offline)](https://betterttv.com/) | Глобальные и канальные эмоуты |
| FrankerFaceZ | [![FrankerFaceZ status](https://img.shields.io/website?url=https%3A%2F%2Fwww.frankerfacez.com%2F&style=flat-square&label=status&up_message=online&down_message=offline)](https://www.frankerfacez.com/) | API эмоутов и бейджей |
| IVR API | [![IVR API status](https://img.shields.io/website?url=https%3A%2F%2Fapi.ivr.fi%2Fv2%2Ftwitch%2Fuser%3Flogin%3Dtwitch&style=flat-square&label=status&up_message=online&down_message=offline)](https://api.ivr.fi/) | Twitch metadata и fallback-бейджи |

Бейджи проверяют HTTP endpoints при загрузке страницы.

</details>

## 🧱 Стек

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
| Chat sources bridge | YouTube.js, Kick public realtime, Bun WebSocket server |
| Интеграции | Twitch IRC/GQL, 7TV, BetterTTV, FrankerFaceZ, IVR |
| Качество | Oxlint, TypeScript, Bun Test, GitHub Actions |
| Деплой | GitHub Pages, Docker, Northflank |

## 📄 Лицензия

ChatYX распространяется под
[GNU GPL версии 3, без «или более поздней версии»](LICENSE) (`GPL-3.0-only`).
Исходное уведомление `Copyright (c) 2025 Linaryx` и текст MIT для ранее
опубликованного кода — в [LICENSE-MIT](LICENSE-MIT). Подробности:
[Licensing](documents/LICENSING.md).
