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
