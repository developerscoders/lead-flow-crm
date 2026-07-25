import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    fileParallelism: false, // tests share one Postgres DB; run sequentially to avoid cross-test races
    testTimeout: 15000,
    hookTimeout: 20000,
  },
});
