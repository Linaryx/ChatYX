# ChatYX Agent Instructions

These instructions apply to every coding agent working in this repository.

The goal is not only to make code pass. Changes should preserve and improve the architecture of ChatYX over time.

Before making non-trivial changes, understand the relevant feature, its dependencies, its lifecycle, and the existing project conventions.

---

## 1. Core Engineering Principles

Prefer:

- clear ownership over shared mutable behavior;
- feature boundaries over generic technical buckets;
- explicit dependencies over hidden globals;
- reusable UI primitives over repeated markup;
- semantic design tokens over repeated visual literals;
- one clear library responsibility over overlapping solutions;
- small, behavior-preserving refactors over rewrites;
- characterization tests before changing risky code;
- direct, readable code over abstraction for abstraction's sake.

Do not optimize primarily for fewer lines or smaller files.

A large cohesive file may be acceptable.
A small file with mixed responsibilities may still be poorly designed.

Split code by **reason to change**, not by line count.

---

## 2. Required Project Context

Before any substantial refactor, read:

- `README.md`
- `CONTRIBUTING.md`
- `documents/ARCHITECTURE.md`
- `documents/DESIGN.md`
- `package.json`
- `solidcn.json`
- relevant tests for the feature being changed

For repository-wide architectural work, inspect the full project structure first:

```text
src/
services/
tests/
scripts/
public/
documents/
```

Do not start a repository-wide cleanup after inspecting only one or two files.

---

## 3. Architecture Direction

The intended dependency direction is:

```text
routes -> features -> services/config/utils
                     -> platform adapters
```

General responsibilities:

```text
routes/
  Routing and UI composition.
  Bind Solid signals/JSX to feature APIs.
  Avoid owning infrastructure and domain behavior.

features/
  Application behavior and feature-level coordination.
  Lifecycle ownership.
  Feature model/state transformations.

components/ui/
  Generic reusable visual primitives.
  No ChatYX-specific domain knowledge.

components/<feature>/
  Reusable presentation components for a specific feature.

services/
  Network, browser, provider, storage, platform, and integration capabilities.

config/
  Configuration schemas, normalization, parsing, serialization, and defaults.

utils/
  Small genuinely reusable helpers.
  Do not use `utils` as a dumping ground for domain logic.

styles/
  Shared styling contracts and runtime style helpers where appropriate.
```

A service must not import a route or feature.

Routes should not become service/application layers.

---

## 4. Composition Roots and Lifecycle Ownership

Every long-lived resource must have one clear owner.

This includes:

- sockets;
- timers;
- intervals;
- subscriptions;
- observers;
- DOM listeners;
- browser-global listeners;
- mutable caches;
- reconnect loops;
- preview runtimes;
- external provider sessions.

If code starts a resource, ownership of cleanup must be obvious.

Prefer:

```text
create feature/application
  -> create runtime/resources
  -> expose API
  -> destroy()/cleanup()
```

Avoid orphaned side effects or cleanup spread across unrelated modules.

Browser-global custom events should be used only at actual browser/integration boundaries, not as an internal event bus between modules that can communicate directly.

---

## 5. Refactoring Workflow

For non-trivial refactors, do not immediately rewrite code.

Use this order:

1. Inspect.
2. Identify current responsibility boundaries.
3. Identify concrete problems.
4. Verify behavior with existing tests.
5. Add characterization tests when behavior is insufficiently protected.
6. Define the target responsibility boundary.
7. Refactor one concern at a time.
8. Run checks.
9. Remove dead compatibility code only after migration is complete.
10. Update architecture/design documentation when the contract changed.

For repository-wide cleanup, create or update:

- `documents/REFACTOR_AUDIT.md`
- `documents/REFACTOR_PLAN.md`

The audit must use concrete file references and examples rather than subjective statements such as "this is spaghetti."

---

## 6. How to Identify Spaghetti Code

Do not label a file as spaghetti only because it is large.

Evidence of architectural debt includes:

- unrelated responsibilities changing for unrelated reasons;
- UI code performing network/storage/infrastructure work;
- repeated orchestration logic;
- unclear lifecycle ownership;
- hidden global state;
- duplicated normalization or parsing;
- cross-layer imports against the documented dependency direction;
- one component knowing about many unrelated providers/services;
- generic helpers containing feature/domain behavior;
- arbitrary string protocols where typed structures would be clearer;
- repeated visual patterns that bypass existing primitives;
- generated styling logic spread across unrelated layers;
- multiple libraries solving the same responsibility without a documented reason.

When reporting architectural debt, always identify:

```text
file
responsibility currently owned
responsibility that does not belong there
proposed owner
regression risk
tests protecting the change
```

---

## 7. Known High-Risk Areas

Treat the following areas as architecture-sensitive:

```text
src/routes/setup.tsx
src/components/chat/ChatMessage.tsx
src/components/chat/renderMessageContent.ts
src/components/setup/
src/features/chat-overlay/
src/services/chat/
src/styles/
src/utils/chat/
src/utils/ui/
```

This does not mean they must always be split.

Inspect them carefully for responsibility mixing before modifying them.

### Setup route

`src/routes/setup.tsx` should trend toward being a UI composition root rather than an infrastructure implementation.

When appropriate, move responsibilities such as:

- persistence;
- browser capability detection;
- Twitch lookup;
- remote fetch orchestration;
- setup model/state operations;
- preview synchronization;
- serialization/mapping

into explicit feature/application/service modules.

Do not move code merely to reduce the size of the route.

---

## 8. UI Component Architecture

The project already has a reusable primitive layer:

```text
src/components/ui/
```

Use it.

Before implementing a new control manually, check whether the project already has an appropriate primitive.

Typical generic primitives include:

- Button;
- Input;
- Textarea;
- Select;
- Switch;
- Slider;
- Label;
- Badge;
- Card;
- Separator;
- Collapsible;
- icon button patterns.

The intended layering is:

```text
generic primitive
    ↓
feature-specific wrapper/component
    ↓
route/page composition
```

Example:

```text
components/ui/Button
        ↓
components/setup/SetupAction
        ↓
routes/setup
```

Avoid repeatedly implementing the same button/input/field structure directly inside routes.

### `components/ui`

Components in `components/ui` must:

- be generic;
- not know about Twitch, YouTube, Kick, chat configuration, OBS, TTS, RTE, or setup sections;
- expose predictable variants;
- use the shared token system;
- preserve accessibility behavior;
- avoid feature-specific side effects.

### Feature components

Feature-specific presentation belongs in directories such as:

```text
components/setup/
components/chat/
components/predictions/
```

If a component contains application behavior instead of presentation, consider moving the behavior into the corresponding feature layer.

---

## 9. Icon Policy

Do not introduce arbitrary new icon systems.

The project should converge on one general-purpose UI/system icon strategy.

Current code may contain a mixture of:

- `lucide-solid`;
- Hugeicons CSS/font classes;
- inline SVG;
- SVG files under `public/`;
- platform/brand logos.

When touching icon-related code, classify the icon first.

### UI/system icons

Examples:

- arrows;
- close;
- play/pause;
- settings;
- search;
- chevrons;
- status symbols.

These should use one consistent general-purpose icon library unless there is a documented reason otherwise.

Prefer tree-shakeable typed components over stringly-typed icon class names.

Avoid patterns such as:

```ts
icon: "some-icon-class-name"
```

when a typed icon component/key can provide compile-time safety.

### Brand icons

Brand assets are different from generic UI icons.

Examples:

- Twitch;
- YouTube;
- Kick;
- GitHub.

Do not replace brand logos with visually similar generic icons.

Centralize brand icon ownership so the same logo is not duplicated as:

- inline SVG;
- a second inline SVG;
- a public SVG;
- an icon-font glyph

at the same time without a real reason.

### Inline SVG

Inline SVG is acceptable when:

- the graphic is custom;
- it is not provided by the approved UI icon library;
- it needs runtime geometry;
- it is a visualization rather than an icon;
- centralizing it would make the code less clear.

Do not mechanically replace charts, sparklines, or custom graphics with an icon library.

---

## 10. CSS and Design Tokens

The project uses Tailwind and CSS custom properties.

New styling should strengthen one coherent token system rather than create parallel systems.

### Token categories

Use design tokens for repeated design decisions.

Examples:

```text
surface colors
text colors
semantic action colors
borders
radii
spacing scale
font sizes
font weights
shadows
focus rings
motion durations
easing
control dimensions
z-index layers
```

Prefer semantic tokens.

Good:

```css
--surface-card
--text-muted
--border-default
--action-primary
--radius-md
--duration-fast
```

Avoid meaningless token names whose semantic role is unclear.

### Component tokens

Component-level custom properties are appropriate when the value is part of a stable component contract.

Examples:

```css
--chat-event-gap
--chat-event-radius
--setup-sidebar-width
--prediction-label-color
```

### Runtime values

Do not turn runtime values into global static design tokens.

Examples of valid runtime values:

- user-selected colors;
- measured sizes;
- prediction percentages;
- emote dimensions;
- dynamic transforms;
- provider cosmetics;
- runtime layout calculations.

Prefer passing runtime presentation values through a small set of CSS custom properties when that makes the relationship clearer.

---

## 11. Hardcoded Visual Values

Do not introduce repeated hardcoded presentation values when a shared semantic token exists.

When touching CSS, inspect repeated:

- hex/rgb/hsl colors;
- border radii;
- spacing;
- control heights;
- shadows;
- transitions;
- opacity;
- typography;
- z-index values.

Move repeated design decisions to the shared token system when appropriate.

Do not convert every numeric literal into a CSS variable.

A value should become a token because it represents a reusable design decision, not because it is a number.

---

## 12. Inline Styles

Inline styles are not universally forbidden.

They are appropriate for genuinely dynamic values such as:

```tsx
style={{ transform: dynamicTransform() }}
style={{ color: userSelectedColor() }}
style={{ width: `${runtimeWidth()}px` }}
```

Static presentation values should normally live in reusable classes, variants, or tokens.

Bad reason for inline style:

> "It was faster to put the static design value here."

Good reason:

> "The value is produced dynamically at runtime and is part of the component API."

---

## 13. `!important`

Do not mechanically remove every `!important`.

Classify existing usages as one of:

```text
necessary boundary override
third-party/provider override
OBS/runtime compatibility requirement
legacy specificity workaround
unnecessary
```

`!important` may be justified for:

- externally generated markup/styles;
- provider cosmetics;
- emote modifiers;
- OBS integration constraints;
- runtime user-selected presentation contracts.

When it is only compensating for poor local specificity, prefer fixing the CSS architecture.

Document non-obvious necessary overrides.

---

## 14. Generated CSS

Be cautious with CSS assembled as TypeScript strings.

Before adding more generated CSS, ask whether the behavior can be represented as:

```text
stable CSS rule
+
runtime CSS custom property
```

Prefer:

```ts
element.style.setProperty("--runtime-value", value);
```

with:

```css
.some-class {
  property: var(--runtime-value);
}
```

when this accurately represents the behavior.

However, do not force third-party/provider cosmetics or genuinely dynamic external style payloads into static CSS when the generated form is the correct integration boundary.

---

## 15. Library Responsibilities

Every library should have one clear role.

Current core responsibilities include:

### SolidJS

Use for:

- components;
- signals;
- memos;
- effects;
- lifecycle;
- reactive composition.

### Kobalte

Use for accessible headless UI behavior where appropriate.

Do not reimplement complex accessible primitive behavior manually when the existing library already provides it well.

### SolidCN/project UI primitives

Use for shared styled application primitives under `src/components/ui`.

### Tailwind

Use for:

- layout;
- utility composition;
- reusable variants;
- integration with the token system.

Do not add another general CSS framework.

### class-variance-authority

Use for meaningful reusable component variants.

Do not create variant abstractions for one-off styling.

### `clsx` / `tailwind-merge`

Use through the project's shared `cn()` helper.

### Icon library

Use for general-purpose UI/system icons only.

Brand assets and custom visualizations are separate concerns.

---

## 16. Dependency Rules

Before adding a dependency, answer:

1. What responsibility does it own?
2. Is that responsibility already covered by an existing dependency?
3. Is the added runtime/bundle cost justified?
4. Does it work naturally with SolidJS?
5. Can the requirement be solved clearly without a new dependency?

Do not add overlapping libraries without a strong reason.

When refactoring, remove an old dependency only after all real usages are migrated and tests/builds pass.

---

## 17. Utility Modules

Do not create generic dumping grounds.

Names such as:

```text
utils
helpers
common
manager
misc
service
handler
```

should be treated with suspicion when they hide the real responsibility.

Before putting code in `utils`, ask:

- Is it a pure general helper?
- Is it chat domain logic?
- Is it setup feature logic?
- Is it configuration logic?
- Is it a browser/platform adapter?
- Is it presentation calculation?
- Is it parsing/normalization?

Place the code with the responsibility it actually belongs to.

Avoid moving cohesive code into many tiny files only to satisfy a directory pattern.

---

## 18. Duplication

Do not look only for identical text.

Also inspect duplication of:

- UI field structures;
- icon patterns;
- fetch wrappers;
- localStorage access;
- provider maps;
- normalization;
- error handling;
- section layouts;
- repeated CSS declarations;
- platform logos;
- configuration transformations.

Distinguish:

```text
accidental duplication
```

from:

```text
coincidental similarity
```

Do not introduce an abstraction after seeing the same-looking code only once or twice unless the shared responsibility is real.

---

## 19. Type Safety

Prefer typed boundaries over string protocols.

Examples:

- typed icon identifiers/components;
- typed provider identifiers;
- discriminated unions for state;
- explicit feature APIs;
- validated configuration objects.

Avoid widening types simply to make a refactor compile.

Do not replace known domain types with `string`, `unknown`, or `any` unless the boundary truly requires it.

Keep parsing/validation at external boundaries.

---

## 20. Accessibility

Refactors must preserve or improve accessibility.

Do not regress:

- labels;
- ARIA relationships;
- keyboard navigation;
- focus visibility;
- semantic buttons/links;
- disabled state behavior;
- readable contrast;
- screen-reader descriptions.

Use accessible primitives from existing libraries rather than rebuilding them casually.

Icons used purely for decoration should remain hidden from assistive technology.

Icon-only actions must have an accessible name.

---

## 21. OBS and Overlay Constraints

The overlay is not a normal application page.

Preserve:

- transparent page/background behavior;
- source ordering;
- message wrapping contracts;
- emote modifier behavior;
- provider cosmetics;
- user-selected fonts/colors/strokes/shadows;
- overlay URL/config compatibility;
- horizontal/vertical layout behavior;
- event rendering semantics.

Do not "clean up" CSS in a way that breaks browser-source rendering.

Runtime presentation contracts documented in `documents/DESIGN.md` take precedence over aesthetic simplification.

---

## 22. Tests and Regression Safety

Before changing risky behavior, inspect the existing tests.

Important coverage areas include:

- URL/config parsing and serialization;
- setup import/export;
- setup templates;
- chat runtime lifecycle;
- message rendering;
- event rendering;
- emote modifiers;
- sender identity;
- provider adapters;
- preview behavior;
- RTE;
- TTS;
- SevenTV cosmetics;
- animation/layout calculations.

If behavior is important but not clearly protected, add a characterization test before refactoring it.

Never delete a valid test merely to make a refactor easier.

---

## 23. Repository-Wide Refactor Audits

When explicitly asked to assess architecture/technical debt, inspect the full repository and create evidence-based reports.

Recommended scoring dimensions:

```text
architecture coupling
responsibility mixing
UI duplication
CSS inconsistency
icon inconsistency
dependency overlap
global state / side effects
testability
naming / discoverability
overall technical debt
```

Use a 0–10 scale where:

```text
0 = no meaningful problem found
10 = severe systemic problem
```

Every score must cite concrete examples.

Reports should include:

```text
top architectural hotspots
quick wins
highest-risk refactors
dependency responsibility map
icon inventory
CSS/token inventory
migration phases
regression risks
```

Do not invent quantitative precision that the code does not support.

---

## 24. Preferred Refactor Order

When doing a broad cleanup, prefer this order unless evidence supports a different sequence:

### Phase 1 — Guard rails

- inspect architecture;
- add missing characterization tests;
- document current behavior;
- make no unnecessary visual changes.

### Phase 2 — Design tokens

- consolidate semantic tokens;
- remove repeated static design literals;
- keep runtime values dynamic.

### Phase 3 — Icon normalization

- establish one UI/system icon strategy;
- centralize brand icons;
- remove actual duplication;
- remove unused icon infrastructure only after migration.

### Phase 4 — UI primitives

- reuse `components/ui`;
- extract genuine repeated controls/layout primitives;
- keep feature-specific wrappers outside `components/ui`.

### Phase 5 — Setup decomposition

- reduce infrastructure and application logic inside `src/routes/setup.tsx`;
- extract responsibilities by reason to change;
- preserve setup behavior and URL/config contracts.

### Phase 6 — Chat presentation cleanup

- review `ChatMessage`;
- review `renderMessageContent`;
- simplify presentation responsibilities without breaking emotes/events/cosmetics.

### Phase 7 — Dependency/dead-code cleanup

- remove obsolete libraries;
- remove duplicate assets;
- remove dead adapters/styles;
- verify the production build.

### Phase 8 — Documentation and enforcement

- update architecture/design documents;
- tighten boundaries where useful;
- run the full verification suite.

The repository must remain usable after every phase.

---

## 25. Definition of Done

A refactor is not complete merely because TypeScript compiles.

At minimum, run the relevant checks.

For broad changes, run:

```bash
bun run lint
bun run typecheck
bun test ./tests
bun run build
```

Prefer the complete project check:

```bash
bun run check
```

Before declaring completion, verify that the change did not introduce:

- new cyclic dependencies;
- duplicate UI primitives;
- a second icon system;
- unnecessary dependencies;
- new giant generic `utils`;
- hidden side effects;
- broken lifecycle cleanup;
- duplicated platform SVGs;
- static design literals that bypass established tokens;
- accessibility regressions;
- OBS regressions;
- config/URL contract changes.

---

## 26. Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) for every commit.

Follow the project rules in `CONTRIBUTING.md`.

Format:

```text
<type>(<optional scope>): <description>
```

Use:

- an imperative description;
- lower-case text;
- no trailing period;
- a logical project area as scope;
- `!` and a `BREAKING CHANGE:` footer for actual breaking changes.

Examples:

```text
refactor(ui): consolidate icon usage
refactor(styles): introduce semantic design tokens
refactor(setup): extract persistence adapter
refactor(setup): extract twitch channel lookup
refactor(chat): separate event presentation
chore(deps): remove unused icon assets
docs(architecture): document ui dependency boundaries
test(setup): characterize preview synchronization
```

Do not combine unrelated architectural migrations in one commit.

Run `bun run check` before committing when practical.

---

## 27. Things Agents Must Not Do

Do not:

- rewrite the application from scratch;
- replace SolidJS without an explicit project decision;
- add a state-management framework merely to make code look structured;
- add another CSS framework;
- split every large file into tiny files;
- create abstractions only to reduce duplication counts;
- replace all inline styles mechanically;
- remove all `!important` mechanically;
- convert every numeric value into a CSS variable;
- replace brand assets with generic icons;
- break public URL/config behavior;
- break OBS compatibility;
- hide infrastructure inside generic helpers;
- add a service locator or DI container;
- silence type errors with broad `any`;
- delete tests to simplify a refactor;
- change visual behavior during a structural refactor unless that change is explicitly part of the task.

---

## 28. Final Rule

Leave the codebase easier to understand than you found it.

A good change should make at least one of these clearer:

- who owns a behavior;
- where a dependency belongs;
- which layer is responsible;
- which component should be reused;
- which token represents a design decision;
- which library owns a capability;
- how the behavior is tested;
- how the resource is cleaned up.

If a refactor only moves code around without improving one of those, reconsider whether it is useful.
