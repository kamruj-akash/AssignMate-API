import { defineConfig } from "prisma/config";

// The Prisma CLI evaluates this config in its own Node-based loader, which does
// not pick up Bun's automatic .env loading. Node's built-in env-file reader
// covers that without pulling in dotenv. It throws when the file is missing —
// the normal case on Render, where env vars come from the platform.
try {
  process.loadEnvFile?.(".env");
} catch {
  // no local .env file
}

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
