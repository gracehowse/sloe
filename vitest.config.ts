import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Use the automatic JSX runtime so components that don't import React
  // explicitly (e.g. `src/app/components/suppr/copy-meal-dialog.tsx`,
  // which only imports `useState` / `useMemo` from "react") still render
  // in jsdom. Without this, esbuild defaults to the classic runtime and
  // emits `React.createElement(...)` calls that fail at "React is not
  // defined" for any subject file that never imported the namespace.
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/{unit,component,integration}/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**", ".next/**"],
    globals: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/types/**",
        "**/node_modules/**",
        ".next/**",
      ],
    },
  },
});

