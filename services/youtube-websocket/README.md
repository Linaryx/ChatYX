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
- `http://localhost:9905/health` returns `ok` plus the number of active connections, sources, and clients.

Rejected requests answer with `{ "error": { "code", "message" } }`. Codes the
overlay can expect: `INVALID_SOURCE_ID` (400), `ORIGIN_NOT_ALLOWED` (403),
`RATE_LIMITED` / `TOO_MANY_CONNECTIONS` / `TOO_MANY_SOURCES` (429, with
`Retry-After`), and `BRIDGE_BUSY` / `SOURCE_BUSY` (503). The overlay treats every
failed connection as retryable and backs off, so a busy bridge degrades instead
of dropping chat.

## Limits and abuse protection

Every subscription costs upstream work, so the bridge puts a ceiling on what a
single client, and the bridge as a whole, may consume. Defaults are sized for
real use — one OBS browser source plus the setup preview, on a connection that
may be shared by a household or an office — and every limit is env-overridable.

| Variable | Default | What the default allows |
|---|---|---|
| `MAX_CONNECTIONS_PER_IP` | `32` | Concurrent WebSockets from one client IP |
| `MAX_SOURCES_PER_IP` | `16` | Concurrent channel subscriptions from one client IP |
| `MAX_CONNECTIONS` | `4096` | Concurrent WebSockets across the bridge |
| `MAX_SOURCES` | `500` | Distinct channels followed at once |
| `MAX_CLIENTS_PER_SOURCE` | `200` | Browser sources sharing one channel |
| `MAX_LEGACY_CONNECTIONS` | `100` | Concurrent `/c/` and `/s/` links, which start their own upstream sessions |
| `MAX_CHANNEL_NAME_LENGTH` | `64` | Hard cap on the channel identifier before platform validation |
| `UPGRADES_PER_MINUTE_PER_IP` | `120` | WebSocket upgrade attempts per client IP |
| `NEW_SOURCES_PER_HOUR_PER_IP` | `240` | New channels one client IP may start |
| `NEW_SOURCES_PER_MINUTE` | `120` | New channels the bridge may start in total |
| `SEARCHES_PER_MINUTE_PER_IP` | `120` | `/api/kick/channels` requests per client IP |
| `WS_IDLE_TIMEOUT_SECONDS` | `120` | Peers that stop answering pings are dropped |
| `TRUST_PROXY` | `auto` | Where the client IP comes from: `auto`, `1`, or `0` |
| `ALLOWED_ORIGINS` | *(empty)* | Comma-separated browser origins; empty allows all |

Rate limits are token buckets: each rule may burst for 30 seconds of its
sustained rate and refills continuously, so a reconnect loop stays cheap while a
spike still hits the ceiling. The identifier rules are per platform — YouTube
handles are 3–30 characters, channel ids are `UC` plus 22 characters, video ids
are 11, Kick slugs are 3–25 — and a malformed or oversized identifier is
rejected before the upgrade.

The bridge is receive-only: clients may send at most 4 KB per frame, and a
client that stops reading is disconnected once 1 MB is buffered for it.

### Behind a load balancer

`TRUST_PROXY=auto` (the default) reads the forwarded chain when the peer
address is private — which is exactly how a load balancer or an in-cluster
ingress connects — and ignores it when the peer is a public address, because
then the headers are the client's own claims. That means the common deployment
needs no configuration at all; set `TRUST_PROXY=1` only if the proxy reaches the
bridge over a public address, and `TRUST_PROXY=0` to ignore headers entirely.
When forwarded headers arrive over a public peer the bridge logs one warning.

The chain is read right-to-left (`cf-connecting-ip`, then `x-real-ip`, then the
last `x-forwarded-for` entry): every proxy appends the peer it saw, so earlier
entries are client-controlled.

`ALLOWED_ORIGINS` is a browser-origin allowlist (for example
`https://linaryx.github.io,https://chat.ruina.team`). Requests without an
`origin` header — the bridge clients and health probes — are never blocked by
it.

### Northflank

Public HTTP ports support WebSockets, so the bridge serves the overlay through
its `*.code.run` endpoint as-is; Northflank's load balancer attaches
`X-Forwarded-For`, which `auto` mode picks up. Add runtime variables under
**Service → Environment** (or a project secret group) only to tune limits:

```env
TRUST_PROXY=1
MAX_SOURCES=1000
```

Run the bridge as a single instance, or turn on client-IP sticky sessions in
the load-balancing settings: replicas do not share workers or counters, so two
instances would poll the same channel twice and each hold its own per-IP
budget.

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
