import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      "server-only": path.resolve(dirname, "./tests/mocks/server-only.ts"),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    name: "unit",
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/{unit,component,integration}/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**", ".next/**"],
    globals: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/types/**",
        "app/**/*.d.ts",
        "**/node_modules/**",
        ".next/**",
        // Storybook canvases + story-only scaffolding are measured by
        // `test:storybook:coverage` (vitest.storybook.config.ts), not the
        // unit gate — including them here dilutes the product-code baseline.
        "**/*.stories.*",
        "**/_story*.{ts,tsx}",
        "**/_*Story*.{ts,tsx}",
      ],
      // Whole-app baseline (ENG-1351, 2026-07-05): include now folds in root
      // app/** (routes, billing/checkout pages, DMCA form, error boundaries —
      // 123 files) alongside src/**, which was previously the only measured
      // tree. app/** was unmeasured before, not excluded, so it could never
      // fail these gates. Combined actuals after folding it in: lines/
      // statements 59.52%, branches 79.39%, functions 76.34% — thresholds
      // below are set at those honest actuals (rounded down slightly for
      // float-rounding headroom), a real drop from the old src/**-only
      // 56/56/80/74 on branches because app/** brings a large volume of
      // untested route/page/component code. Ratchet up as app/** gets test
      // coverage — see docs/testing/overview.md.
      thresholds: {
        lines: 59,
        statements: 59,
        branches: 79,
        functions: 76,
      },
    },
  },
});
