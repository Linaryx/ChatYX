# ChatYX Setup Design

## Purpose

Setup is a compact operational interface for producing an OBS overlay URL. It preserves the existing dark, dense card layout and uses the same navigation, `SectionCard`, and `ToggleRows` primitives for every settings category.

## RTE Section

The `RTE` navigation section groups optional external integrations. Each switch is independent and disabled by default. Copy must state the provider, the affected data, and the safe boundary:

- Proxy routes only allowlisted public emote and badge hosts; Twitch authentication and user URLs are never routed through it.
- ChatIS / Streamlabs TTS and Azure TTS are separate services and commands.
- Reyohoho badges and RTE paints are soft optional cosmetics; unavailable data leaves the existing chat rendering unchanged.

## Reusable Primitives

- `SetupNav`: desktop section navigation and its compact mobile equivalent.
- `SectionCard`: collapsible settings group with title and description.
- `ToggleRows`: one settings choice per row, with a clear label and a concise operational hint.

## Accessibility

Toggles use `SetupSwitch` labels, and all section navigation remains keyboard-focusable with the existing visible focus ring. RTE copy avoids implying that a third-party service is required for the overlay to function.
