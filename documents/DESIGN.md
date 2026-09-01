# ChatYX Design System

## Purpose

Setup is a compact operational interface for producing an OBS overlay URL. It preserves the existing dark, dense card layout and uses the same navigation, `SectionCard`, and `ToggleRows` primitives for every settings category.

## TTS And RTE Sections

`Озвучка сообщений` and `RTE` are separate setup categories. Each switch is independent and disabled by default. Copy must state the provider, the affected data, and the safe boundary:

- ChatIS / Streamlabs TTS and Azure TTS are optional audio services and moderator commands.
- The RTE proxy routes only allowlisted public emote and badge hosts; Twitch authentication and user URLs are never routed through it.
- Reyohoho badges and RTE paints are soft optional cosmetics; unavailable data leaves the existing chat rendering unchanged.

## Reusable Primitives

- `SetupNav`: desktop section navigation and its compact mobile equivalent.
- `SectionCard`: collapsible settings group with title and description.
- `ToggleRows`: one settings choice per row, with a clear label and a concise operational hint.

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
| `--chat-event-accent-default` | `#9146ff` | Unknown/fallback Twitch event |
| `--chat-event-accent-first` | `#34d399` | First message |
| `--chat-event-accent-highlight` | `#fbbf24` | Highlighted authored message |
| `--chat-event-accent-reward` | `#f59e0b` | Channel-point reward |
| `--chat-event-accent-subscription` | `#c084fc` | Subscription |
| `--chat-event-accent-raid` | `#60a5fa` | Raid |
| `--chat-event-accent-streak` | `#2dd4bf` | Watch streak |
| `--chat-event-accent-power` | `#f472b6` | Power-up/gigantified emote |
| `--chat-event-accent-announcement-*` | Twitch `PURPLE`, `BLUE`, `GREEN`, `ORANGE`, and `PRIMARY` colors | Announcement level |
| `--chat-event-text` | `rgba(255, 255, 255, 0.82)` | Factual event detail |
| `--chat-event-muted` | `rgba(255, 255, 255, 0.72)` | Secondary counts and context |
| `--chat-event-separator-color` | `rgba(255, 255, 255, 0.48)` | Factual cluster separator |
| `--chat-event-background-opacity-default` | `18%` | Tint fallback when no configured opacity is available |

Announcements use Twitch's resolved announcement color as their state accent. The configured `twitchEventColor` is a fallback only; it must not override known semantic event states. The configured background opacity controls system-notice tints; highlighted authored messages retain their explicit shallow full-row tint.

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
