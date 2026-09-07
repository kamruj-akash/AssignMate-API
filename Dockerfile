# Pinned to the Bun that wrote bun.lock ("lockfileVersion": 2). Render's native
# runtime ships an older Bun, so the image carries its own rather than relying
# on the platform's default.
FROM oven/bun:1.4.0-alpine

WORKDIR /app

# Dependencies first: a code-only change reuses this layer instead of
# reinstalling on every deploy.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# The Prisma client is generated into prisma/src/generated and committed, and
# the pg driver adapter needs no query-engine binary, so there is no generate
# step to run here.
COPY . .

ENV NODE_ENV=production

# Render injects PORT at runtime; server.ts falls back to 4000 for local runs.
EXPOSE 4000

CMD ["bun", "run", "src/server.ts"]
