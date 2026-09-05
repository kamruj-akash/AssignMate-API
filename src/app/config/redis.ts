import { createClient } from "redis";
import envConfig from "./env";

const redisConnect =
  envConfig.node_env === "development"
    ? { url: `${envConfig.redis_url}` }
    : {
        username: envConfig.redis_user,
        password: envConfig.redis_pass,
        socket: {
          host: envConfig.redis_host,
          port: Number(envConfig.redis_port),
        },
      };

export const redisClient = createClient(redisConnect);
