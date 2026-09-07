import "dotenv/config";
import { defineConfig } from "prisma/config";

// The Prisma CLI evaluates this config in its own Node-based loader, which does
// not pick up Bun's automatic .env loading. Node's built-in env-file reader
// covers that without pulling in dotenv.
process.loadEnvFile?.(".env");

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
