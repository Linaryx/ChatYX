# ChatYX Refactor Audit

Evidence-based architecture and technical-debt audit of the ChatYX repository.

Scope: `src/`, `services/`, `tests/`, `scripts/`, `public/`, `documents/`.
Method: module-graph greps across the whole tree, targeted deep reads of the
architecture-sensitive subtrees listed in `documents/REFACTORING.md` section 7,
then independent re-verification of every load-bearing claim. Claims marked
**verified** were re-checked directly; the rest carry a `file:line` citation for
follow-up confirmation before action.

Scores use the scale from `documents/REFACTORING.md` section 23:
`0 = no meaningful problem found`, `10 = severe systemic problem`.

---

## 1. Scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Architecture coupling | 3 | **verified** No `services/` → `routes/`/`features/` import exists, and no `components/` → `services/`/`config/` import exists. The documented dependency direction holds at the module-graph level. Remaining coupling is UI reaching into mutable singletons: `src/components/chat/ChatBadges.tsx:4,133,193-197` → `badgeService`; `src/components/chat/ChatMessage.tsx:13,167` → `sevenTVCosmeticsService`; `src/components/chat/renderMessageContent.ts:4` → `bitsService`. |
| Responsibility mixing | 7 | `src/routes/setup.tsx` (2779 lines) owns persistence (`:133-156`), browser capability sniffing (`:158-175`), two remote fetchers (`:212-318`), font enumeration (`:1375-1398`), document style locking (`:634-684`), DOM search (`:686-731`), overlay URL construction (`:1012-1028`) and the full config projection (`:885-992`). `src/components/chat/renderMessageContent.ts` performs network resolution (`:203`, `:244`) and DOM construction (`:557-558`) inside a renderer. |
| UI duplication | 5 | **verified** 42 raw `<button>` elements exist while `src/components/ui/button.tsx` provides `Button` — 19 in `src/routes/setup.tsx`, 8 in `src/components/setup/SetupImportCard.tsx`, 7 in the dev route. 14 raw `<input>` exist while `src/components/ui/input.tsx` provides `Input` — 7 in `src/routes/setup.tsx`, 2 in `SetupImportCard.tsx`. |
| CSS inconsistency | 6 | **verified** Two parallel token systems coexist. `src/root.css:10-17` defines `--bg`, `--panel`, `--text`, `--text-secondary`, `--border`, `--input-bg`, `--button-bg`, `--button-text`; `src/app.css:34-78` defines the SolidCN/shadcn set `--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--ring`. `--border` is declared in **both** files with incompatible values (`#3a3a3a` at `root.css:14` vs `240 5.9% 90%` at `app.css:51`); since `src/index.tsx:7-8` imports `root.css` then `app.css`, the app.css declaration silently wins. 74 hex literals and 194 `rgb()/hsl()` literals remain in CSS. 42 `!important` occurrences. |
| Icon inconsistency | 4 | **verified** Two icon systems are in active use. `lucide-solid` supplies 5 controls through deep subpath imports (`setup.tsx:65-67,88-89` → `Monitor`, `Pause`, `Play`, `SlidersHorizontal`, `X`). A Hugeicons **font** supplies 21 more: `index.html:9` loads `%BASE_URL%hugeicons/icons.css`, backed by `public/hugeicons/hgi-stroke-rounded.woff2` (964 KB) plus a 420 KB stylesheet, used through stringly-typed class names. Brand logos are duplicated as both public assets (`public/img/platform-twitch.svg`, `platform-youtube.svg`, `platform-kick.svg`) and inline SVG (`src/routes/setup.tsx:2143,2152`; `src/components/setup/TwitchChannelField.tsx:456-482`). |
| Dependency overlap | 2 | 9 runtime dependencies, all referenced. `class-variance-authority` is used in exactly two files (`src/components/ui/button.tsx:1`, `src/components/ui/badge.tsx:1`), which is a legitimate variant contract rather than overlap. `lucide-solid` and the Hugeicons font are two libraries solving the same responsibility, which is the real (minor) overlap. |
| Global state / side effects | 8 | **verified** `OverlayStyleManager.cleanup()` (`src/services/chat/runtime/overlayStyleManager.ts:67`) has no caller outside `apply()` and is never invoked from `liveRuntime.destroy()` (`src/features/chat-overlay/application/liveRuntime.ts:306-322`). **verified** `RteCosmeticsService.clear()` (`src/services/chat/rte/cosmeticsService.ts:178`) has zero call sites. **verified** `YouTubeChatService` is exported at `src/services/chat/index.ts:28` but never instantiated. Unbounded module caches with no reset path: `src/services/badges/badgeService.ts:182-186`, `src/services/chat/assets/emoteService.ts:37-49`, `src/services/chat/seven-tv/cosmeticsService.ts:476`, `src/services/chat/seven-tv/eventApi.ts:103-108`. `src/services/network/rteProxyTransport.ts:35` holds a process-global flag that is never reset on teardown. |
| Testability | 4 | 42 test files give good breadth over parsing, rendering, config and runtime policy. Teardown is largely unverified: `tests/chatRuntimeLifecycle.test.ts` contains one destroy assertion. Several tests bypass encapsulation with `(runtime as any)` private-field pokes. |
| Naming / discoverability | 6 | **verified** `src/lib/utils.ts` (6 lines, exports `cn()`) and `src/utils/` (30 files) use the same word for two unrelated things. **verified** `ChatConfig` is defined in `src/config/chatUrlParams.ts` but imported from `~/utils/chat` by 15 files through a two-hop barrel. **verified** Two distinct classes are both named `LayoutManager` inside one directory: `src/utils/ui/layoutManager.ts:19` and `src/utils/ui/layoutUtils.ts:164`. `src/components/ColorPickerField.tsx` sits at the `components/` root while every peer feature component lives under `components/setup/`. |
| **Overall technical debt** | **6** | Debt is concentrated rather than systemic: one monolith route, one un-owned singleton layer, one split token system, one icon delivery mechanism that is too heavy. |

---

## 2. Top architectural hotspots

### 2.1 `src/routes/setup.tsx` — 2779 lines

- **Responsibility currently owned:** UI composition plus persistence, browser
  capability detection, remote fetch orchestration, setup model/state
  operations, preview synchronization, DOM search, document style locking and
  serialization/mapping.
- **Responsibility that does not belong there:** everything except composition.
  Concretely: storage access (`:133-156`), UA sniffing (`:158-175`), Twitch and
  Kick bot-profile fetchers (`:212-318`), `queryLocalFonts` handling
  (`:1375-1398`), `document.documentElement`/`body`/`#root` style mutation
  (`:634-684`), `document.querySelectorAll` search (`:686-731`), and
  `buildChatUrl` (`:1012-1028`).
- **Proposed owner:** `features/setup/` for state and preview coordination;
  `services/` for storage, capability detection and remote lookups;
  `config/` for URL construction and value coercion; `components/setup/` for
  section arrays and presentational blocks.
- **Regression risk:** high. This file owns the setup→overlay URL contract and
  the persisted config contract, both of which OBS browser sources depend on.
- **Tests protecting the change:** `tests/chatUrlParams.test.ts`,
  `tests/setupImport.test.ts`, `tests/setupTemplates.test.ts`,
  `tests/setupSearch.test.ts`, `tests/previewConfigMessage.test.ts`,
  `tests/previewMessages.test.ts`, `tests/chatOverlayOrchestration.test.ts`.

### 2.2 Un-owned service singletons

- **Responsibility currently owned:** module-level mutable caches that are
  populated per channel and never cleared — `badgeService` (`badgeData`,
  `thirdPartyBadgeIndex`, `thirdPartyBadgesReady`),
  `emoteService` (`emoteData`, `channelLoadPromises`, `globalEmotesPromise`),
  seven-tv `cosmeticsService` (`paintCSSCache` capped at 2000 entries,
  `channelCache`) and `eventApi` (`cosmetics`, `userCosmetics`, `userEmoteSets`,
  `actorIdToUsername`).
- **Responsibility that does not belong there:** lifetime management that
  outlives the runtime which populated it. `eventApi.disconnect()` does not
  clear its maps, so a channel switch can observe the previous channel's state.
- **Proposed owner:** each service exposes an explicit `reset()`/`destroy()`,
  invoked by the single runtime that owns it.
- **Regression risk:** high. Touches overlay correctness and 7TV cosmetics.
- **Tests protecting the change:** `tests/sevenTVCosmeticsRefresh.test.ts`,
  `tests/sevenTVPaintService.test.ts`, `tests/rteAssetIntegration.test.ts`,
  `tests/thirdPartyBadgeIndex.test.ts`, plus partial lifecycle coverage in
  `tests/chatRuntimeLifecycle.test.ts`.

### 2.3 `src/utils/ui/`

- **Responsibility currently owned:** presentation calculation, DOM
  manipulation and single-owner runtime orchestration. Two classes are both
  named `LayoutManager` (`layoutManager.ts:19`, `layoutUtils.ts:164`) with
  disjoint APIs, duplicated `LayoutOptions` interfaces and duplicated
  `#chat_container` CSS text. `fadeUtils.ts` owns a timer map
  (`MessageFadeManager`, `:105-186`) whose sole owner is
  `chatPresentationService.ts:89,104`. `animationUtils.ts` mixes config
  constants (`:3-29`, imported by `config/chatUrlParams.ts:11-13`) with CSS
  generation (`:80-137`) and DOM injection (`:159-181`).
- **Responsibility that does not belong there:** runtime ownership and DOM
  manipulation inside a generic `utils` bucket.
- **Proposed owner:** the chat-overlay runtime layer that already owns the
  lifecycle; config constants stay in `config/`.
- **Regression risk:** medium-high. Layout mode, fade timing and animation
  directly affect overlay rendering.
- **Tests protecting the change:** `tests/layoutUtils.test.ts`,
  `tests/animationUtils.test.ts`, `tests/emoteModifiersLayout.test.ts`.

### 2.4 Dual CSS token systems

- **Responsibility currently owned:** `src/root.css` maintains a bespoke
  grayscale palette alongside the SolidCN token set in `src/app.css`.
- **Responsibility that does not belong there:** four tokens have **zero**
  references (`--bg`, `--input-bg`, `--button-bg`, `--button-text`), and two
  more (`--panel`, `--text-secondary`) are referenced only by `.bg-panel` and
  `.text-secondary` (`root.css:82-87`), which no component uses. `--border` is
  declared twice with incompatible values.
- **Proposed owner:** `src/app.css` is the single token system; nothing else
  declares semantic tokens.
- **Regression risk:** low for dead tokens, medium for the `--border`
  collision because 20+ rules consume `hsl(var(--border))`.
- **Tests protecting the change:** `tests/chatEventStyles.test.ts` covers the
  chat-side custom properties; there is no test for global tokens, so changes
  are verified visually.

### 2.5 Dead code inventory

Confirmed unreferenced across both `src/` and `tests/`:

| Item | Evidence |
| --- | --- |
| `src/utils/chat/sanitize.ts` | no importer |
| `src/utils/chat/urlParser.ts` | no importer |
| `src/utils/chat/markdownParser.ts` | no importer |
| `src/utils/chat/emojiRenderer.ts` | no importer; duplicates `emojiUtils.ts:122-131` |
| `src/utils/chat/actionMessages.ts` | no importer |
| `src/utils/chat/userNoticeParser.ts` | no importer; `twitchService.ts:552` has its own parser |
| `src/utils/chat/chatUtils.ts` | no importer except the type re-export in `chat/index.ts:1` |
| `src/utils/ui/index.ts` | barrel exporting only 2 of 4 sibling files; no importer |
| `YouTubeChatService` | `services/chat/index.ts:28`, never instantiated |
| `RteCosmeticsService.clear()` | `rte/cosmeticsService.ts:178`, zero call sites |

### 2.6 `src/components/chat/renderMessageContent.ts`

- **Responsibility currently owned:** tokenizing, HTML string assembly, network
  URL resolution, DOM construction and post-parse DOM mutation.
- **Responsibility that does not belong there:** network resolution
  (`:203`, `:244`) and DOM construction/layout (`:557-558`).
- **Verified duplication:** `codePointToCodeUnit` is defined twice in the same
  file (`:184`, `:213`); `escapeAttr` (`:32-39`) is byte-identical to
  `src/utils/chat/emoteModifiers/html.ts:4-11`.
- **Proposed owner:** a pure tokenize → assemble → bind pipeline, with
  resolution injected as a dependency and DOM binding in the emote-modifier
  boundary (which is an allowed integration point).
- **Regression risk:** high — emotes, cheers, mentions, 7TV paint and
  gigantified rendering all flow through this file.
- **Tests protecting the change:** `tests/renderMessageContent.test.ts`,
  `tests/messageTokenSnapshot.test.ts`, `tests/emoteModifiers.test.ts`,
  `tests/emoteModifiersLayout.test.ts`.

---

## 3. Quick wins

Low risk, high clarity, no behavior change.

| Change | Risk | Protection |
| --- | --- | --- |
| Remove the unused `lucide-solid` dependency after migrating its 5 icons to the consolidated icon system | low | 5 call sites, all in `setup.tsx` |
| Delete the eight dead modules listed in §2.5 | none | verified zero importers in `src/` and `tests/` |
| Delete `RteCosmeticsService.clear()` and the unused `YouTubeChatService` class | none | verified zero call sites |
| Remove dead `root.css` tokens and the unused `.bg-panel` / `.text-secondary` classes | low | visual check of setup and overlay |
| Resolve the `--border` token collision | low | visual check; 20+ consumers use `hsl(var(--border))` |
| Hoist `ChatConfig` imports from `~/utils/chat` to `~/config/chatUrlParams` | low | typecheck |
| Fix `ChatBadges.tsx:23` — `return null` precedes `createMemo` at `:24`, so reactivity ownership depends on a config value | low | add a characterization test first |

---

## 4. Highest-risk refactors

1. **`src/routes/setup.tsx` decomposition.** Owns the URL/config contract and
   the persistence key registry. Requires characterization tests around import,
   export, preview synchronization and reset-to-defaults before extraction.
2. **Singleton lifecycle.** Clearing caches changes cross-channel behavior and
   therefore overlay output. Requires a test that asserts a channel switch
   leaves no residue.
3. **`chatStyles.ts` generated CSS.** The three-value preset tables
   (`:5-66`) are re-serialized into rule text for 12 selectors
   (`:72-125`). Converting them to static rules driven by custom properties
   touches emote sizing, gigantified rendering and badge sizing, so it needs
   both the existing tests and a visual pass over the overlay.

---

## 5. Dependency responsibility map

| Dependency | Owns | Status |
| --- | --- | --- |
| `solid-js` | components, signals, memos, effects, lifecycle | in use |
| `@solidjs/router` | routing | in use |
| `@solidjs/meta` | document metadata | in use |
| `@kobalte/core` | accessible headless behavior (collapsible, switch, slider, separator, number-field, color-area/field/slider/swatch, popover) | in use, 37 import sites |
| `class-variance-authority` | reusable component variants | in use, 2 files |
| `clsx` + `tailwind-merge` | class composition behind `cn()` in `src/lib/utils.ts` | in use, 39 call sites |
| `@solid-primitives/i18n` | translation plumbing | in use |
| `tailwindcss` | layout, utility composition, token integration | in use |
| `lucide-solid` | UI/system icons for 5 setup controls | in use, 5 deep-subpath import sites |
| `@hugeicons/core-free-icons` | icon payloads for the consolidated icon system (added during phase 3) | MIT, zero deps, data only |

---

## 6. Icon inventory

| Category | Count / location | Notes |
| --- | --- | --- |
| Hugeicons font classes | **verified** 21 distinct names across `src/` | `hgi-stroke` (16 uses) plus 20 named glyphs |
| lucide-solid components | **verified** 5 names — `Monitor`, `Pause`, `Play`, `SlidersHorizontal`, `X` | `setup.tsx:65-67,88-89`; deep subpath imports |
| Font payload | **verified** `hgi-stroke-rounded.woff2` 964 KB + `icons.css` 420 KB | ships in full for 21 icons |
| Inline `<svg>` in components | 14 occurrences | `ChatMessage.tsx:95,439,480,542,567`; `setup.tsx:2143,2152` (platform logos); `Sparkline.tsx:41,64` (visualization); `TwitchChannelField.tsx:456,462,475,482,727` |
| Public brand assets | `public/img/platform-{twitch,youtube,kick}.svg`, `flag-{gb,ru}.svg`, `predictions/magic-ball.svg` | brand + flags |
| Stringly-typed icon maps | `SetupLayout.tsx:55-97` (`icon: "hgi-…"`), `setup.tsx:2281-2544` (`icon="hgi-…"` props) | typed keys would give compile-time safety |

Classification per `documents/REFACTORING.md` section 9: the platform logos and
flags are **brand assets** and must not be replaced by generic UI icons; the
sparkline is a **visualization** and stays inline; the remaining inline SVG in
`ChatMessage.tsx` and `TwitchChannelField.tsx` needs per-case classification
during phase 3.

Migration mapping is 1:1 with zero gaps — every `hgi-<kebab-name>` used in the
codebase has a matching PascalCase export in `@hugeicons/core-free-icons`, so
the migration preserves the exact glyphs.

---

## 7. CSS / token inventory

| Item | Count | Note |
| --- | --- | --- |
| Semantic tokens (live) | 19 in `app.css:11-32,34-78` | SolidCN/shadcn set, `.dark` variant included |
| Legacy tokens | 8 in `root.css:10-17` | 4 with zero references, 2 used only by unused classes |
| Token name collisions | 1 | `--border` declared in both files |
| Hex literals in CSS | 74 | candidates for token consolidation |
| `rgb()` / `hsl()` literals in CSS | 194 | candidates for token consolidation |
| `!important` | 42 | classification required per section 13 before any removal |
| Runtime custom properties (keep dynamic) | `--chat-event-color`, `--chat-event-opacity`, `--chat-event-font-weight`, `--chat-link-color`, `--chat-message-enter-duration`, `--chat-flow-entry-shift`, `--emote-*`, 7TV paint variables | genuinely runtime or provider-driven |
| Static design values emitted as generated CSS | `chatStyles.ts:68-155` (12 selectors from a 3-value table), `:181-183`, `:189-192` | token / static-rule candidates |
| Correct existing pattern to follow | `src/styles/chatEventStyles.ts:21-27` writes only custom properties consumed by static rules in `chat.css:60-62` | the target shape |

---

## 8. Regression risks

| Area | Risk | Protection available |
| --- | --- | --- |
| Setup → overlay URL contract | Any change to `chatUrlParams.ts` breaks existing OBS sources | `tests/chatUrlParams.test.ts`, `tests/setupImport.test.ts` |
| Persisted config | Setup storage keys and import/export format | `tests/setupImport.test.ts`, `tests/setupTemplates.test.ts` |
| Message rendering | Emotes, cheers, mentions, 7TV paint, gigantified lines | `tests/renderMessageContent.test.ts`, `tests/messageTokenSnapshot.test.ts`, `tests/emoteModifiers*.test.ts` |
| Chat runtime lifecycle | Socket teardown, reconnect suppression, timer clearing | partially covered — gaps recorded in `documents/REFACTOR_PLAN.md` phase 1 |
| Overlay layout and animation | Layout modes, fade timing, animation durations | `tests/layoutUtils.test.ts`, `tests/animationUtils.test.ts` |
| OBS transparency | `body`/`#root` transparency and the single `background: transparent !important` at `app.css:87` | no test — visual check required; must not be removed |

---

## 9. Limits of this audit

The module graph was inspected exhaustively and the architecture-sensitive
subtrees were read in depth, but not every one of the roughly 140 source files
was read line by line. Every claim above carries a `file:line` citation so it
can be checked individually. Citations not marked **verified** originate from
the subtree sweeps and should be confirmed when the corresponding phase begins.

**Correction recorded during phase 3:** an initial pass concluded that
`lucide-solid` was unused, because the check matched only the bare specifier
`"lucide-solid"`. The dependency is in fact imported through deep subpaths
(`lucide-solid/icons/monitor` and four siblings in `src/routes/setup.tsx`), so
the project had **two** active icon systems rather than one plus dead weight.
The scores above reflect the corrected finding. When auditing import usage,
match the package prefix, not the bare specifier.
