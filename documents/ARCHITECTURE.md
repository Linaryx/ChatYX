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
