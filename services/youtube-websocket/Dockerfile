FROM oven/bun:1.3.14-alpine

WORKDIR /app

COPY package.json bun.lock ./
COPY services/youtube-websocket/package.json ./services/youtube-websocket/package.json
RUN bun install --frozen-lockfile --production --filter @chatyx/youtube-websocket

COPY services/youtube-websocket/src ./services/youtube-websocket/src
WORKDIR /app/services/youtube-websocket

ENV HOST=0.0.0.0
ENV PORT=9905
EXPOSE 9905

USER bun
CMD ["bun", "run", "start"]
