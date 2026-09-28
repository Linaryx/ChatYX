# ChatYX architecture

ChatYX is organized by feature boundaries. Routes render UI and create one application-level
controller; they do not own network clients, reconnect loops, or long-lived timers.

## Dependency direction

```text
routes -> features -> services/config/utils
                     -> platform adapters
```

- `routes` bind Solid signals and JSX to a feature's public API.
- `features/*/application` coordinate use cases and own lifecycle.
- `features/*/model` contains pure state transformations and view calculations.
- `services` implement platform and browser capabilities.
- A service must not import a feature or route.

Feature internals use direct imports. A feature-level `index.ts` is a public API for consumers
outside that feature.

## Chat overlay

`createChatOverlayApplication` is the composition root for the chat route. It constructs exactly
one live or preview runtime and one predictions controller.

```text
channel.tsx
  -> createChatOverlayApplication
     -> OverlayRuntime | PreviewRuntime
     -> PredictionController
```

Each runtime owns the resources it starts and releases them in `destroy()`. Cross-module events
use typed callbacks; browser-global custom events are reserved for actual browser integration
boundaries, not communication between services in the same object graph.

The implementation is split by capability rather than generic technical buckets:

```text
src/features/chat-overlay/
  application/  # composition, live/preview/predictions lifecycle, chat commands
  model/        # pure overlay style calculations

src/services/chat/
  assets/       # emotes, bits, channel roles
  external/     # YouTube/Kick bridge clients
  preview/      # preview message and user data providers
  rte/          # RTE cosmetics and TTS adapters
  runtime/      # reusable live-chat pipeline/queue/connection components
  seven-tv/     # 7TV protocol, cosmetics, and paint rendering
  twitch/       # IRC, GQL, and recent-message clients
```

Provider folders do not expose internal barrels. Cross-feature consumers use
`src/services/chat/index.ts`; chat internals import concrete sibling modules directly.

## Setup feature

`src/routes/setup.tsx` is a UI composition root: it binds signals and JSX, and
nothing else. Everything with a contract of its own lives outside it.

```text
src/config/setupConfig.ts             # form state -> ChatConfig, ChatConfig -> overlay URL
src/config/formValues.ts              # form string -> config value, mirroring chatUrlParams kinds
src/config/setupTemplates.ts          # built-in and user templates, validation, serialization
src/services/setup/botProfiles.ts     # Twitch/Kick bot lookups and bot-list helpers
src/services/setup/localFonts.ts      # Local Font Access capability
src/services/storage/setupStorage.ts  # every localStorage access the setup page makes
src/features/setup/previewSync.ts     # the setup side of the preview iframe protocol
src/features/setup/settingsSearch.ts  # searchable elements, highlights, counter, reveal
src/features/setup/setupDocument.ts   # document style lock and reduced-motion watch
src/components/setup/*                # section layout, rows, chips and the feature's controls
```

The overlay URL is a public contract: deployed OBS browser sources depend on it.
It is therefore produced in one place, `buildOverlayUrl`, and covered by tests
that round-trip through `parseChatConfigFromSearchParams`. Renaming or dropping a
query parameter is a breaking change, not a rename.

`config` may depend on a dependency-free `services` leaf (as `setupTemplates`
does on `setupStorage`), because services are the lower layer for capabilities.
The reverse — a service importing a route or a feature — remains forbidden.

## Icons and design tokens

UI icons come from `@hugeicons/core-free-icons` and are rendered through the
typed `src/components/ui/icon.tsx` wrapper. There is no icon font, no `hgi-*`
class string, and no inline SVG standing in for a UI icon. Icons are imported by
subpath (`@hugeicons/core-free-icons/TextIcon`) because the package barrel is
675 KB while a single icon is under a kilobyte.

Two kinds of drawing are deliberately not UI icons and stay inline: monochrome
platform glyphs, which have exactly one owner in
`src/components/brand/PlatformGlyph.tsx`, and bespoke visuals such as the
sparkline and the event, reply and role graphics. The public brand chips under
`public/img/` are a different rendering for a different surface, not a duplicate
of the glyph components.

Design tokens are consumed as CSS custom properties. `src/styles/chat.css` owns
the rules and `overlayStyleManager` writes the property values. Generating a
rule whose *shape* depends on a preset table is the pattern this refactor is
converting away from; `src/styles/chatStyles.ts` is the known remainder. Note
that its `SIZE_CONFIGS` table is also read by `renderMessageContent.ts` for emote
geometry, so the conversion keeps one table as the single source of truth and has
it publish custom properties rather than deleting it. Generated CSS remains
correct at integration boundaries — provider cosmetics (7TV paint) and emote
modifiers — because there the rule shape is data the provider supplies.

## Refactoring rules

1. Extract ownership before extracting files: every timer, socket, listener, and mutable cache has
   one lifecycle owner.
2. Keep calculations pure where possible; put `window`, `document`, storage, and network access at
   the edges.
3. Pass dependencies through constructors or factories. Do not add a service locator or DI
   container.
4. Split by reasons to change, not by file size. A cohesive implementation may remain in one file.
5. Migrate one feature path at a time and retain characterization tests around lifecycle behavior.

## References

- Mark Seemann, Composition Root: https://blog.ploeh.dk/2011/07/28/CompositionRoot/
- Gary Bernhardt, Functional Core, Imperative Shell:
  https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell
- Feature-Sliced Design overview: https://feature-sliced.design/docs/get-started/overview
- Martin Fowler, Modularizing React Applications with Established UI Patterns:
  https://martinfowler.com/articles/modularizing-react-apps.html
