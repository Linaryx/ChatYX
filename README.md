# ChatYX

Modern Twitch chat overlay with multi-platform emote and cosmetic support.

## Features

- **Twitch IRC** — real-time chat via WebSocket
- **Multi-platform emotes** — 7TV, BTTV, FFZ (global + channel)
- **7TV EventAPI** — live emote set updates, cosmetics (paints, badges), personal emotes
- **Badges** — Twitch, 7TV, BTTV, FFZ:AP, Chatterino, ChatIS
- **Chat preview** — live preview in the setup UI using real channel mods/VIPs/founders
- **Zero-width emotes** — properly stacked and centered via CSS Grid
- **SolidJS** — fine-grained reactivity, no virtual DOM overhead

## Getting Started

### Requirements

- [Bun](https://bun.sh) ≥ 1.0

### Install & Run

```bash
bun install
bun run dev
```

Then open the setup page:

```
http://localhost:5173/?channel=yourchannelname
```

Copy the generated overlay URL and paste it into OBS as a Browser Source.

### Build

```bash
bun run build
```

Output goes to `dist/`.

### GitHub Pages

The project includes `.github/workflows/deploy-pages.yml` for GitHub Pages.

In repository settings, open **Pages** and set **Source** to **GitHub Actions**. Pushing to `main` or `master` runs checks, builds the app, adds the SPA `404.html` fallback, and deploys `dist`.

The custom domain is configured via `public/CNAME` as `chat.ruina.team`. The workflow builds with relative asset paths (`VITE_BASE_PATH=./`), so the same artifact works on both `https://chat.ruina.team/` and the GitHub project URL.

## Configuration

All config is passed via URL query parameters. The setup page generates the correct URL for you.

### Environment Variables

Create a `.env` file to override defaults:

```env
# Your own backend API (optional — falls back to localhost:3002 for local dev)
VITE_API_URL=https://your-api.example.com

# ChatIS API proxy (optional)
VITE_CHATIS_API_URL=https://chatis.is2511.com/v2/twitch-api/

# Twitch web GraphQL Client-ID override (optional)
VITE_TWITCH_GQL_CLIENT_ID=your-client-id
```

The local API (`localhost:3002`) is only needed for cheermotes (requires Twitch OAuth). All other features work without it via public fallback APIs.

### Debug Mode

Add `?debug=true` to the overlay URL to show a performance monitor overlay (FPS, memory, frame times, DOM nodes, WebSocket connections).

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | [SolidJS](https://solidjs.com) |
| Routing | [@solidjs/router](https://github.com/solidjs/solid-router) |
| Bundler | [Vite](https://vitejs.dev) |
| Package manager | [Bun](https://bun.sh) |
| Linter | [oxlint](https://oxc.rs/docs/guide/usage/linter) |

## License

MIT — see [LICENSE](LICENSE).
