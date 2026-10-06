import { createClient } from "redis";
import envConfig from "./env";

// One URL for every environment — local dev points at 127.0.0.1, Render points
// at the hosted instance. Keeping the shape identical means a deploy can never
// silently fall back to a half-configured client.
if (!envConfig.redis_url) {
  throw new Error("REDIS_URL is not set");
}

export const redisClient = createClient({ url: envConfig.redis_url });

redisClient.on("error", (err) => {
  console.error("Redis client error:", err);
});

// On Vercel only app.ts is loaded (server.ts never runs), so the connection is
// opened lazily on the first request and reused while the instance stays warm.
// isOpen (not isReady) so a client that is mid-reconnect isn't connected twice.
let connecting: Promise<unknown> | null = null;

export const ensureRedis = async () => {
  if (redisClient.isOpen) return;
  connecting ??= redisClient.connect().finally(() => {
    connecting = null;
  });
  await connecting;
};
