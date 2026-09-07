import app from "./app";
import envConfig from "./app/config/env";
import { redisClient } from "./app/config/redis";
import { seedData } from "./app/utils/seed";

const PORT = process.env.PORT || 4000;

async function server() {
  try {
    await redisClient.connect();
    await seedData();
    const httpServer = app.listen(PORT, () => {
      console.log(`Server is running on port http://localhost:${PORT}`);
    });

    if (envConfig.node_env !== "development") {
      const shutdown = async () => {
        httpServer.close();
        await redisClient.quit();
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    }
  } catch (error) {
    console.error("Error in main function:", error);
    await redisClient.quit();
    process.exit(1);
  }
}

server();
