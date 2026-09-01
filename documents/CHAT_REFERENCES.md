# Chat References

Каталог внешних чатов, форков, оверлеев и сервисов, которые исследуются для
ChatYX. Это **не** список зависимостей. Код из GPL, AGPL, кастомно
лицензированных проектов или проектов без лицензии не копируется в MIT-проект
ChatYX: мы используем только independently implemented behavior.

Проверено: 30 августа 2026. `Unknown` означает, что canonical source или
лицензию публично подтвердить не удалось.

## Как Добавлять Источник

Для новой записи нужны canonical URL, source, demo, docs, license, maintainer,
features, status и risks. Если поле не подтверждено, пиши `Unknown`, а не
предполагай значение.

Статусы:

- `primary` - основной проект или штатный provider ChatYX;
- `reference` - поведение изучалось, код не переносится;
- `candidate` - источник добавлен, но ещё не прошёл аудит;
- `avoid` - не использовать как source/runtime dependency.

## Проверенная Lineage

```text
giambaJ/jChat -> IS2511/ChatIS-v2 -> Johnnycyan/cyan-chat -> daviirodrig/cyan-chat
```

Оригинальный `reyohoho/reyohoho` отключён GitHub и его исходники нельзя
проверить. Поэтому продолжение `daviirodrig/cyan-chat -> reyohoho chat`
считается **неподтверждённым**.

## Chat Overlays

Оверлеи для отображения чата в OBS/стриминг-софте. Отсортированы по дате
создания (от старых к новым).

### Cyan Lineage (GPL-3.0)

Форки jChat → ChatIS → Cyan, образующие единую цепочку наследования.

| Проект | Source | Demo / Docs | License | Stack / Платформы | Что Изучаем | Status / Risks |
|---|---|---|---|---|---|---|
| jChat | [giambaJ/jChat](https://github.com/giambaJ/jChat) | [Demo](https://www.giambaj.it/twitch/jchat/) · [README](https://github.com/giambaJ/jChat/blob/main/README.md) | GPL-3.0 | JS, HTML, CSS, PHP; Twitch | 7TV/BTTV/FFZ, badges, Twitter emoji, styles, fade, filters, `!refreshoverlay` | reference; GPL and third-party asset terms |
| ChatIS-v2 | [IS2511/ChatIS-v2](https://github.com/IS2511/ChatIS-v2) · [ChatIS-core](https://github.com/IS2511/ChatIS-core) | [chatis.is2511.com](https://chatis.is2511.com/) · [README](https://github.com/IS2511/ChatIS-v2/blob/main/README.md) | GPL-3.0 | JS overlay; TypeScript core; Twitch | emotes, badges, fonts, animation, filters, TTS behavior | reference; inherited GPL obligations |
| Cyan Chat | [Johnnycyan/cyan-chat](https://github.com/Johnnycyan/cyan-chat) | [chat.johnnycyan.com](https://chat.johnnycyan.com/) · [README](https://github.com/Johnnycyan/cyan-chat/blob/main/README.md) | GPL-3.0 | JS/jQuery, Webpack, Go backend; Twitch + optional YouTube | announcements, layouts, paints, TTS, image/YouTube commands | reference; media/TTS inputs and GPL require review |
| mirronake/chat | [mirronake/chat](https://github.com/mirronake/chat) | Unknown | Verify on update | Cyan-derived source to re-check | announcement styling | reference; provenance/branch parity must be checked per commit |
| Davii Chat | [daviirodrig/cyan-chat](https://github.com/daviirodrig/cyan-chat) | [README](https://github.com/daviirodrig/cyan-chat/blob/main/README.md) | GPL-3.0 | Go backend + Webpack/JS overlay; Twitch + optional YouTube | direct Cyan fork: TTS, emotes, badges, paints, commands | reference; README still points at Johnnycyan deployment; repository `package.json` says ISC but GPL `LICENSE` is authoritative |

### Independent Overlays (по дате создания)

Самостоятельные проекты, не являющиеся частью Cyan-lineage.

| Проект | Source | Demo / Docs | License | Stack / Платформы | Что Изучаем | Status / Risks |
|---|---|---|---|---|---|---|
| StreamChatOverlay (em1dev) | [em1dev/StreamChatOverlay](https://github.com/em1dev/StreamChatOverlay) | [chat.emy.dev](https://chat.emy.dev) · [README](https://github.com/em1dev/StreamChatOverlay/blob/main/README.md) | custom / inspect [LICENSE.md](https://github.com/em1dev/StreamChatOverlay/blob/main/LICENSE.md) | React/Vite/TS + Express/TS; Twitch | Browser TTS, pronouns, 7TV/BTTV/FFZ, font/size controls, moderation cancellation | AuthService and hosted backend dependency; license needs review |
| UChat / bChat | [Fiszh/UChat](https://github.com/Fiszh/UChat) · [ItsBr0dyy fork](https://github.com/ItsBr0dyy/UChat) | [chat.unii.dev](https://chat.unii.dev/) · [bchat.itsbr0dyy.dev](https://bchat.itsbr0dyy.dev/) · [README](https://github.com/Fiszh/UChat/blob/main/README.md) | AGPL-3.0-or-later | Svelte 5, SvelteKit, Vite, TS; Twitch + Kick | native/platform badges, 7TV/BTTV/FFZ, 7TV cosmetics, zero-width, events, filters, visual controls | AGPL; external services; bChat deployment/canonical-domain ownership is not fully verified |
| StreamChatOverlay (ataoytun) | [ataoytun/StreamChatOverlay](https://github.com/ataoytun/StreamChatOverlay) | [README](https://github.com/ataoytun/StreamChatOverlay/blob/main/README.md) | MIT | .NET 8/WebView2; Twitch + Kick | desktop positioning, stacked/side-by-side layout, capture controls | separate project with a name collision; maintenance uncertain |
| StreamChatOverlay (uruskan) | [uruskan/StreamChatOverlay](https://github.com/uruskan/StreamChatOverlay) | [README](https://github.com/uruskan/StreamChatOverlay/blob/main/README.md) · [release v1.0.1](https://github.com/uruskan/StreamChatOverlay/releases/tag/v1.0.1) | MIT | .NET 9/WPF; Twitch + Kick | desktop overlay, animated emotes, sounds, platform badges, tray/position controls | Windows-only; manual Kick chatroom setup |
| MultiChat | [gxufy/multichat-gxufy](https://github.com/gxufy/multichat-gxufy) | [Generator](https://gxufy.com/multichat) · [README](https://github.com/gxufy/multichat-gxufy/blob/main/README.md) | AGPL-3.0-or-later | Next.js, React, TS, Tailwind, Supabase, Pusher, Zod; Twitch/Kick/YouTube/TikTok | unified chat, viewer counter, pins/replies, Shared Chat/Hype Train, cosmetics, filtering, TTS/image/YouTube commands | AGPL; young project; external backend/platform dependency; user media URLs are untrusted |
| ChatYX | [Linaryx/ChatYX](https://github.com/Linaryx/ChatYX) | [chat.ruina.team](https://chat.ruina.team/) · [README](README.md) | MIT | SolidJS, TypeScript, Vite; Twitch + YouTube | OBS overlay, emotes, badges, paints, RTE opt-ins, Shared Chat, events, TTS commands | primary; external provider/API availability remains operational risk |

### Unknown Source / Unverified

| Проект | Source | Demo / Docs | License | Stack / Платформы | Что Изучаем | Status / Risks |
|---|---|---|---|---|---|---|
| Chataphi | Unknown | [chataphi.com](https://chataphi.com) | Unknown | Unknown | Twitch, YouTube, Kick, TikTok claimed by site | source, API, privacy policy, TTS/media and license unverified |
| XyliChat | Unknown | [chat.xyli.eu](https://chat.xyli.eu/) | Unknown | [Manukq](https://mnq.lol/) | deployed browser overlay; Twitch implied | public source and license not located |
| Reyohoho Chat | [disabled repository](https://github.com/reyohoho/reyohoho) | [deployed overlay](https://reyohoho.space:4437/chat/) | Unknown | deployed artifact only | RTE behavior, badge/paint responses | avoid as source; disabled source, undocumented runtime/API |

## TTS И Audio References

| Project | Source / Docs | License | Maintainer / Activity | Architecture / Features | Risks |
|---|---|---|---|---|---|
| twitch-voxer | [w0rxbend/twitch-voxer](https://github.com/w0rxbend/twitch-voxer) · [README](https://github.com/w0rxbend/twitch-voxer/blob/main/README.md) | MIT | [w0rxbend](https://github.com/w0rxbend); active Aug 2026 | Twitch EventSub/twitchio -> normalization/language detection -> Supertonic -> ffmpeg -> Starlette/WebSocket/OBS; per-user voices, queue, bot/link filtering | Twitch credentials, local HTTP/WS, temporary audio files, Supertonic/ffmpeg |
| stream-cheremsha | [olexanderboychuk/stream-cheremsha](https://github.com/olexanderboychuk/stream-cheremsha) · [README](https://github.com/olexanderboychuk/stream-cheremsha/blob/main/README.md) | GPL-3.0 | [olexanderboychuk](https://github.com/olexanderboychuk); v0.14.0 Aug 2026 | PySide6 desktop pipeline; Edge/Google TTS, audio normalization, OBS/Telegram/donation integrations; Twitch/YouTube/TikTok/Kick | GPL; tokens, unofficial Kick transport, tunnel credentials need scrutiny |
| utility_streamer | [Beginning0/utility_streamer](https://github.com/Beginning0/utility_streamer) · [Docs](https://beginning0.github.io/utility_streamer/index.html) | MIT | [Beginning0](https://github.com/Beginning0); active Aug 2026 | Streamer.bot WebSocket -> browser/OBS TTS; voice, volume, rank threshold, localStorage/IndexedDB | requires local Streamer.bot WebSocket |
| bottarga | [icsboyx/bottarga](https://github.com/icsboyx/bottarga) · [Docs](https://github.com/icsboyx/bottarga/blob/master/docs/README.md) | MIT | [icsboyx](https://github.com/icsboyx); active Jun 2026 | Rust/Tokio Twitch IRC, async queue/player, persistent TOML voices, pitch/rate/volume, `!stop` | local audio and external command URLs; operational config may be sensitive |
| beepbot | [mavis112/beepbot](https://github.com/mavis112/beepbot) · [README](https://github.com/mavis112/beepbot/blob/main/README.md) | MIT | [mavis112](https://github.com/mavis112); active Aug 2026 | Go IRC bot, sound/TTS queue/mixer, multilingual TTS, sound effects and moderation controls | web TTS cap; local audio device; effect volumes need safety controls |
| ParoChan | Unknown | Unknown | Unknown | historical name from earlier research only | upstream cannot be verified; do not claim a license or architecture |

## RTE И Deployed Third-Party Services

Эти URLs зафиксированы как **наблюдаемые deployed endpoints**, а не как
канонические public APIs. Схемы могут измениться без notice.

| Service | URL / Source | ChatYX Role | Observed Contract | Risks |
|---|---|---|---|---|
| RTE proxy | [ext.rte.net.ru:8443](https://ext.rte.net.ru:8443) | opt-in allowlisted proxy | HTTP proxy for public emote/badge/TTS upstreams | no SLA/schema; do not send OAuth, IRC, GQL, cookies or arbitrary user URLs |
| Reyohoho badges | `https://ext.rte.net.ru:8443/api/badge-users/{twitchId}` | optional user badge | public read; undocumented response | validate softly; missing/malformed response must not block rendering |
| Reyohoho paints | `https://ext.rte.net.ru:8443/api/paint/{twitchId}` | optional user paint | public read; undocumented response | soft fallback to existing 7TV cosmetics |
| JustDavi Azure TTS | [chatsemban.justdavi.dev/api/tts](https://chatsemban.justdavi.dev/api/tts) | opt-in Azure audio | proxied GET with `text` and `voice`; accepts `audio/mpeg` | sends chat text to third party; direct CORS unavailable; quota/privacy/SLA risk |
| ChatIS TTS | [chatis.is2511.com/v2/tts](https://chatis.is2511.com/v2/tts/) | opt-in regular TTS | proxied POST `{text, voice}`; observed `{success, speak_url}` | temporary signed URL; never cache/log; service/backend origin undocumented |
| Reyohoho extension source | [reyohoho-twitch-extension-old](https://github.com/reyohoho/reyohoho-twitch-extension-old) | historical custom-badge/proxy reference | historical source only | not a spec for current RTE endpoints |

## Primary Providers Used By ChatYX

| Provider | Official Source / Docs | Usage | Contract / Risk |
|---|---|---|---|
| Twitch IRC | [IRC docs](https://dev.twitch.tv/docs/irc/) | direct messages and moderation events | never send IRC/OAuth through RTE |
| Twitch Helix | [API docs](https://dev.twitch.tv/docs/api/) | public/authorized Twitch data | endpoint scopes/rate limits; GQL is an undocumented/private surface |
| YouTube Live Chat | [LiveChatMessages](https://developers.google.com/youtube/v3/live/docs/liveChatMessages) · [streamList](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/streamList) | chat via WebSocket bridge | official write/moderation needs OAuth; bridge contract is separate |
| 7TV | [API](https://github.com/SevenTV/API) · [EventAPI](https://github.com/SevenTV/EventAPI) | emotes, paints, cosmetics, live updates | use V3; public data can change asynchronously; respect rate limits |
| BetterTTV | [API docs](https://betterttv.com/developers/api) · [WebSocket docs](https://betterttv.com/developers/websocket) | global/channel emotes | public but third-party API stability is not guaranteed |
| FrankerFaceZ | [Developer API](https://www.frankerfacez.com/developers) · [Source](https://github.com/FrankerFaceZ/FrankerFaceZ) | emotes and badges | public unauthenticated API; schema/addon badges vary |
| IVR | [api.ivr.fi](https://api.ivr.fi/) | Twitch metadata fallback | no stable versioned schema verified; handle null/404/rate limits |

## Local `codesnippets` Provenance

| Local Path | Remote / Commit | Status | Notes |
|---|---|---|---|
| `codesnippets/jChat` | `giambaJ/jChat` @ `86a0b95` | valid upstream checkout | GPL-3.0 |
| `codesnippets/ChatIS-v2` | `IS2511/ChatIS-v2` @ `f478edf` | valid upstream checkout | GPL-3.0 |
| `codesnippets/cyan-chat-upstream` | `Johnnycyan/cyan-chat` @ `36887b4` | valid upstream checkout | GPL LICENSE takes precedence over conflicting `package.json` ISC field |
| `codesnippets/cyan-chat` | resolves to ChatYX parent repo | copied derivative | not an independent Cyan source checkout |
| `codesnippets/Chatterino7` | none | empty placeholder | not a source checkout |
| `codesnippets/hars` | resolves to ChatYX parent repo | avoid | HAR capture can contain request/session data; never publish or runtime-use it |

## Queue For New Finds

| Project / Service | Canonical URL | Source | License | Features To Check | Status / Risks |
|---|---|---|---|---|---|
| _add project_ | _demo/homepage_ | _repository/docs_ | _license or Unknown_ | _platforms, emotes, badges, cosmetics, TTS, commands, moderation_ | candidate; _compatibility and privacy risks_ |
