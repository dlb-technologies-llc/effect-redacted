import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/**/*.test.ts"],
          exclude: ["test/db/**", "test/integration/**"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/db/**/*.test.ts", "test/integration/**/*.test.ts"],
          testTimeout: 60_000,
        },
      },
    ],
  },
})
