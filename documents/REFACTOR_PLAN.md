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
| 1 | Guard rails | low | new characterization tests | in progress — `ChatBadges` reactivity fixed; remaining characterization tests outstanding |
| 2 | Design tokens | low-medium | visual check, `chatEventStyles` tests | not started |
| 3 | Icon normalization | low | 1:1 glyph mapping, visual check | **done** |
| 4 | UI primitives | low | visual check, existing tests | not started |
| 5 | Setup decomposition | high | setup/URL/import test suites | not started |
| 6 | Chat presentation cleanup | high | render and emote test suites | not started |
| 7 | Dependency and dead-code cleanup | none-low | grep verification, build | not started |
| 8 | Documentation and enforcement | low | full check | not started |

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
4. Convert the two boolean generated rules `.user_info { display: none }`
   (`chatStyles.ts:181-183`) and `.message::before { content }` (`:189-192`)
   into static rules keyed on a class or attribute.
5. Keep genuinely runtime values dynamic: user-selected colors, emote geometry,
   measured layout shifts, 7TV paint, provider cosmetics.

**Exit criteria:** `chat.css` owns the rules, `overlayStyleManager` writes only
custom properties, `tests/chatEventStyles.test.ts` and
`tests/renderMessageContent.test.ts` pass, and the overlay renders identically
in a visual check.

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

**Goal:** routes stop re-implementing controls the primitive layer already owns.

**Steps:**

1. Replace the 19 raw `<button>` in `src/routes/setup.tsx` and 8 in
   `src/components/setup/SetupImportCard.tsx` with `Button`, adding variants
   where a case is genuinely not covered.
2. Replace the 7 raw `<input>` in `src/routes/setup.tsx` and 2 in
   `SetupImportCard.tsx` with `Input`.
3. Move `src/components/ColorPickerField.tsx` under `src/components/setup/` so
   feature components live with their feature.
4. Do not touch the dev route's raw elements; it is a diagnostic surface.

**Exit criteria:** no raw `<button>` or `<input>` outside `components/ui/` and
the dev route; keyboard and focus behavior unchanged; visual check passes.

**Commit:** `refactor(setup): reuse ui primitives for controls`

---

## Phase 5 — Setup decomposition

**Goal:** `src/routes/setup.tsx` becomes a UI composition root.

Extraction order is chosen so each step is independently verifiable and nothing
downstream blocks.

1. **Storage adapter.** Move `readStoredSetupValue` / `writeStoredSetupValue`
   (`:133-156`) and the key registry (`:126-131`) to `services/` and `config/`.
2. **Bot profile lookup.** Move the Twitch and Kick fetchers (`:212-318`) into a
   `services/` module, removing the duplication with
   `src/components/setup/TwitchChannelField.tsx:189-204` and the repeated GQL
   endpoint constant.
3. **Local font capability.** Move UA detection (`:158-175`) and font
   enumeration (`:1375-1398`) into a service that returns a typed status.
4. **Value coercion.** Move `normalizeHexColor`, `toInt`, `toIntOrFalse`,
   `toSecondsOrFalse`, `toClampedInt`, `toFloat` (`:837-904`) into `config/`
   next to the existing normalization in `chatUrlParams.ts`.
5. **Config projection.** Move `buildConfig` (`:885-992`) and `buildChatUrl`
   (`:1012-1028`) into `config/`.
6. **Preview synchronization.** Move the postMessage sender (`:627-632`), the
   debounced navigation (`:1279-1311`) and the config push effect into
   `features/setup/`.
7. **Document style lock.** Move the `documentElement`/`body`/`#root` style
   handling and reduced-motion listener (`:634-684`) into a lifecycle-owned
   helper.
8. **Settings search.** Move DOM query, match set, counter and highlight
   (`:686-731`) into `features/setup/`, keeping `utils/setupSearch.ts` as the
   pure matcher.
9. **Section metadata and blocks.** Extract the section descriptor arrays
   (`:1400-2027`), `ffzBadgeMergeBlock` (`:1886-1940`), `renderUserChip`
   (`:2029-2085`) and the preview controls (`:2553-2753`) into
   `components/setup/`.

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
   against `emoteModifiers/html.ts:4-11`.
2. Split `renderMessageContent.ts` into tokenize, assemble and DOM-bind stages,
   injecting URL resolution rather than importing the network client, so the
   renderer becomes testable without infrastructure.
3. Move `LayoutManager` (`utils/ui/layoutUtils.ts:164`) and the fade manager
   (`utils/ui/fadeUtils.ts:105-186`) into the chat-overlay layer that owns their
   lifecycle, and resolve the two-classes-one-name problem.
4. Split `utils/ui/animationUtils.ts` so config constants live in `config/` and
   CSS generation lives with the overlay runtime.
5. Move `utils/chat/badgePriority.ts` next to `ChatBadges.tsx`, and move
   `utils/ui/layoutManager.ts` with its feature integration.
6. Fix the `ChatMessage.tsx` animation cleanup duplication between `:358-365`
   and `:377-381` once phase 1 tests cover it.

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

1. Delete the eight dead modules listed in the audit §2.5.
2. Delete `YouTubeChatService` and `RteCosmeticsService.clear()`.
3. Give the remaining singleton caches a real owner: add `reset()` to
   `badgeService`, `emoteService` and the seven-tv services, and call them from
   the runtime that owns them. Wire `OverlayStyleManager.cleanup()` into
   `liveRuntime.destroy()`.
4. Reset the global `rteProxyEnabled` flag on teardown.
5. Re-check `!important` usage against section 13 and document the necessary
   OBS boundary override at `app.css:87`.

**Exit criteria:** `bun run check` passes, the production build shrinks, and no
cache outlives the runtime that populated it.

**Commit:** `chore(deps): remove dead code and unused modules`

---

## Phase 8 — Documentation and enforcement

**Steps:**

1. Update `documents/ARCHITECTURE.md` with the layer boundaries that the audit
   verified are already holding, and the icon and token strategies decided in
   phases 2 and 3.
2. Update `documents/DESIGN.md` with the token contract and the rule that
   runtime presentation values are passed as custom properties.
3. Record the allowed exceptions: provider cosmetics and emote modifiers may
   generate CSS at an integration boundary; brand assets are not UI icons.
4. Run the full verification suite.

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
