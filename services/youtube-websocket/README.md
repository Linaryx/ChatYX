# ChatYX YouTube WebSocket

Workspace service that turns YouTube live chat into WebSocket JSON events.

## Why this is a server

ChatYX can be hosted on GitHub Pages, but GitHub Pages cannot expose a websocket endpoint. Polling YouTube directly from every viewer's browser is also fragile because YouTube internal APIs can hit CORS/rate-limit issues. This service keeps YouTube polling server-side and lets the overlay connect to one stable websocket.

Elysia is not required here. Bun's built-in `Bun.serve()` is enough.

## Run

```bash
bun install
bun run youtube:dev
```

Default port is `9905`.

YouTube requests are direct by default. Set an optional proxy with:

```bash
YOUTUBE_PROXY_URL=http://proxy.example:1080
```

## Docker

Build and run the service on port `9905`:

```bash
docker build -f services/youtube-websocket/Dockerfile -t chatyx-youtube-websocket .
docker run --rm -p 9905:9905 -e YOUTUBE_PROXY_URL= chatyx-youtube-websocket
```

Put a TLS-capable reverse proxy in front of the service for production so the
ChatYX overlay can connect over `wss://`. Set `HOST`, `PORT`, and
`YOUTUBE_PROXY_URL` through the container environment when needed.

## Endpoints

- `ws://localhost:9905/c/<handle-or-channel-id>` resolves `@handle/live` or `UC.../live`.
- `ws://localhost:9905/s/<video-id>` connects directly to a known live video.
- `http://localhost:9905/health` returns `ok`.

## Event Shape

```json
{
  "type": "message",
  "id": "message-id",
  "message": "text",
  "runs": [],
  "author": {
    "name": "@user",
    "id": "UC...",
    "verified": false,
    "moderator": false,
    "badges": []
  },
  "unix": 1780000000000
}
```

Delete and ban events:

```json
{ "info": "deleted", "message": "message-id" }
{ "info": "banned", "externalChannelId": "UC..." }
```
