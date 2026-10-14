import { defineConfig } from "vitest/config";
import path from "node:path";

// Database tests (`npm run test:db`). tests/db/global-setup.ts starts a throwaway Postgres 16 cluster of their own
// (tests/db/pg-up.sh, default 127.0.0.1:54330 in /tmp/crystalroyal-pgtest-ops; never the development database on
// 54329), loads the migrations and seed, and stops it afterwards. Files share that one database, so they run one
// at a time and each test resets the rows it uses.

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/db/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
