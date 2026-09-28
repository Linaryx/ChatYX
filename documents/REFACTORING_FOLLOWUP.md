# ChatYX Refactoring Follow-up

> Status: required completion supplement  
> Applies after: PR #15 / repository-wide cleanup work  
> Scope: finish the architectural cleanup that remains after the first refactor pass  
> Explicit exclusion: **DO NOT migrate to Panda CSS in this follow-up**

---

# 1. Purpose

This document is an **additive follow-up** to the existing ChatYX refactoring documents.

It does not replace them.

The previous refactor already completed a large amount of useful cleanup:

- setup responsibilities were extracted from the route;
- the overlay URL projection became testable;
- runtime styling was moved toward stable CSS + custom properties;
- the Hugeicons font was removed;
- Lucide was removed;
- typed icon data replaced `hgi-*` string classes;
- lifecycle ownership improved;
- tests were added around setup projection, preview synchronization, style teardown and singleton reset;
- dead code and duplicated helpers were removed.

The next agent must **not restart the refactor from scratch**.

The job now is to finish the remaining architectural issues, remove inconsistencies introduced or left behind by the first pass, and leave the repository in a stable state for a future styling-system migration.

Panda CSS is intentionally deferred.

---

# 2. Mandatory Read Order

Before changing code, read these files in this order:

```text
1. AGENTS.md
2. documents/ARCHITECTURE.md
3. documents/DESIGN.md
4. documents/REFACTORING.md
5. documents/REFACTOR_AUDIT.md
6. documents/REFACTOR_PLAN.md
7. documents/REFACTORING_FOLLOWUP.md
8. relevant tests for every area being changed
```

Then inspect the current repository tree.

Do not assume the plan documents are perfectly current.

The source code and tests may have moved forward since a plan outcome note was written.

---

# 3. Precedence Rules

When guidance conflicts, use this order:

```text
1. current externally observable behavior and public contracts
2. passing characterization tests that intentionally pin those contracts
3. AGENTS.md
4. documents/ARCHITECTURE.md
5. documents/DESIGN.md
6. this REFACTORING_FOLLOWUP.md for explicitly updated follow-up items
7. documents/REFACTOR_PLAN.md
8. older audit observations
```

This document overrides older refactor notes **only where it explicitly says that the previous information is stale or incomplete**.

Do not reinterpret this as permission to ignore architecture documentation.

---

# 4. Hard Constraint: No Panda CSS Yet

This follow-up must not introduce Panda CSS.

Do not add:

```text
@pandacss/dev
panda.config.ts
styled-system/
Panda recipes
Panda semantic-token configuration
```

Do not remove Tailwind merely to prepare for Panda.

Do not migrate Tailwind classes into a temporary second styling abstraction.

For this phase, keep the existing styling stack operational:

```text
Tailwind CSS
CVA where currently justified
cn()
Kobalte
existing CSS custom properties
plain CSS where already appropriate
```

The purpose of this follow-up is to make the architecture ready for a later styling-system migration without combining two large migrations into one review surface.

---

# 5. Primary Completion Goals

The follow-up is complete when all of these are addressed:

```text
A. root AGENTS.md reflects the real architecture and mandatory rules
B. Hugeicons uses the official SolidJS renderer
C. feature -> component dependency leaks are removed
D. async asset loading cannot repopulate singleton state after runtime teardown
E. application/runtime destruction is safe and idempotent
F. preview teardown owns the global/shared state it enables
G. static setup document styling no longer hardcodes design decisions in lifecycle code
H. architecture/design/refactor docs match the final source tree
I. no stale claims remain in the refactor documentation
J. all checks pass
```

Do these incrementally.

Do not combine all items into one giant commit.

---

# 6. First Task: Fix the Agent Documentation

## Problem

The repository root `AGENTS.md` still contains only the older commit-message instructions.

The detailed architectural rules currently live under `documents/REFACTORING.md`.

That is not enough.

Agents commonly discover root-level instructions automatically. If the real rules are only in a document that must be discovered manually, future automated changes can regress the architecture.

## Required outcome

Rewrite root:

```text
AGENTS.md
```

so it contains the current engineering rules.

It should cover at minimum:

```text
architecture direction
route responsibilities
feature responsibilities
service boundaries
lifecycle ownership
UI primitive boundaries
Hugeicons policy
brand icon policy
CSS custom-property/runtime-value rules
Tailwind status
dependency rules
utility-module rules
accessibility
OBS constraints
testing requirements
Conventional Commits
```

The root file must also explicitly require repository-wide refactor agents to read:

```text
documents/REFACTORING.md
documents/REFACTORING_FOLLOWUP.md
```

Do not make `AGENTS.md` a one-line pointer.

The important rules must remain visible directly in the root file.

## Preserve

Keep the existing Conventional Commit rules.

Keep:

```text
bun run check
```

as the preferred full validation command.

---

# 7. Update: Hugeicons Official SolidJS Renderer Now Exists

## Previous state

The first cleanup pass introduced:

```text
@hugeicons/core-free-icons
src/components/ui/icon.tsx
```

and implemented a custom renderer for Hugeicons `IconSvgObject` data.

That decision was based on the statement that no official SolidJS renderer existed.

That statement is now stale.

## Current official package

Hugeicons now provides:

```text
@hugeicons/solid-js
```

The official SolidJS documentation uses:

```text
@hugeicons/solid-js
+
@hugeicons/core-free-icons
```

with the `HugeiconsIcon` component.

Official reference:

```text
https://hugeicons.com/docs/integrations/solid-js/overview
https://hugeicons.com/docs/integrations/solid-js/wrapper
https://hugeicons.com/docs/integrations/solid-js/best-practices
```

## Required change

Add:

```text
@hugeicons/solid-js
```

Keep:

```text
@hugeicons/core-free-icons
```

Remove the custom SVG payload rendering logic from:

```text
src/components/ui/icon.tsx
```

The local `Icon` primitive may remain, but it should become a **thin project wrapper** around `HugeiconsIcon`.

Target responsibility:

```text
HugeiconsIcon
  = vendor SVG rendering

ChatYX Icon
  = ChatYX defaults and accessibility convention
```

The project wrapper may own:

```text
default size
default stroke width
currentColor
class forwarding
decorative accessibility defaults
```

It must NOT continue owning:

```text
manual SVG tag creation
manual attribute kebab-casing
manual Hugeicons payload traversal
vendor-specific SVG normalization
```

## Suggested conceptual implementation

Do not copy this blindly; verify the current official API first.

```tsx
import { HugeiconsIcon } from "@hugeicons/solid-js";
import type { IconSvgObject } from "@hugeicons/core-free-icons";

export function Icon(props: IconProps) {
  return (
    <HugeiconsIcon
      icon={props.icon}
      size={props.size ?? "1em"}
      color="currentColor"
      strokeWidth={1.5}
      class={props.class}
      ...
    />
  );
}
```

Preserve existing accessible behavior.

## Import policy

Prefer specific icon imports that keep bundling predictable.

Do not use:

```ts
import * as Icons from "@hugeicons/core-free-icons";
```

Do not introduce runtime string lookup for icon names.

Typed icon values remain the contract.

## Exit criteria

Repository contains:

```text
@hugeicons/solid-js
@hugeicons/core-free-icons
```

and no project-owned Hugeicons SVG renderer logic.

All icon call sites still use typed icons.

No icon font returns.

No Lucide dependency returns.

---

# 8. Preserve the Current Icon Architecture

The following decisions from the first refactor remain valid.

## General UI icons

Use Hugeicons.

Examples:

```text
search
close
play
pause
arrows
navigation
settings
database
colors
bot
voice
status
```

## Brand icons

Do not force streaming-platform brands through generic Hugeicons icons.

Keep canonical ownership for:

```text
Twitch
YouTube
Kick
7TV
GitHub
```

If `PlatformGlyph.tsx` is the canonical monochrome owner, preserve that model unless there is a concrete reason to improve it.

## Bespoke graphics

Do not replace:

```text
sparklines
chat event artwork
reply visuals
role artwork
custom visualizations
```

with generic UI icons merely for consistency.

Consistency means one system **per responsibility**, not one renderer for every drawing in the application.

---

# 9. Fix the Feature → Component Dependency Leak

## Current issue

The setup search feature currently imports a type from a presentation component:

```text
src/features/setup/settingsSearch.ts
    ↓
src/components/setup/SetupLayout.tsx
```

Specifically:

```text
SetupSectionId
```

This reverses the intended dependency direction.

A feature-level module should not depend on a component module only to access a domain/UI-contract type.

## Required outcome

Move setup section identity/configuration to a neutral setup contract.

Possible targets:

```text
src/features/setup/model/setupSections.ts
```

or:

```text
src/config/setupSections.ts
```

Choose based on actual responsibility.

A good target should allow:

```text
route
component
feature search
```

to import the same contract without importing each other.

Example responsibility:

```ts
export type SetupSectionId =
  | "import"
  | "appearance"
  | ...
```

Potentially the navigation descriptors may also belong there if they are not presentation-specific.

Do not move icon components into a model/config module if doing so would mix visual dependencies into the domain contract.

Separate:

```text
section identity
```

from:

```text
section presentation/icon metadata
```

when appropriate.

## Exit criteria

No file under:

```text
src/features/
```

imports:

```text
src/components/
```

unless the architecture explicitly documents and justifies that dependency.

Search the full repository, not only setup.

---

# 10. Audit All Dependency Direction Violations

Do a fresh import-boundary audit.

At minimum search for:

```text
services -> features
services -> routes
features -> routes
features -> components
config -> components
utils -> routes
```

Do not mechanically forbid every `config -> services` edge if the current architecture intentionally permits a dependency-free capability leaf.

The first refactor explicitly allows:

```text
config/setupTemplates
    ↓
services/storage/setupStorage
```

because storage is a leaf capability.

Evaluate dependency direction by responsibility and cycle risk.

Record any intentional exceptions in `ARCHITECTURE.md`.

---

# 11. Critical Lifecycle Follow-up: Async Loads After Teardown

## Why this matters

The current live runtime now calls:

```text
badgeService.reset()
emoteService.reset()
```

during teardown.

That is useful, but reset alone does not cancel requests that are already in flight.

The runtime also starts asynchronous background work such as:

```text
assetLoader.loadEmotes(...)
assetLoader.loadDeferredAssets(...)
shared-channel loads
badge loads
cosmetic loads
```

Some of these operations mutate singleton services after their promises resolve.

A possible race is:

```text
runtime A starts async load
↓
runtime A is destroyed
↓
singleton reset runs
↓
runtime B starts
↓
old runtime A request resolves
↓
old result mutates the shared singleton again
```

If this can happen, teardown is not a true ownership boundary.

## Required work

Do not assume this bug exists in every service.

Prove or disprove it.

Audit:

```text
src/services/chat/assets/emoteService.ts
src/services/badges/badgeService.ts
src/services/chat/runtime/chatAssetLoader.ts
src/services/chat/seven-tv/*
src/services/chat/rte/*
```

Identify every async operation that:

1. begins under a runtime;
2. can survive runtime destruction;
3. mutates shared/global state after awaiting.

## Acceptable solutions

Choose the smallest correct ownership model.

Possible patterns:

### Generation token

```text
service generation increments on reset
async load captures generation
mutation is allowed only if generation still matches
```

### AbortController

Use when the underlying request path supports true cancellation cleanly.

### Runtime-owned loader instance

Prefer instance ownership if a singleton is not actually needed.

### Scoped commit token

Load data into a local structure, then commit only if the owning runtime is still current.

Do not add cancellation abstractions where the existing call cannot outlive a runtime.

## Tests required

Add deferred-promise regression tests.

A useful test shape:

```text
start load for old channel
hold promise unresolved
reset/destroy
start new runtime or leave store empty
resolve old promise
assert old data was NOT committed
```

Test actual mutation boundaries, not only runtime callbacks.

`initializationGeneration` in `LiveChatRuntime` is not enough if a service mutates its own singleton before the runtime sees the promise completion.

## Exit criteria

Old asynchronous work cannot repopulate shared asset state after its owner is destroyed/reset.

---

# 12. Verify Badge Reset Semantics

The existing tests verify:

```text
runtime-added badge data is removed
built-in fallback badges survive reset
```

Keep that behavior.

But also inspect:

```text
in-flight Twitch badge loads
in-flight third-party badge loads
in-flight user badge loads
```

If old requests can commit after reset, add the same generation/cancellation protection described above.

Do not remove fallback badges during reset unless the service is redesigned so they are immutable constants outside the mutable store.

---

# 13. Verify Emote Reset Semantics

The current `emoteService.reset()` clears:

```text
global emotes
channel emotes
personal emotes
current channel
load bookkeeping
7TV visibility bookkeeping
```

That is a reasonable clean slate.

But verify in-flight behavior for:

```text
global emotes
channel emotes
shared-channel emotes
cheer emotes
personal emotes
7TV reload
```

A cleared promise registry does not automatically prevent the original promise body from mutating the store later.

Add a regression test for at least one representative old-runtime load.

If different mutation paths use different commit mechanisms, test more than one.

---

# 14. ChatOverlayApplication Destruction Must Be Safe Before Start Completes

## Current issue to review

`ChatOverlayApplication` constructs:

```text
runtime
predictions runtime
```

in its constructor.

Its current destroy logic returns immediately when:

```text
started === false
```

Conceptually:

```ts
destroy() {
  if (!this.started) return;
  ...
}
```

This means an object can own constructed resources even though `destroy()` refuses to destroy them when `start()` was never called.

The earlier refactor plan explicitly identified this lifecycle case but did not fully characterize it.

## Required outcome

Define the ownership contract.

Preferred contract:

```text
if construction creates an owned disposable resource,
destroy() must be safe whether or not start() was called
```

`destroy()` should also be idempotent.

## Required tests

Add tests covering:

```text
construct -> destroy
construct -> start -> destroy
construct -> start -> destroy -> destroy
start called twice
destroy while initialize is still pending
```

Do not require a full browser DOM if dependencies can be injected.

The application already has injectable factories; use them.

## Important

If the final correct design is instead:

```text
do not construct runtime/predictions until start()
```

that is also acceptable, but do not perform a broad lifecycle rewrite without tests.

---

# 15. Destroy During Pending Initialization

`application.start()` awaits:

```text
runtime.initialize()
```

while the route cleanup may run before initialization finishes.

The live runtime already has an initialization generation mechanism.

Audit the complete path:

```text
ChatOverlayApplication
LiveChatRuntime
PreviewRuntime
PredictionController
```

Ensure:

- no callback publishes stale state after destroy;
- no reconnect starts after destroy;
- no delayed timer is installed after destroy;
- no asset result from the old runtime leaks into the next one;
- predictions do not continue after application destruction.

Add focused tests at the narrowest responsible layer.

---

# 16. Preview Runtime Teardown Audit

The preview runtime currently owns:

```text
message interval
render timer
preview styles
presentation service
proxy state configuration
preview-loaded asset work
```

Audit whether `destroy()` fully releases everything `initialize()` enabled.

Explicitly review:

```text
setProxyEnabled(...)
badge state
emote state
7TV cosmetics state
mention style state
preview stylesheet/root attributes
presentation layout
```

Do not automatically reset a process-wide singleton if it is intentionally shared by another live owner in the same document.

Instead, define the ownership model.

If preview is the only owner in its document, teardown should leave the document in a clean state.

Add tests where practical.

---

# 17. RTE Proxy Global State Ownership

The RTE proxy uses shared mutable state.

Live runtime teardown now calls:

```text
setRteProxyEnabled(false)
```

Audit all owners:

```text
LiveChatRuntime
PreviewRuntime
tests
any other route/runtime
```

Answer:

```text
Can two owners coexist in one document?
Who is allowed to disable the flag?
Can an old runtime disable it after a new runtime enabled it?
```

If concurrent ownership is impossible by design, document that.

If concurrent ownership is possible, a plain process-wide boolean is not a sufficient ownership model.

Do not introduce reference counting unless concurrency actually exists.

---

# 18. Setup Document Styling: Remove Static Design Decisions From Lifecycle Code

## Current issue

`src/features/setup/setupDocument.ts` contains:

```ts
const SETUP_BACKGROUND = "#09090b";
```

The module's responsibility is document lifecycle:

```text
capture styles
lock scrolling
restore styles
watch reduced motion
```

A product design color does not belong in that lifecycle module.

## Required outcome

Make the document helper control state/ownership, not visual design values.

Preferred approaches:

### Class or data attribute

The lifecycle helper applies something like:

```text
data-setup-document
```

or a class, and CSS owns:

```text
background
overflow behavior where appropriate
```

### Existing semantic variable

If an inline value is genuinely required, use the existing semantic token/custom property rather than a raw color literal.

Avoid reading a CSS variable and copying its computed value back into inline styles unless there is a concrete reason.

## Preserve

The helper must still restore previous document state exactly when released.

Do not introduce route-change background flashes.

---

# 19. Setup Route Completion

The first pass reduced `setup.tsx` substantially.

Do not chase an arbitrary line-count target.

Review the remaining route and ask only:

```text
Does this code represent route composition?
Or is it still an independently testable responsibility?
```

Reasonable route responsibilities include:

```text
signals
effects wiring feature APIs
section composition
binding callbacks
route-level visibility
```

Potential remaining extraction candidates should only move if they have a clear separate contract.

Do not create:

```text
setupHelpers.ts
setupManager.ts
setupUtils.ts
```

as dumping grounds.

Do not split JSX into components solely because the route remains long.

---

# 20. Setup Section Descriptors

The first pass extracted several section row descriptors.

Review whether these descriptors now have a clear dependency structure.

Preferred:

```text
pure/typed descriptor definitions
+
feature-level callbacks/state supplied explicitly
+
presentation rendered by setup components
```

Avoid descriptor modules becoming hidden mini-routes that import many unrelated services.

No new service access should be added to section descriptor files.

---

# 21. `renderMessageContent.ts`: Do Not Split Just for Organization

The previous plan left a physical split of `renderMessageContent.ts` outstanding.

Do not treat that as mandatory.

The important architectural result already achieved is that rendering no longer requires a network client directly.

Only split the file if the current code demonstrates real independent responsibilities such as:

```text
tokenization
assembly
DOM binding
provider-specific transformation
```

and the split improves:

```text
testability
dependency direction
change isolation
```

Do not perform a wide mechanical file split merely to mark an old plan item complete.

If no strong benefit is found, explicitly mark the plan item as intentionally closed without further code movement.

---

# 22. Layout Manager Location

The previous plan notes that moving the layout manager under:

```text
features/chat-overlay
```

would create the wrong dependency direction because a service currently owns/uses it.

Do not force that move.

Instead, determine the actual responsibility.

Questions:

```text
Is LayoutManager generic presentation infrastructure?
Is it chat-specific runtime infrastructure?
Does it need feature knowledge?
```

Move only if the dependency graph becomes better.

If its current location is merely imperfect naming but dependency direction is correct, documentation may be the correct fix.

---

# 23. Documentation Consistency Pass

The first refactor changed code faster than some prose was updated.

Do a final documentation audit after code changes.

## Known stale item: Hugeicons

Remove claims such as:

```text
"There is no official Hugeicons package for Solid"
```

Update to the official:

```text
@hugeicons/solid-js
```

architecture.

## Known stale item: generated chat preset CSS

`DESIGN.md` currently contains language suggesting `chatStyles.ts` still generates preset-dependent style rules.

But the current branch already moved those presets to:

```text
getOverlayStyleVariables()
+
chat.css
```

Update the document to describe the actual final implementation.

Do not document completed work as "remaining."

## Audit all status words

Search docs for:

```text
remaining
outstanding
TODO
in progress
partly done
blocked
known remainder
still emits
does not exist
```

Verify each against the actual branch.

---

# 24. REFACTOR_PLAN Finalization

`documents/REFACTOR_PLAN.md` should remain useful as a historical execution record.

Do not delete useful outcomes.

But update it so a future agent cannot misread stale implementation notes as current truth.

For every remaining open item:

```text
complete it
or
mark it intentionally deferred with a precise reason
or
mark it no longer necessary
```

No ambiguous "in progress" should remain when this follow-up closes.

---

# 25. REFACTOR_AUDIT Finalization

Do not rewrite the audit to pretend the original problems never existed.

Instead add a closing section:

```text
## Post-refactor state
```

For each high-impact original issue, record:

```text
original problem
final owner
status
remaining debt
```

This preserves the value of the audit as history.

If scores are updated, keep both:

```text
before
after
```

rather than replacing the original score.

---

# 26. ARCHITECTURE.md Final State

After the code is final, `ARCHITECTURE.md` must describe reality.

Ensure it covers:

```text
setup feature boundaries
overlay lifecycle ownership
asset loading ownership
storage boundary
URL/config projection
icon system
brand assets
runtime style publication
plain/generated CSS boundaries
```

Do not describe Panda.

Do not describe Ark as a chosen standard unless it has actually been adopted.

Kobalte remains valid in this follow-up.

---

# 27. DESIGN.md Final State

Document the current styling model accurately.

The target **for this follow-up** is:

```text
Tailwind for existing application utility styling
components/ui for reusable primitives
CSS custom properties for overlay runtime values
plain CSS for overlay/provider/browser integration boundaries
Hugeicons Solid renderer for generic UI icons
brand-owned SVG/glyph components for brands
```

Do not claim Panda tokens exist.

Do not write aspirational future-stack documentation as current state.

A future Panda migration may replace part of this model later.

---

# 28. Tailwind: Stabilize, Do Not Expand

Panda is deferred, but this does not mean new Tailwind spaghetti is acceptable.

During this follow-up:

- reuse existing primitives;
- avoid giant repeated utility strings;
- extract a component/variant only when repetition is real;
- do not introduce a new Tailwind abstraction layer;
- do not migrate existing plain overlay CSS to Tailwind;
- do not add Tailwind to provider/runtime-generated markup.

No Tailwind removal is required.

---

# 29. CVA / `tailwind-merge` / `clsx`

Keep them if they still have real usages.

Do not remove a dependency just because a future Panda migration may replace it.

Do not add new CVA recipes unless a reusable variant contract actually exists.

Use the project's `cn()` helper where class composition is appropriate.

---

# 30. Kobalte

Do not migrate to Ark UI in this follow-up.

Kobalte migration is a separate behavioral migration.

Keep existing accessible primitives stable.

Do not reimplement Kobalte behavior manually.

If you encounter a Kobalte issue while finishing this work, fix the smallest issue necessary and document it.

---

# 31. CSS Custom Property Contract

Preserve the useful direction established by PR #15:

```text
static CSS owns rule shape
runtime publishes values
```

For overlay configuration:

```text
getOverlayStyleVariables()
    ↓
OverlayStyleManager
    ↓
document root custom properties
    ↓
chat.css
```

This is the preferred model.

Do not revert to one generated stylesheet per preset.

---

# 32. Generated CSS Boundary

Generated CSS remains valid only where the rule shape genuinely comes from runtime/provider data.

Examples that may remain:

```text
7TV paint/cosmetics
emote modifiers
provider-controlled visual data
animation vocabulary if static CSS cannot represent the required contract cleanly
```

Before keeping generated CSS, answer:

```text
Could stable CSS + custom properties express this?
```

If yes, prefer stable CSS.

Do not force dynamic provider data into an unsuitable token system.

---

# 33. Animation Stylesheet Ownership

The first refactor fixed duplicate animation stylesheets and later fixed a teardown regression.

Keep tests that ensure:

```text
one #chat-animations stylesheet
repeated apply does not accumulate duplicates
teardown removes it
```

Audit whether animation CSS itself can safely remain in the current runtime module.

Do not move it solely for file organization.

---

# 34. Overlay Style Manager Contract

Preserve:

```text
apply
  → publish all overlay properties/attributes
cleanup
  → remove every property/attribute/style resource it owns
```

`apply()` should be safe when called repeatedly.

`cleanup()` should be safe when called repeatedly.

A later `apply()` after cleanup should reconstruct a correct state.

Add or retain tests for these properties.

---

# 35. Browser Global State Audit

Search for mutable browser-global state:

```text
documentElement attributes
root inline custom properties
global style elements
window listeners
matchMedia listeners
localStorage
postMessage listeners
singleton proxy flags
```

For each, identify:

```text
owner
installation point
cleanup point
whether cleanup is idempotent
whether an old owner can affect a new owner
```

Do not create a generic global-state manager.

Fix ownership at the narrowest responsible layer.

---

# 36. Singleton Audit

Search for exported singleton service instances.

Examples include:

```text
emoteService
badgeService
mentionStyleService
sevenTVCosmeticsService
chatFeatureIntegration
network/shared proxy state
```

For each singleton answer:

```text
Why is this global?
What state is channel-specific?
What resets on runtime teardown?
Can in-flight work mutate it after reset?
Can live and preview owners coexist?
```

Do not convert every singleton into dependency injection as a style exercise.

Change only where lifecycle correctness requires it.

---

# 37. Test Strategy

Prefer characterization tests at the layer that owns the behavior.

Do not require a full DOM environment when a dependency seam already exists.

Use:

```text
injected factories
deferred promises
minimal window/document shims
pure projection tests
service-level tests
```

Avoid brittle snapshots of generated class names.

Test:

```text
observable behavior
lifecycle
public URL contracts
mutation ownership
cleanup
```

---

# 38. Required New Regression Tests

At minimum, add tests for the following if they are not already present after the agent re-scans the branch.

## Application lifecycle

```text
destroy before start
double destroy
double start
destroy while runtime initialize is pending
```

## Async singleton mutation

```text
old emote load cannot commit after reset
old badge load cannot commit after reset
```

or equivalent tests at the actual mutation boundary.

## Icon wrapper

Only test project behavior if meaningful.

Do not test Hugeicons vendor internals.

## Dependency direction

A custom architecture test is optional.

Prefer simple import cleanup over introducing a complex static-analysis framework for one issue.

---

# 39. Browser Verification

After structural tests pass, perform browser checks for:

```text
setup page
preview
live/demo switching
settings search
channel persistence
overlay URL generation
chat preview navigation
navigation icons
brand glyphs
reduced motion
route cleanup
```

Overlay checks:

```text
normal message
reply
badges
events
gigantified emotes
emote modifiers
custom font/stroke/shadow
horizontal layout
transparent background
animations
```

Use automated browser tooling if available outside the project.

Do not add a browser-test dependency merely for this follow-up unless the project explicitly wants one.

---

# 40. Bundle Verification

After switching to `@hugeicons/solid-js`, compare production output.

Do not assume the official renderer is automatically smaller.

Verify:

```text
build succeeds
icons tree-shake as expected
no icon font returns
no full icon barrel is accidentally bundled
```

If importing through package subpaths is still materially better and supported, keep that pattern.

If official Hugeicons best practices recommend named imports and the bundler tree-shakes them correctly, use the simplest verified approach.

Measure rather than speculate.

---

# 41. Accessibility Verification

Icon migration must preserve:

```text
decorative icons hidden from assistive technology
icon-only controls have labels
buttons remain semantic buttons
focus remains visible
radiogroups remain keyboard/AT understandable
disabled state is preserved
```

Do not expose duplicate names from both an icon and its surrounding labelled control.

---

# 42. No Visual Redesign

This follow-up is structural.

Do not change:

```text
spacing
colors
typography
component density
icon meaning
preview layout
overlay visual language
```

unless necessary to fix a bug.

If a tiny visual difference is unavoidable due to switching to the official Hugeicons renderer, identify and verify it explicitly.

Prefer matching the existing Hugeicons glyph appearance.

---

# 43. Public Contracts Must Not Change

Do not change:

```text
chat URL parameter names
URL defaults
setup import/export meaning
OBS source compatibility
preview message protocol
platform source configuration
stored setup keys
```

without an explicit breaking-change task.

Run the existing round-trip tests.

---

# 44. Storage Contract

Keep:

```text
chatyx.setup.config.v1
chatyx.setup.twitchChannel
chatyx.setup.previewStageBackdrop
chatyx.setup.previewStageColor
chatyx.setup.templates.v1
```

unless a deliberate migration is added.

Do not rename storage keys as cleanup.

If storage schema changes, add migration and tests.

---

# 45. Commit Strategy

Suggested order:

```text
docs(agents): publish refactor rules at repository root

refactor(icons): use official hugeicons solid renderer

refactor(setup): move section identity out of presentation
refactor(architecture): remove remaining layer inversions

test(chat): characterize application destruction
fix(chat): make application teardown idempotent

test(chat): reproduce stale emote load after reset
fix(chat): prevent stale emote commits after teardown

test(chat): reproduce stale badge load after reset
fix(chat): prevent stale badge commits after teardown

refactor(setup): move document appearance back to css

docs(refactor): reconcile final architecture and outcomes
```

Actual commits should follow actual findings.

If an investigated race is proven impossible, do not create fake production work.

Document the proof and add a test if it is valuable.

---

# 46. Do Not Reopen Completed Work Without Evidence

The previous cleanup already completed many changes.

Do not redo:

```text
setup storage extraction
form coercion extraction
setup config projection
preview synchronizer extraction
settings search extraction
icon-font deletion
Lucide removal
chat style-variable conversion
animation stylesheet de-duplication
dead legacy token removal
```

unless a concrete bug is discovered.

Refactoring the refactor is not a goal.

---

# 47. Completion Report

When the follow-up is done, append a final section to this document:

```md
# Completion Report

## Completed items

## Items investigated and intentionally unchanged

## Deferred items

## New tests

## Dependency changes

## Bundle/build impact

## Final verification
```

For every intentionally unchanged item, explain why no code change was necessary.

---

# 48. Required Final Searches

Before declaring completion, search the full repository for:

```text
lucide-solid
hgi-
hgi-stroke
@hugeicons/solid-js
HugeiconsIcon
IconSvgObject
TODO
HACK
in progress
partly done
remaining exception
no official Hugeicons
SETUP_BACKGROUND
from "~/components
```

Interpret results, do not mechanically force zero results for generic searches.

Specific expectations:

```text
lucide-solid → zero
hgi-* UI classes → zero
"no official Hugeicons..." stale docs → zero
@hugeicons/solid-js → expected usage
```

Also audit imports under `src/features` manually for presentation-layer dependencies.

---

# 49. Required Final Verification

Run:

```bash
bun run lint
bun run typecheck
bun test ./tests
bun run build
```

Then:

```bash
bun run check
```

If `bun run check` duplicates the individual commands, that is fine.

Record exact results in the completion report.

Do not claim green status without running the commands on the final tree.

---

# 50. Definition of Done

This follow-up is complete only when:

## Agent guidance

- root `AGENTS.md` contains the real engineering rules;
- it requires reading this follow-up for repository-wide refactor work.

## Icons

- `@hugeicons/solid-js` is used as the vendor renderer;
- the ChatYX `Icon` wrapper is thin;
- no custom Hugeicons payload renderer remains;
- no Lucide remains;
- no icon font remains;
- brand assets retain separate ownership.

## Architecture

- features do not depend on components for shared contracts;
- known layer inversions are removed or explicitly justified;
- setup remains a composition-oriented route;
- no generic helper dumping ground was introduced.

## Lifecycle

- application destruction is safe before/after start;
- destroy is idempotent;
- pending initialization cannot publish stale ownership state;
- old async asset work cannot repopulate reset singleton state;
- preview/global proxy ownership is explicitly correct.

## Styling

- no Panda CSS is introduced;
- no broad Tailwind rewrite occurs;
- lifecycle modules do not own static design colors unnecessarily;
- overlay runtime styling remains stable CSS + custom property values.

## Documentation

- `AGENTS.md` is current;
- `ARCHITECTURE.md` matches code;
- `DESIGN.md` matches code;
- `REFACTOR_PLAN.md` has no misleading open/stale status;
- outdated Hugeicons claims are removed;
- this document contains a completion report.

## Verification

```text
lint: pass
typecheck: pass
tests: pass
build: pass
bun run check: pass
```

---

# 51. What Comes After This

A future PR may evaluate:

```text
Panda CSS
semantic design tokens
Panda recipes
possible Ark UI migration
Tailwind removal
CVA/tailwind-merge cleanup
```

That future work is intentionally outside this follow-up.

The repository should first have:

```text
correct ownership
stable lifecycle
correct docs
one icon renderer
clean layer direction
```

Only then should the styling engine be replaced.

---

# 52. Final Instruction to the Agent

Do not optimize for the number of refactor tasks marked complete.

Optimize for correctness and clear ownership.

For every change ask:

```text
What problem exists?
Which layer owns the solution?
What observable behavior must remain?
What test proves it?
Can old asynchronous work outlive this owner?
Does this make the next contributor's choice more obvious?
```

If there is no concrete problem, do not move code.

If a previous plan item is no longer useful, close it explicitly instead of performing a ceremonial refactor.

The desired end state of this follow-up is:

```text
current architecture
+ finished lifecycle ownership
+ correct dependency direction
+ official Hugeicons Solid integration
+ current agent/documentation rules
- stale assumptions
- refactor leftovers
```

**Do not add Panda CSS in this phase.**
