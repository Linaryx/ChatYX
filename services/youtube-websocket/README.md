# ChatYX Chat Sources Bridge

Workspace service that sends normalized YouTube and Kick chat events over WebSocket.

## Why this is a server

ChatYX can be hosted on GitHub Pages, but GitHub Pages cannot expose a WebSocket endpoint. Polling YouTube directly from every viewer's browser is fragile because YouTube internal APIs can hit CORS and rate-limit issues. This service keeps YouTube polling server-side and gives the overlay one stable WebSocket endpoint.

Kick uses public channel metadata, a temporary guest session, and a Centrifugo
realtime subscription. The service does not accept, store, or request OAuth
credentials, client secrets, or user tokens. That realtime transport is not a
documented OAuth API and can change.

Elysia is not required here. Bun's built-in `Bun.serve()` is enough.

## Run

```bash
bun install
bun run sources:dev
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

- `ws://localhost:9905/sources/youtube/channels/<handle-or-channel-id>` resolves `@handle/live` or `UC.../live`.
- `ws://localhost:9905/sources/kick/channels/<channel-slug>` subscribes to a Kick channel.
- `ws://localhost:9905/c/<handle-or-channel-id>` and `ws://localhost:9905/s/<video-id>` are legacy YouTube endpoints.
- `http://localhost:9905/health` returns `ok`.

## Event Shape

```json
{
  "type": "message",
  "platform": "youtube",
  "id": "message-id",
  "message": "text",
  "runs": [],
  "author": {
    "name": "@user",
    "id": "UC...",
    "moderator": false,
    "badges": []
  },
  "unix": 1780000000000
}
```

Delete, ban, and source status events:

```json
{ "type": "delete", "platform": "youtube", "messageId": "message-id" }
{ "type": "ban", "platform": "youtube", "userId": "UC..." }
{ "type": "status", "platform": "kick", "state": "connected" }
```
