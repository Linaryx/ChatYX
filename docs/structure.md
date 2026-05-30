# ChatYX Structure

## Project Map
- Root: client-side Twitch chat overlay built with `SolidJS + Vite 8`. Build output: `dist/`. Public assets: `public/`. Source: `src/`.
- Routing: manual SPA routing in `src/index.tsx` using `@solidjs/router`.
- Styling: global CSS in `src/root.css`, overlay CSS in `src/styles/chat.css`, generated style helpers in `src/styles/chatStyles.ts`, plus inline styles in setup and fallback routes.
- Tooling: TypeScript split into `tsconfig.app.json` and `tsconfig.node.json`, Oxlint via `.oxlintrc.json`, Vite config in `vite.config.ts`, Renovate in `renovate.json`.

## Source Layout
- `src/routes/` — public route entrypoints.
- `src/components/` — reusable UI components.
- `src/services/chat/` — chat runtime, Twitch IRC, integration layer, emotes, paints, roles, bits, realtime updates.
- `src/services/badges/` — Twitch and third-party badge loaders.
- `src/utils/chat/` — parsing and message-render helpers.
- `src/utils/ui/` — layout, fade, and animation helpers.
- `src/config/` — URL params and Twitch API fallback config.
- `src/styles/` — shared chat CSS and generated style presets.
- `src/types/` — cross-file type definitions.

## Routes
- `src/routes/setup.tsx` — setup UI on `/`; generates overlay URLs.
- `src/routes/chat/channel.tsx` — overlay renderer on `/chat`; reads channel and options from query params.
- `src/routes/[...404].tsx` — fallback for unknown routes.

## URL Configuration
- Source of truth: `src/config/chatUrlParams.ts`.
- Required channel param: `c` with alias `channel`.
- Current URL shape: `/chat?c=forsen&s=2&fd=30&a=true&b=false`.
- Setup page uses `chatConfigToSearchParams`, overlay uses `parseChatConfigFromSearchParams`.

## Components
- `src/components/LoadingScreen.tsx` — loading state while overlay services initialize.
- `src/components/chat/ChatMessageList.tsx` — renders visible message list.
- `src/components/chat/ChatMessage.tsx` — message row wrapper and animation hooks.
- `src/components/chat/ChatNick.tsx` — nick rendering and color handling.
- `src/components/chat/ChatText.tsx` — message body rendering.
- `src/components/chat/ChatBadges.tsx` — badge rendering.
- `src/components/chat/renderMessageContent.tsx` — HTML generation helpers for emotes, cheers, links, and message fragments.

## Services
- Route-scoped services:
- `OverlayRuntime` in `src/services/chat/overlayRuntime.ts` owns bootstrap, lifecycle, batching, event wiring, and Twitch connection orchestration for the overlay route.
- `TwitchService` in `src/services/chat/twitchService.ts` is instantiated by `OverlayRuntime` and owns the Twitch IRC WebSocket lifecycle.
- `ChatISIntegrationService` in `src/services/chat/chatisIntegration.ts` is instantiated by `OverlayRuntime` and manages fade, layout, bot filtering, and CSS injection.
- Singleton services:
- `v3Integration` in `src/services/chat/v3Integration.ts` — higher-level orchestration for modern overlay features.
- `messageManager` in `src/services/chat/messageManager.ts` — deletions, timeouts, and chat clear events.
- `emoteService` in `src/services/chat/emoteService.ts` — 7TV / FFZ / BTTV / cheer emotes, snapshots, and 7TV reloads.
- `colorService`, `paintService`, `channelRolesService`, `bitsService`, `sevenTVEventApi` in `src/services/chat/` — message enrichment and realtime support.
- `badgeService`, `bttvBadgeService`, `ffzapBadgeService`, `chatisBadgeService`, `chatterinoBadgeService` in `src/services/badges/` — badge loading and merging.

## Utils
- `src/utils/chat/` — `chatUtils`, `markdownParser`, `urlParser`, `sanitize`, `emojiRenderer`, `emojiUtils`, `replyParser`, `userNoticeParser`, `actionMessages`, `zeroWidthEmotes`, `badgePriority`.
- `src/utils/ui/` — `layoutUtils`, `layoutManager`, `animationUtils`, `fadeUtils`.
- Infra kept at root: `src/utils/logger.ts`, `src/utils/botFilter.ts`.

## Runtime Flow
1. `src/routes/chat/channel.tsx` parses the initial query params and creates `OverlayRuntime`.
2. `OverlayRuntime` resolves the final `ChatConfig` and injects generated size/shadow/stroke/variant styles.
3. `OverlayRuntime` creates `ChatISIntegrationService` and initializes overlay helpers.
4. `OverlayRuntime` resolves channel ID through local API with fallback endpoints.
5. `OverlayRuntime` initializes `v3Integration` and background badge / emote / role loading.
6. `OverlayRuntime` connects `TwitchService` to Twitch IRC.
7. Incoming IRC messages are filtered, enriched, snapshotted, queued, batched into route state, then rendered by chat components.
8. Deletions, timeouts, clears, fade scheduling, and 7TV updates are handled through runtime-managed service callbacks and window events.

## Build Notes
- Dev: `bun run dev`.
- Preview: `bun run start`.
- Lint: `bun run lint`.
- Typecheck: `bun run typecheck`.
- Build: `bun run build`.
- There are currently no test files in the repository.
