import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

/** UI primitives with Storybook stories — coverage is scoped to these files only. */
const coverageEnabled = process.argv.includes("--coverage");

export const STORYBOOK_UI_COVERAGE = [
  "src/app/components/ui/alert.tsx",
  "src/app/components/ui/badge.tsx",
  "src/app/components/ui/button.tsx",
  "src/app/components/ui/confidence-chip.tsx",
  "src/app/components/ui/empty-state.tsx",
  "src/app/components/ui/icon-box.tsx",
  "src/app/components/ui/option-card.tsx",
  "src/app/components/ui/suppr-card.tsx",
  "src/app/components/ui/trust-chip.tsx",
  "src/app/components/ui/utils.ts",
] as const;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  server: {
    watch: {
      // Coverage HTML is written under coverage/ — ignore it so Storybook dev HMR stays stable.
      ignored: ["**/coverage/**"],
    },
  },
  plugins: [
    storybookTest({
      configDir: path.join(dirname, ".storybook"),
    }),
  ],
  test: {
    name: "storybook",
    // First story in each file pays browser + MSW cold-start cost; dev can be slower when
    // Chromatic or coverage runs concurrently.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      enabled: coverageEnabled,
      all: false,
      reportsDirectory: "./coverage/storybook",
      reporter: ["text", "text-summary", "html", "json-summary"],
      include: [...STORYBOOK_UI_COVERAGE],
      exclude: ["**/*.stories.*", "**/*.test.*"],
      ...(coverageEnabled
        ? {
            thresholds: {
              lines: 100,
              branches: 100,
              functions: 100,
              statements: 100,
            },
          }
        : {}),
    },
    browser: {
      enabled: true,
      headless: true,
      provider: "playwright",
      instances: [{ browser: "chromium" }],
    },
  },
});
