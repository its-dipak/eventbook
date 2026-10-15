import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false, // test files share one database
    testTimeout: 15000,
  },
});
