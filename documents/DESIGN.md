# ChatYX Design System

## Purpose

Setup is a compact operational interface for producing an OBS overlay URL. It preserves the existing dark, dense card layout and uses the same navigation, `SectionCard`, and `ToggleRows` primitives for every settings category.

## TTS And RTE Sections

`Озвучка сообщений` and `RTE` are separate setup categories. Each switch is independent and disabled by default. Copy must state the provider, the affected data, and the safe boundary:

- ChatIS / Streamlabs TTS and Azure TTS are optional audio services and moderator commands.
- The RTE proxy routes only allowlisted public emote and badge hosts; Twitch authentication and user URLs are never routed through it.
- Reyohoho badges and RTE paints are soft optional cosmetics; unavailable data leaves the existing chat rendering unchanged.

## Token Contract

Tokens are the interface between the stylesheets and the runtime. Two rules make
that interface stable:

1. `src/styles/chat.css` owns the rules. A rule's shape is fixed at build time.
2. The runtime writes only custom properties. `overlayStyleManager` sets values
   on the document; it does not emit a stylesheet whose shape depends on which
   preset the user picked.

A value that changes while the overlay runs — a user-selected color, emote
geometry, a measured layout shift, 7TV paint, provider cosmetics — is passed as a
custom property. A value that is a reusable design decision belongs in the
stylesheet.

`SIZE_CONFIGS` in `src/styles/chatStyles.ts` stays the single source of truth for
message size, weight, line height and the emote scale, because
`renderMessageContent.ts` reads the same table for emote geometry. The runtime
publishes it through `getOverlayStyleVariables()` instead of generating rules, so
the table drives custom properties rather than rule text. `OVERLAY_STYLE_PROPERTIES`
and `OVERLAY_ATTRIBUTES` list exactly what the manager may write; the boolean
variants (`.user_info`, the name separator) are keyed on
`:root[data-hide-names]` and `:root[data-nl-after-name]`.

Two boundaries are allowed to generate CSS, because there the rule shape is data
supplied from outside rather than a design decision:

- provider cosmetics (7TV paint), where colors and gradients arrive as protocol
  data;
- emote modifiers, where geometry depends on the emote's own dimensions.

The setup page's document lock follows the same rule in the other direction: the
lifecycle helper sets `data-setup-document` on the root and the setup stylesheet
owns the scrolling and height it implies. Product colors stay in CSS.

## Styling Stack

```text
Tailwind            application utility styling, as it already exists
components/ui       reusable primitives, with CVA where a real variant contract exists
CSS custom props    overlay runtime values and component contracts
plain CSS           overlay, provider and browser-integration boundaries
@hugeicons/solid-js generic UI icon rendering
PlatformGlyph       brand-owned glyphs
```

Tailwind is not scheduled for removal and is not being extended: no new utility
spaghetti, no new abstraction layer, no Tailwind in provider- or
runtime-generated markup.

## Iconography

Generic UI icons are Hugeicons payloads rendered by the project's thin `Icon`
wrapper over the vendor's Solid renderer. The wrapper fixes `currentColor`, the
`1em` default size and the decorative default; the payload keeps its own stroke
width. Icons stay hidden from assistive technology unless they carry a label, and
icon-only controls always have an accessible name.

Brand marks are not generic icons: `PlatformGlyph` is their only owner, and the
bespoke overlay graphics — sparkline, event, reply and role artwork — stay custom
drawings.

## Surface Ownership

`.setup-root` paints the setup workspace surface; the document itself stays
transparent because `app.css` forces that for OBS. `html`, `body` and `#root`
therefore never need a background write at runtime, and a module that needs to
change document behaviour changes state (an attribute) rather than presentation.

## Reusable Primitives

- `SetupNav`: desktop section navigation and its compact mobile equivalent.
- `SectionCard`: collapsible settings group with title and description.
- `ToggleRows`: one settings choice per row, with a clear label and a concise operational hint.
- `SetupImportCard`: the first setup section; imports only equivalent URL parameters and reports unsupported source fields without approximation.

## Accessibility

Toggles use `SetupSwitch` labels, and all section navigation remains keyboard-focusable with the existing visible focus ring. RTE copy avoids implying that a third-party service is required for the overlay to function.

## OBS Overlay Messages

### Direction

The overlay is a transparent, compact feed, not a stack of cards. Ordinary chat is the visual baseline. Events add only enough distinction to identify the state: existing icon, semantic accent, and a shallow tint where the event has a background. Authored events keep the same badge, author, and message rhythm as ordinary chat without explanatory headings; events without authored text become concise icon-led system notices.

The spatial model combines StyleGallery's `feed` pattern for stable message order with its wrapping `cluster` pattern for event metadata. The overlay viewport owns clipping and message flow; individual messages never create an internal scrollbar.

### Message Anatomy

- `Chat row`: optional reply preview, badges, author, separator, and message content in source order. It has no background by default.
- `Authored event`: the normal chat row. Only factual event data such as a redeemed reward title, month count, or watch-streak count may precede it; no event heading is added.
- `System notice`: concise icon-led event context only. It uses the full available inline width so Twitch-provided detail and counts wrap naturally without an invented status caption.
- `Event context`: icon, optional factual title/count/detail. The cluster uses ordinary reading order and no fixed-width text tracks.
- `Gigantified media frame`: a block-size-preserving media slot whose inline size is the active S1/S2/S3 `gigantifiedEmoteWidth`, capped by the available overlay width.

### Semantic Color

State color is restricted to the icon, factual event title, and shallow event tint. It must never become a full-width saturated slab or decorative gradient.

| Token | Value | Role |
|---|---|---|
| `--chat-event-color` | Configured `#RRGGBB` palette color | Event background, rails, icons, and factual title |
| `--chat-event-opacity` | Shared event opacity | Transparency for every event color |
| `--chat-event-text` | `rgba(255, 255, 255, 0.82)` | Factual event detail |
| `--chat-event-muted` | `rgba(255, 255, 255, 0.72)` | Secondary counts and context |
| `--chat-event-separator-color` | `rgba(255, 255, 255, 0.48)` | Factual cluster separator |

The setup palette owns the color for every semantic event, including announcement levels. The shared opacity control applies to the background, rails, and icons without changing individual HEX colors. Disabling event highlighting removes this treatment but leaves event messages visible.

### Typography Roles

- `Message`: the configured overlay font, size preset, weight, and line-height; ordinary and authored-event body copy share this role.
- `Author`: the configured nickname weight and user/paint color.
- `Event fact`: `0.78em`, semibold relative to the configured message weight and reserved for Twitch-provided titles or values.
- `Event detail`: `0.78em`, regular relative emphasis with high-contrast neutral text.
- `Reply preview`: `0.78em`, compact neutral text; ellipsis is permitted because the complete preview remains available through its title.
- Counts use tabular numerals. Event copy uses natural wrapping and `overflow-wrap: break-word`; critical reward, raid, and notice text is never ellipsized.

### Spacing And Shape

Overlay spacing scales with the active text preset: `--chat-message-pad-block` (`0.12em`), `--chat-message-pad-inline` (`0.38em`), `--chat-event-gap` (`0.32em`), and `--chat-feed-gap` (`0.16em`). Event radii use `--chat-event-radius` (`0.24em`). Directional spacing uses logical properties only.

Authored messages use transparent surfaces, except highlighted messages, which use a shallow full-row tint. Factual event context is an inline prefix, so badges, author, separator, and authored text retain the same rhythm as ordinary chat instead of becoming a second card-like row. System notices occupy the available inline size for readable wrapping, but remain compact through content-driven block size and low padding.

### Media Constraints

- S1/S2/S3 gigantified widths are `180px`, `240px`, and `300px`; the active value is authoritative and is capped by `100%` of the row.
- Natural aspect ratio is preserved. Images use `object-fit: contain` and never upscale to the full row merely because space exists.
- Wide modifiers may use their calculated width inside the preset-bounded frame; they cannot force horizontal overflow.
- Rotated modifiers reserve their transformed square layout box inside the same frame.
- Zero-width overlays remain layered over their base emote and do not create an independent layout track.

### Responsive And Accessibility Constraints

- At `375px`, `768px`, and `1280px`, every row has `min-inline-size: 0`, event clusters wrap, and the overlay has no horizontal overflow.
- Reward names, raid author/detail, announcement copy, and watch-streak copy remain visible without unrecoverable truncation.
- Horizontal mode may ellipsize ordinary chat items to preserve the reel, but event notices and authored event rows wrap within the available overlay width.
- Color is never the only event cue: each state retains its icon or event-specific layout when tint is disabled.
- OBS page and `#chat_container` backgrounds remain transparent. The dev fixture may provide a checker/grid solely to reveal that transparency.

### Overlay Primitives And States

- `MessageFeedItem`: transparent ordinary, authored-event, system-notice, horizontal, and gigantified states.
- `EventContext`: default, first-message, highlighted-message, reward, subscription, raid, announcement color levels, watch-streak, and power-up states.
- `EventHighlight`: semantic accent plus optional shallow tint; authored highlighted-message and system-notice states.
- `GigantifiedMediaFrame`: S1/S2/S3, wide, rotated, and zero-width composition states.

### Accepted Debt

The overlay continues to honor user-selected fonts, strokes, shadows, event italics, and event background opacity even when those choices reduce the restraint of the default design. These are explicit public customization contracts rather than design-system drift.
