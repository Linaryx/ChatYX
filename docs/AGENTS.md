# ChatYX Agent Guide

- Purpose: Twitch chat overlay for OBS / XSplit. Current app is a client-side `SolidJS + Vite 8` SPA with Twitch IRC, multi-platform emotes, badges, and optional cheers support through a local API fallback chain.
- Stack: SolidJS 1.9, Vite 8, TypeScript 6, Bun 1.x.

## Run
- Install deps: `bun install`
- Dev server: `bun run dev` on port `3000`
- Production build: `bun run build`
- Preview build: `bun run start`
- Lint: `bun run lint`
- Typecheck: `bun run typecheck`

## Routing
- `/` -> `src/routes/setup.tsx`
- `/chat` -> `src/routes/chat/channel.tsx`
- `*` -> `src/routes/[...404].tsx`

## Current URL Model
- Overlay reads configuration from query params, not path params.
- Required channel param is `c` with alias `channel`.
- Example: `/chat?c=forsen&s=2&fd=30&a=true&b=false`
- Source of truth for params and defaults: `src/config/chatUrlParams.ts`

## Architecture Essentials
- `src/index.tsx` manually sets up the SPA router; this repo is not using `SolidStart`.
- `src/routes/setup.tsx` generates overlay URLs using `chatConfigToSearchParams`.
- `src/routes/chat/channel.tsx` is now a thin view/controller for overlay state and rendering.
- `src/services/chat/overlayRuntime.ts` owns overlay bootstrapping, style injection, service initialization, Twitch connection, batching, and cleanup.
- `src/services/chat/` contains the runtime chat services.
- `src/services/badges/` contains badge loaders and mergers.
- `src/utils/chat/` contains parsing and render helpers.
- `src/utils/ui/` contains animation, fade, and layout helpers.
- `TwitchService` and `ChatISIntegrationService` are route-scoped instances created by `OverlayRuntime`.
- Most other services are exported singletons and should be reused instead of re-instantiated.

## Main Services
- `v3Integration` orchestrates feature initialization and realtime integration.
- `messageManager` handles deletes, timeouts, and clear events.
- `emoteService` loads 7TV / FFZ / BTTV / cheer emotes and supports 7TV reloads.
- `badgeService` and related badge services merge Twitch and third-party badges.
- `sevenTVEventApi` handles realtime 7TV updates.
- `colorService`, `paintService`, `channelRolesService`, and `bitsService` enrich rendered messages.

## Message Flow
1. Parse URL params with `parseChatConfigFromSearchParams`.
2. Initialize `ChatISIntegrationService` and generated CSS helpers.
3. Resolve channel ID through local API or fallback endpoints.
4. Initialize `v3Integration` and background asset loading.
5. Connect `TwitchService` to Twitch IRC.
6. Filter and enrich messages, snapshot emotes, queue batches, and render them through chat components.
7. Apply fade, layout, animation, deletion, timeout, and 7TV update logic through services and window events.

## Conventions And Pitfalls
- Do not assume `/v3/*` routes exist; current public routes are `/` and `/chat`.
- Do not assume a utility CSS framework is present; the app is styled with global CSS files and inline style objects.
- Keep URL param parsing in `src/config/chatUrlParams.ts`.
- `parseChatConfigFromSearchParams` already supports short and alias query keys.
- 7TV EventAPI requires a numeric Twitch channel ID; username fallback disables that connection path.
- Cheermotes still depend on the local API path when fallback providers do not expose equivalent data.

## Observability
- Logging lives in `src/utils/logger.ts`.
- Important categories are exposed through `LOG_CATEGORIES` and used across Twitch IRC, integration, emotes, badges, animation, and fade flows.
