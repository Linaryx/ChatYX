# ChatYX Refactor Plan

Execution plan derived from `documents/REFACTOR_AUDIT.md` and ordered according
to `documents/REFACTORING.md` section 24. The repository must remain usable
after every phase, and each phase is its own commit (or its own small commit
series) following Conventional Commits.

## Ground rules

- No behavior changes during structural work unless a phase says otherwise.
- Run `bun run check` before every commit.
- Migrate first, delete afterwards. Compatibility code is removed only once all
  real usages are gone.
- Do not delete a valid test to make a refactor easier.
- Runtime presentation values stay dynamic; only reusable design decisions
  become tokens.
- Brand assets are never replaced by generic icons.

## Phase map

| Phase | Focus | Risk | Primary protection | Status |
| --- | --- | --- | --- | --- |
| 1 | Guard rails | low | new characterization tests | partly done — `ChatBadges` reactivity fixed; pure-logic characterization added where no DOM is needed; component-render tests deferred by decision |
| 2 | Design tokens | low-medium | visual check, `chatEventStyles` tests | **done** |
| 3 | Icon normalization | low | 1:1 glyph mapping, visual check | **done** |
| 4 | UI primitives | low | visual check, existing tests | **done** |
| 5 | Setup decomposition | high | setup/URL/import test suites | **done** — all nine steps |
| 6 | Chat presentation cleanup | high | render and emote test suites | in progress — steps 1, 3 (partly), 5 and 6 done; render pipeline split outstanding |
| 7 | Dependency and dead-code cleanup | none-low | grep verification, build | **done** |
| 8 | Documentation and enforcement | low | full check | **done** |

Visual verification is available through a local Playwright install kept
outside the repository (`%TEMP%\opencode\pw`), which captures the setup page and
the overlay preview and reports console errors. This replaced the unavailable
desktop browser connection.

---

## Phase 1 — Guard rails

**Goal:** protect the behavior that phases 5–7 will move, before any of it moves.

**Scope — add characterization tests only, no production changes:**

1. `ChatBadges` conditional reactivity. `src/components/chat/ChatBadges.tsx:23`
   returns `null` before `createMemo` at `:24`, so the reactive owner depends on
   `props.config.hideAllBadges`. Characterize both branches, then fix the
   ordering in the same phase.
2. `OverlayStyleManager` teardown. Assert which `<style>` elements exist after
   `apply()` and after runtime teardown.
3. Reconnect suppression. Assert that `disconnect()` stops the Twitch reconnect
   loop and that a failed cycle resets the attempt counter.
4. `ChatOverlayApplication.destroy()` before `start()`. Characterize the
   current early-return, since the constructor already builds the runtime.
5. Preview runtime teardown. `PreviewRuntime` is currently uncovered; assert
   the message interval and render timer stop.
6. Setup import/export round trip through `buildChatUrl` and
   `parseChatConfigFromSearchParams`, including the `ms` parameter removal.

**Exit criteria:** the new tests fail if the corresponding behavior changes,
and `bun run check` passes.

**Commit:** `test(chat): characterize runtime teardown and badge reactivity`

---

## Phase 2 — Design tokens

**Goal:** one coherent token system.

**Steps:**

1. Remove the dead tokens `--bg`, `--input-bg`, `--button-bg`, `--button-text`
   and the unused `.bg-panel` / `.text-secondary` classes from `src/root.css`.
2. Resolve the `--border` collision. Keep the `app.css` definition, since more
   than twenty rules consume `hsl(var(--border))`, and remove the `root.css`
   one.
3. Replace the static three-value preset tables in `src/styles/chatStyles.ts`
   (`SIZE_CONFIGS` `:5-66`, shadow `:129-140`, stroke `:142-155`) with static
   CSS rules driven by custom properties, following the already-correct pattern
   in `src/styles/chatEventStyles.ts:21-27` consumed by `src/styles/chat.css`.
   **Done.** The four generators are replaced by `getOverlayStyleVariables`, which
   returns a property map the same way `getChatEventStyleVariables` does, and
   `chat.css` owns every rule. `SIZE_CONFIGS` itself stays: `renderMessageContent`
   reads it for emote geometry, so the table remains the single source of truth
   and now publishes properties instead of emitting rules. The emote scale is
   folded into the published emote and emoji sizes, because a stylesheet cannot
   multiply a preset by a runtime value. `OVERLAY_STYLE_PROPERTIES` and
   `OVERLAY_ATTRIBUTES` are guarded by `tests/overlayStylesheet.test.ts`, which
   fails if the published list, the stylesheet and the attribute selectors drift
   apart. Verified by diffing computed styles across 20 configurations and 14
   selectors, captured before and after: the only differences are 260 inherited
   `--chat-gigantified-emote-width` readings with **zero** on the element that
   consumes it, 17 readings of an artificial `.emoji` probe (real `.emoji` images
   measure 22px with a matching inline size, since the renderer sets that size
   itself), and one container height inside the measured noise floor — two runs of
   the same code differ by a row height there.
4. Convert the two boolean generated rules `.user_info { display: none }`
   (`chatStyles.ts:181-183`) and `.message::before { content }` (`:189-192`)
   into static rules keyed on a class or attribute. **Done** — they are keyed on
   `:root[data-hide-names]` and `:root[data-nl-after-name]`, set by the overlay
   style manager and covered by the same stylesheet test.
5. Keep genuinely runtime values dynamic: user-selected colors, emote geometry,
   measured layout shifts, 7TV paint, provider cosmetics.

**Exit criteria:** `chat.css` owns the rules, `overlayStyleManager` writes only
custom properties, `tests/chatEventStyles.test.ts` and
`tests/renderMessageContent.test.ts` pass, and the overlay renders identically
in a visual check.

**Outcome so far:** the dead legacy tokens and the `--border` collision are
resolved. Verified by computed style rather than by screenshot: `body` colour is
still `rgb(255, 255, 255)` and `--border` now resolves from `app.css` alone. The
`chatStyles.ts` preset conversion is still open and is the riskier half of this
phase.

**Commit:** `refactor(styles): consolidate semantic design tokens`

---

## Phase 3 — Icon normalization

**Goal:** one package-based, tree-shakeable, typed icon system. No icon font,
no stringly-typed class names, no duplicated brand SVGs.

**Decision (verified):** adopt `@hugeicons/core-free-icons` and a small local
Solid wrapper.

- The package is MIT, has zero dependencies, ships data only, and exposes
  per-icon subpath exports, so bundling pulls in only the icons actually used.
- All 21 `hgi-*` names currently used in the codebase have a matching
  PascalCase export in the free set — verified 21/21, zero gaps — so glyphs are
  preserved exactly.
- There is no official Hugeicons package for Solid (`@hugeicons/solid` does not
  exist), so the integration is a small typed wrapper component rather than a
  third-party runtime.

**Steps:**

1. Add the dependency and a `src/components/ui/icon.tsx` wrapper that renders a
   Hugeicons icon definition as an inline `<svg>` with `currentColor` stroke,
   correct `aria-hidden` default, and a `size` variant.
2. Replace `SetupLayout.tsx:55-97` `icon: "hgi-…"` strings with typed icon
   components, and the `icon="hgi-…"` props in `src/routes/setup.tsx` with the
   same.
3. Replace the 16 `hgi-stroke` span usages with the wrapper.
4. Centralize brand logos so the same platform logo is not simultaneously a
   public SVG and an inline SVG. Prefer one owner per platform.
5. Classify the remaining inline SVG per section 9: `Sparkline.tsx` is a
   visualization and stays; the `ChatMessage.tsx` and `TwitchChannelField.tsx`
   cases get classified individually.
6. Only after migration: delete `public/hugeicons/` (964 KB woff2 plus the
   420 KB stylesheet), remove the `index.html:9` stylesheet link, and remove
   the `.hgi-stroke` rule at `SetupWorkspace.css:189`.
7. Migrate the five `lucide-solid` icons (`Monitor`, `Pause`, `Play`,
   `SlidersHorizontal`, `X` — deep subpath imports in `setup.tsx`) to their
   Hugeicons equivalents and then remove the dependency. The project converges
   on one general-purpose UI icon library. Note: an early audit pass reported
   `lucide-solid` as unused; it was in fact in use through subpath imports.

**Exit criteria:** no `hgi-` string remains in `src/`, no icon font is shipped,
`grep -r "lucide" src` is empty, the production build succeeds, and the setup
page and overlay render identically.

**Outcome:** complete. The `Icon` primitive lives in
`src/components/ui/icon.tsx`; monochrome brand glyphs moved to
`src/components/brand/PlatformGlyph.tsx`, which removed the Twitch path data
duplicated between `setup.tsx` and `TwitchChannelField.tsx`. Custom event,
reply, role and sparkline graphics stay inline per section 9 because they are
bespoke visuals, not UI icons. `public/hugeicons/` and `lucide-solid` are gone;
`dist` is about 1.35 MB smaller; lint, typecheck, 336 tests and the production
build all pass. A glyph-for-glyph comparison page was generated from the
pre-migration font restored out of git and resolved 21/21 glyphs with no gaps.

**Commits:** `refactor(icons): add typed icon component`,
`refactor(icons): replace icon font with package icons`,
`chore(deps): remove unused lucide-solid`

---

## Phase 4 — UI primitives

**Goal:** routes stop re-implementing control *structures* the feature layer can
own. This is about duplication, not about forcing every raw element through a
primitive.

**Corrected scope.** The audit's raw-element counts were case-insensitive and
roughly triple the real figures. Case-sensitive counts are 14 raw `<button>` and
5 raw `<input>` in `setup.tsx`, one of each in `TwitchChannelField.tsx`, and
none in `SetupImportCard.tsx`. Almost all of those raw elements are bespoke
single-purpose controls with their own CSS contracts — role pills, stage
swatches, preview radio options, chip remove buttons. Pushing them through the
generic `Button` would inject conflicting base styles (`h-10`, `px-4`,
`rounded-md`, `bg-primary`) and change the design, so they stay as they are.

**Steps:**

1. Extract the genuinely duplicated structure: the four byte-identical chip
   inputs in the Twitch-bot, YouTube-bot, Kick-bot and viewer-allowlist rows
   become `src/components/setup/SetupChipInput.tsx`. It is deliberately a
   feature-level wrapper rather than the generic `Input`, because the field sits
   borderless inside an existing bordered container, exactly as the layering in
   section 8 prescribes.
2. Move `src/components/ColorPickerField.tsx` under `src/components/setup/` so
   feature components live with their feature.
3. Leave the remaining raw controls and the dev route alone.

**Exit criteria:** no duplicated chip-input structure; keyboard, focus and blur
behaviour unchanged; the dev route untouched.

**Commit:** `refactor(setup): extract chip input and colocate feature components`

**Outcome:** complete. `setup.tsx` now has one raw `<input>` left — the embedded
settings search field, which has no duplicate. Verified functionally in a real
browser: all four rows still add a chip on Enter and clear the draft, and the
bots section renders unchanged. The only network error observed was an expected
`404` from `kick.com` for a probe username that does not exist.

---

## Phase 5 — Setup decomposition

**Goal:** `src/routes/setup.tsx` becomes a UI composition root.

Extraction order is chosen so each step is independently verifiable and nothing
downstream blocks.

1. **Storage adapter.** Move `readStoredSetupValue` / `writeStoredSetupValue`
   and the key registry to `src/services/storage/setupStorage.ts`. **Done.** The
   adapter owns every setup-page `localStorage` access and keeps the injectable
   `StorageLike` parameter so tests can pass an in-memory store.
   `config/setupTemplates.ts` had grown its own second copy of the same
   availability and try/catch guards; it now uses the shared adapter. The
   adapter is a dependency-free leaf, so the `config → services` edge it adds
   cannot form a cycle, unlike the alternative of moving template persistence
   into `services/`. Verified end to end in a browser: a typed channel is
   written, survives a reload, appears in the generated overlay URL, and
   removing it deletes the key instead of storing an empty string.
2. **Bot profile lookup.** Move the Twitch and Kick fetchers (`:212-318`) into a
   `services/` module, removing the duplication with
   `src/components/setup/TwitchChannelField.tsx:189-204` and the repeated GQL
   endpoint constant. **Done.** `src/services/setup/botProfiles.ts` owns the
   logins helpers and both lookups;
   `src/services/network/fetchJsonWithTimeout.ts` is the single timeout-and-JSON
   helper that `TwitchChannelField` used to redeclare verbatim, and
   `TWITCH_GQL_ENDPOINT` / `TWITCH_WEB_CLIENT_ID` moved to `config/twitch.ts`
   where the summary field and the bot lookups now share them. The `@`-stripping
   in `normalizeBotLogin` was deliberately preserved: `parseBotNames` in
   `config/chatUrlParams` does not strip it, so the two are not interchangeable
   and unifying them would change URL parsing. Verified in a browser: the Twitch
   lookup resolves 35 display names and 33 avatars for the default list and the
   Kick lookup resolves its entries; unknown logins degrade to a fallback chip
   with no console error. The two chips still showing a letter fallback belong to
   the *YouTube* bot list, which has never had a profile lookup.
3. **Local font capability.** Move UA detection (`:158-175`) and font
   enumeration (`:1375-1398`) into a service that returns a typed status.
   **Done.** `src/services/setup/localFonts.ts` owns the browser sniff, the
   per-family normalization and `loadLocalFontOptions()`, which never rejects:
   an absent API becomes `unsupported`, a denied permission prompt becomes
   `error`, and an empty list becomes `empty`. The route keeps only its UI status
   signal and maps the result onto it. Verified in a browser twice: against the
   real API the row renders, the button enables and enumeration degrades to the
   `empty` status with no console error; against an injected fake the list
   reports two families, groups and sorts their styles (`Alpha Sans (Bold,
   Regular)`), and drops a whitespace-only family.
4. **Value coercion.** Move `normalizeHexColor`, `toInt`, `toIntOrFalse`,
   `toSecondsOrFalse`, `toClampedInt`, `toFloat` (`:837-904`) into `config/`
   next to the existing normalization in `chatUrlParams.ts`. **Done.**
   `src/config/formValues.ts` holds them at module scope instead of being
   rebuilt inside the component on every render. `toIntOrFalse` and
   `toSecondsOrFalse` were byte-identical, and `chatUrlParams` parses and
   serializes its `intOrFalse` and `secondsOrFalse` kinds through the same code,
   so both collapsed into `toPositiveIntOrFalse` with that premise pinned by a
   test. New `tests/formValues.test.ts` also characterizes the form→URL→config
   round trip, which is the contract step 5 must not break.
5. **Config projection.** Move `buildConfig` (`:885-992`) and `buildChatUrl`
   (`:1012-1028`) into `config/`. **Done.** `src/config/setupConfig.ts` owns
   `SetupFormState`, `buildSetupConfig(form, selectedChannel)` and
   `buildOverlayUrl(...)`. The form state is passed in rather than read from
   signals, which is what makes the projection testable; `selectedChannel` stays
   a separate argument because the preview and the exported link deliberately
   project the same form onto different channels. `buildOverlayUrl` gained an
   optional `baseUrl` so the URL contract can be asserted without a document.
   New `tests/setupConfig.test.ts` covers default projection, `@`-stripping,
   clamping, malformed input, the `ms` rule, extra-parameter precedence and a
   full export→parse round trip. Verified in a browser: channel, size and
   line-height each change the generated link and all three survive a reload;
   the embedded preview renders 11 demo messages with `ms` absent and no console
   error in either the page or the frame.
6. **Preview synchronization.** Move the postMessage sender (`:627-632`), the
   debounced navigation (`:1279-1311`) and the config push effect into
   `features/setup/`. **Done.** `src/features/setup/previewSync.ts` owns the
   iframe protocol: the config message, the direct `src` swap that avoids the
   about:blank flash, the session-key gate, the debounce and the cancellation.
   The route keeps only the reactive effects that read signals. The navigation
   URL is built lazily, so an unchanged session costs nothing. Verified two
   ways: `tests/previewSync.test.ts` covers the repeat-key no-op, the burst that
   collapses into one navigation with the last URL, `dispose`, the pre-mount
   fallback and the postMessage origin using a minimal `window` shim; in a
   browser a committed channel change reloads the frame with `c=abcdef`, a
   message-size change does not reload it, and the overlay still re-renders
   (20px → 48px) with no console error. The debounce is covered by the unit test
   because the channel signal commits on blur, which makes burst timing
   unreliable to drive from outside.
7. **Document style lock.** Move the `documentElement`/`body`/`#root` style
   handling and reduced-motion listener (`:634-684`) into a lifecycle-owned
   helper. **Done.** `src/features/setup/setupDocument.ts` exports
   `lockSetupDocument()`, which returns its own release function and restores
   exactly the captured values, and `watchReducedMotion(callback)`, which reports
   the current preference immediately so the route needs no separate initial
   read. Verified in a browser: the lock is applied on setup, `/status` loaded
   directly does not touch those styles, a client-side route change releases the
   lock, and a context created with `reducedMotion: "reduce"` shows the demo
   already paused on mount. Note for the record: `/` renders the same setup
   component (`src/index.tsx:21`), so a link to `/` legitimately keeps the lock —
   an early check misread that as a leak.
8. **Settings search.** Move DOM query, match set, counter and highlight
   (`:686-731`) into `features/setup/`, keeping `utils/setupSearch.ts` as the
   pure matcher. **Done.** `src/features/setup/settingsSearch.ts` owns the
   searchable-element selector, the section lookup, the highlight class, the
   counter format and the reveal scroll; the route keeps the signals and memos
   and passes its own `scrollToSection` in, because the workspace's scroll state
   belongs to it. The `SetupSectionId` dependency is type-only, so there is no
   runtime edge into the layout module. Verified in a browser: `twitch` matches 8
   rows across 4 sections, the counter reads `1 / 8` and steps to `2 / 8` then
   `3 / 8` and back to `2 / 8`, and clearing removes every highlight, every nav
   marker and the counter, with no console error.
9. **Section metadata and blocks.** Extract the section descriptor arrays
   (`:1400-2027`), `ffzBadgeMergeBlock` (`:1886-1940`), `renderUserChip`
   (`:2029-2085`) and the preview controls (`:2553-2753`) into
   `components/setup/`. **Blocks and descriptors done.** `renderUserChip` became
   `src/components/setup/UserChip.tsx` and `ffzBadgeMergeBlock` became
   `src/components/setup/FfzBadgeMergeBlock.tsx` (which also took over the badge
   preview asset URL). Both kept their reactive shape: `UserChip` receives the
   profile map as a getter, not as one resolved profile, because bot profiles
   arrive after the chip renders.

   The descriptor arrays moved to `src/components/setup/sections/`:
   `appearanceRows.tsx`, `stylingRows.tsx`, `behaviorRows.tsx` and
   `toggleRows.tsx`. Each factory takes one source object and destructures it up
   front, so the row bodies are exactly what the route declared before — the
   extraction could not silently change a label or a control. `roleBadgeMergeOptions`
   stays in the route because it is the signal wiring. `setup.tsx` went from 2779
   lines at the start of this phase to 1909.

   Verified in a browser: every section renders the rows its array declares
   (`behavior` 2 control rows and 8 switches, `tts` 2, `rte` 2, `appearance` 8,
   `content` 19 switches), toggling a switch changes the generated URL in every
   section that has one, the settings search still reports 8 matches across the
   extracted rows, and there is no console error.

   The preview controls moved to `src/components/setup/PreviewControls.tsx`,
   which also took over the selection thumbs — the refs, the two thumb-style
   signals, the measurement helper and the resize observer. Those belong with the
   markup they measure: leaving them in the route would have spread the
   coordination across a fifteen-prop boundary instead of reducing it. Verified in
   a browser: four stage swatches with the pressed state tracking the click, the
   custom colour picker appearing only for the custom backdrop, both selection
   thumbs measured (`translateY(40px)` and `translateY(0)`, height `36px`), and
   the pause control toggling its pressed state, with no console error.

   `setup.tsx` went from 2779 lines at the start of this phase to 1686.

**Exit criteria after each step:** `bun run check` passes and the setup page
round-trips a config through export, import and preview unchanged.

**Commits:** one per numbered step, for example
`refactor(setup): extract persistence adapter`,
`refactor(setup): extract bot profile lookup`,
`refactor(setup): extract overlay url builder`.

---

## Phase 6 — Chat presentation cleanup

**Steps:**

1. Remove the verified duplication: the second `codePointToCodeUnit` definition
   in `renderMessageContent.ts:213-225` and the byte-identical `escapeAttr`
   against `emoteModifiers/html.ts:4-11`. **Done.** `escapeAttr` now has a single
   definition exported from `emoteModifiers/html.ts`, and
   `codePointToCodeUnit` is hoisted to module scope. Protected by
   `tests/renderMessageContent.test.ts` and `tests/messageTokenSnapshot.test.ts`,
   both unchanged and passing.
2. Split `renderMessageContent.ts` into tokenize, assemble and DOM-bind stages,
   injecting URL resolution rather than importing the network client, so the
   renderer becomes testable without infrastructure. **URL injection done.** The
   module no longer imports `networkClient`: `renderMessageWithEmotes` takes a
   `RenderMessageOptions` object with a `resolveUrl` callback, and `ChatText`
   passes the real resolver, so the component layer owns the network policy and
   the renderer owns none. Two tests cover the seam — every asset URL goes
   through the injected resolver, and a message with nothing to resolve calls it
   zero times — while the existing suite still passes the real resolver, which
   keeps its RTE-rewrite coverage. Verified in a browser: the dev fixture renders
   4 emotes and 2 emoji, all with resolved CDN URLs, and 24 messages with no
   console error. **Outstanding:** the physical module split into tokenize,
   assemble and DOM-bind files. The function already builds a token array
   internally, so the seam exists in the code; moving it into separate modules is
   a wide mechanical change to a file that two suites protect, and it buys
   organisation rather than testability now that the injection is in place.
3. Move `LayoutManager` (`utils/ui/layoutUtils.ts:164`) and the fade manager
   (`utils/ui/fadeUtils.ts:105-186`) into the chat-overlay layer that owns their
   lifecycle, and resolve the two-classes-one-name problem.
4. Split `utils/ui/animationUtils.ts` so config constants live in `config/` and
   CSS generation lives with the overlay runtime. **Done.**
   `src/config/chatAnimation.ts` holds the modes, the speed bounds and the pure
   mappings, with no DOM access, so the URL contract and the setup form no longer
   depend on a module that touches `document`;
   `src/services/chat/runtime/animationStyles.ts` holds the stylesheet generation
   and injection. The module is gone and its test moved to
   `tests/chatAnimation.test.ts`, importing the pure half from config and the
   generator from the runtime. Verified in a browser: `flow` and `fade` still
   animate and clean up with 0 rows stuck and no console error.
5. Move `utils/chat/badgePriority.ts` next to `ChatBadges.tsx`, and move
   `utils/ui/layoutManager.ts` with its feature integration. **Partly done.**
   `badgePriority.ts` moved to `src/components/chat/badgePriority.ts` with
   `git mv`, since `ChatBadges` was its only importer and the badge ordering
   rules exist only to serve it; the import is now the sibling `./badgePriority`.
   The layout manager move is blocked by layering rather than by effort: it is
   owned by `services/chat/chatPresentationService`, and moving it under
   `features/chat-overlay` would make a service import a feature, against the
   documented direction. Recorded here instead of forced.
6. Fix the `ChatMessage.tsx` animation cleanup duplication between `:358-365`
   and `:377-381` once phase 1 tests cover it. **Done.** The two
   `clearEntryAnimation` closures differed only in whether they removed the
   measured `--chat-flow-entry-shift` property, and removing a property that was
   never set is a no-op, so there is now one closure for both branches.
   Verified in a browser by timing each row from the entry class appearing to it
   being removed: in `flow` mode 11 rows entered with a maximum class lifetime of
   495 ms and 0 rows kept the class or the shift property past the animation
   window; in `fade` mode 10 entered, maximum 335 ms, 0 stuck. No console error in
   either mode.

**Exit criteria:** `tests/renderMessageContent.test.ts`,
`tests/messageTokenSnapshot.test.ts`, `tests/emoteModifiers.test.ts` and
`tests/emoteModifiersLayout.test.ts` pass unchanged, proving behavior is
preserved.

**Commits:** `refactor(chat): remove duplicated render helpers`,
`refactor(chat): separate render pipeline stages`,
`refactor(chat): relocate layout runtime to overlay layer`.

---

## Phase 7 — Dependency and dead-code cleanup

**Steps:**

1. Delete the eight dead modules listed in the audit §2.5, plus
   `YouTubeChatService` and the orphaned `types/userNotice.ts`. **Do not**
   delete `RteCosmeticsService.clear()`: the audit calls for that cleanup to be
   invoked by the runtime that owns the cache, so removing it would delete a
   fix rather than apply one.
2. Give the remaining singleton caches a real owner: add `reset()` to
   `badgeService`, `emoteService` and the seven-tv services, and call them from
   the runtime that owns them. Wire `OverlayStyleManager.cleanup()` into
   `liveRuntime.destroy()`. Call `RteCosmeticsService.clear()` from the RTE
   runtime's teardown. **Done.**
   - `liveRuntime.destroy()` now ends with the teardown it owns:
     `styleManager.cleanup()`, `setRteProxyEnabled(false)`, `badgeService.reset()`
     and `emoteService.reset()`.
   - `badgeService.reset()` restores a snapshot taken at construction rather than
     repeating the long fallback literal, so the fallbacks survive a reset and
     cannot drift from a second copy.
   - `sevenTVCosmeticsService.clearAllCaches()` is now called from
     `chatPresentationService.cleanup()`, which already cleared the fade, paint
     and RTE caches.
   - Two real leaks were found while verifying, both from modules that appended
     a style element unconditionally: `injectAnimationStyles` left **two**
     `#chat-animations` elements in the document, so removing "the" element by id
     removed only one, and `#chat-layout` was never removed at all.
     `injectAnimationStyles`, `injectLayoutStyles` and `injectFadeStyles` now
     reuse an existing element, `LayoutManager` and `MessageFadeManager` gained
     `cleanup()`, and `OverlayStyleManager.cleanup()` removes every element
     matching an id rather than the first. A `MutationObserver` trace across
     overlay teardown shows all five generated stylesheets removed and none left
     behind.
   - `tests/serviceReset.test.ts` pins that `emoteService.reset()` clears channel
     and personal emotes, that `badgeService.reset()` keeps the built-in
     fallbacks, and that a second reset does not restore state from the first.
4. Reset the global `rteProxyEnabled` flag on teardown. **Done** — folded into
   `liveRuntime.destroy()` above, since that is the runtime that set it.
5. Re-check `!important` usage against section 13 and document the necessary
   OBS boundary override at `app.css:87`. **Done.** Every remaining use sits at a
   boundary that section 13 allows: `app.css:87` keeps `html`, `body` and `#root`
   transparent for OBS (already commented in place); `chat.css` overrides emote
   geometry and 7TV paint, where the competing declaration is either inline or
   generated by a provider integration; `SetupWorkspace.css` resets a control
   nested in a container and forces near-zero durations under reduced motion; and
   `dev/messages.css` is the dev route. No `!important` was added by this
   refactor.

**Exit criteria:** `bun run check` passes, the production build shrinks, and no
cache outlives the runtime that populated it.

**Commit:** `chore(deps): remove dead code and unused modules`

---

## Phase 8 — Documentation and enforcement

**Steps:**

1. Update `documents/ARCHITECTURE.md` with the layer boundaries that the audit
   verified are already holding, and the icon and token strategies decided in
   phases 2 and 3. **Done** — new "Setup feature" and "Icons and design tokens"
   sections record the setup module map, the rule that the overlay URL is a public
   contract, the one exception to the dependency direction (a config module may
   depend on a dependency-free service leaf), the icon package and its subpath
   import rule, and the two kinds of drawing that stay inline.
2. Update `documents/DESIGN.md` with the token contract and the rule that
   runtime presentation values are passed as custom properties. **Done** — a new
   "Token Contract" section states the two rules, names the allowed exceptions and
   records that `chatStyles.ts` is the last remaining exception, with the note
   that its table is also read by JS so the conversion publishes properties rather
   than deleting it.
3. Record the allowed exceptions: provider cosmetics and emote modifiers may
   generate CSS at an integration boundary; brand assets are not UI icons.
   **Done** in both documents.
4. Run the full verification suite. **Done** — `bun run check` passes.

**Commit:** `docs(architecture): document ui and token boundaries`

---

## Verification

Per phase, at minimum:

```bash
bun run check
```

Which runs, in order:

```bash
bun run lint
bun run typecheck
bun test ./tests
bun run build
```

Before declaring the whole plan complete, confirm against
`documents/REFACTORING.md` section 25 that no new cyclic dependency, duplicate
UI primitive, second icon system, unnecessary dependency, generic `utils`
dumping ground, hidden side effect, broken lifecycle cleanup, duplicated
platform SVG, static design literal, accessibility regression, OBS regression or
config/URL contract change was introduced.
