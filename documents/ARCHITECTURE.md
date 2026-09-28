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
- `features/*/model` contains pure state transformations and contracts shared
  with other layers.
- `services` implement platform and browser capabilities.
- A service must not import a feature or route.
- A feature must not import a component. A contract that both a feature and a
  component need lives in the feature's `model`, in `config/` or in `services/`,
  and the component imports it — never the reverse. `SetupSectionId` is the
  worked example: it lives in `features/setup/model/setupSections.ts` because the
  route, the workspace layout and the settings search all need it.

Feature internals use direct imports. A feature-level `index.ts` is a public API for consumers
outside that feature.

## Chat overlay lifecycle and asset ownership

`createChatOverlayApplication` is the composition root for the chat route. It constructs exactly
one live or preview runtime and one predictions controller.

```text
channel.tsx
  -> createChatOverlayApplication
     -> OverlayRuntime | PreviewRuntime
     -> PredictionController
```

Construction and teardown agree about ownership: `ChatOverlayApplication.destroy()`
releases what its constructor built, is idempotent, and is terminal, so it is
also safe while `start()` is still awaiting `initialize()`. A runtime that is
destroyed stops publishing: the live runtime guards every step of its
initialization with a generation, and the preview runtime ignores configuration
and timer callbacks after destruction.

Asset state has one owner per document. `emoteService`, `badgeService`,
`sevenTVCosmeticsService`, `mentionStyleService` and `chatFeatureIntegration` are
process-wide singletons, and the runtime that filled them is the runtime that
resets them in `destroy()`. Resetting alone is not enough, because a request
that is already in flight can still resolve: each of those services carries a
generation that `reset()` (or `clearAllCaches()`) bumps, and a load captures it
on entry so a late response cannot commit into the store the next runtime owns.

`ChatAssetLoader` needs none of that: it is constructed per live runtime, and its
shared-channel map and channel-scoped caches die with the instance.

The preview runtime is the only runtime in its document — the setup page loads it
in an iframe, which has its own module instances — so its teardown clears the
process-wide state it claimed. For the same reason the RTE proxy flag is a plain
boolean rather than a lease or a reference count: exactly one chat runtime exists
per document, and only the runtime that set the flag clears it.

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

`runtime/` also owns the layout and fade managers. They are chat overlay
infrastructure, not general helpers — the stylesheets they publish are written
against `#chat_container`, `.chat_line` and `.message-fade-out` — so they sit
next to the pipeline that owns them instead of in `utils/`.

Provider folders do not expose internal barrels. Cross-feature consumers use
`src/services/chat/index.ts`; chat internals import concrete sibling modules directly.

## Setup feature

`src/routes/setup.tsx` is a UI composition root: it binds signals, wires feature
APIs into effects, composes sections and renders JSX, and nothing else.
Everything with a contract of its own lives outside it.

```text
src/features/setup/model/setupSections.ts  # setup section identity
src/features/setup/previewSync.ts          # the setup side of the preview iframe protocol
src/features/setup/settingsSearch.ts       # searchable elements, highlights, counter, reveal
src/features/setup/setupDocument.ts        # document scroll lock and reduced-motion watch
src/config/setupConfig.ts                  # form state -> ChatConfig, ChatConfig -> overlay URL
src/config/formValues.ts                   # form string -> config value, mirroring chatUrlParams kinds
src/config/setupTemplates.ts               # built-in and user templates, validation, serialization
src/services/setup/botProfiles.ts          # Twitch/Kick bot lookups (profiles)
src/services/setup/channelSearch.ts        # Twitch/Kick channel search and its normalizers
src/services/setup/logins.ts               # pasted-login normalization shared by the three lists
src/services/setup/localFonts.ts           # Local Font Access capability
src/services/storage/setupStorage.ts       # every localStorage access the setup page makes
src/components/setup/*                     # section layout, rows, chips and the feature's controls
src/components/setup/setupText.ts          # label resolution, kept free of JSX so it stays testable
```

The row descriptors under `components/setup/sections/` are pure descriptor
factories: they take one source object of signals and callbacks and return the
rows. They import translations, UI primitives and types only, so they cannot
grow into a second route.

The overlay URL is a public contract: deployed OBS browser sources depend on it.
It is therefore produced in one place, `buildOverlayUrl`, and covered by tests
that round-trip through `parseChatConfigFromSearchParams`. Renaming or dropping a
query parameter is a breaking change, not a rename.

`config` may depend on a dependency-free `services` leaf (as `setupTemplates`
does on `setupStorage`), because services are the lower layer for capabilities.
The reverse — a service importing a route or a feature — remains forbidden.

## Icons and brand assets

UI icons come from `@hugeicons/core-free-icons` and are rendered through
`src/components/ui/icon.tsx`, which is a thin wrapper over the vendor's
`HugeiconsIcon` from `@hugeicons/solid-js`. The vendor owns SVG rendering; the
wrapper owns only the project convention — `currentColor`, `1em` as the default
size, and decorative-by-default accessibility — and the icon payload keeps its
own stroke width.

There is no icon font, no `hgi-*` class string, and no inline SVG standing in for
a UI icon. Icons are imported by subpath (`@hugeicons/core-free-icons/TextIcon`)
because the package barrel is 675 KB while a single icon is under a kilobyte.

Two kinds of drawing are deliberately not UI icons and stay inline: monochrome
platform glyphs, which have exactly one owner in
`src/components/brand/PlatformGlyph.tsx`, and bespoke visuals such as the
sparkline and the event, reply and role graphics. The public brand chips under
`public/img/` are a different rendering for a different surface, not a duplicate
of the glyph components.

## Plain and generated CSS

Design tokens are consumed as CSS custom properties. `src/styles/chat.css` owns
the overlay's rules and `overlayStyleManager` writes only property values and two
root attributes, so the rule shape is fixed at build time.

Two boundaries are still allowed to generate CSS, because there the rule shape is
data supplied from outside rather than a design decision:

- provider cosmetics (7TV paint), where colours and gradients arrive as protocol
  data;
- emote modifiers, where geometry depends on the emote's own dimensions.

Everything else prefers a stable rule plus a custom property. The same split
applies away from the overlay: the setup page's document lock is a `data-*`
attribute on the root and `SetupWorkspace.css` owns what that means, so the
lifecycle helper holds state rather than a colour.

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
