import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  // Use the automatic JSX runtime so components that don't import React
  // explicitly (e.g. `src/app/components/suppr/copy-meal-dialog.tsx`,
  // which only imports `useState` / `useMemo` from "react") still render
  // in jsdom. Without this, esbuild defaults to the classic runtime and
  // emits `React.createElement(...)` calls that fail at "React is not
  // defined" for any subject file that never imported the namespace.
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  },
  test: {
    projects: [{
      extends: true,
      test: {
        environment: "jsdom",
        setupFiles: ["./tests/setup.ts"],
        include: ["tests/{unit,component,integration}/**/*.{test,spec}.{ts,tsx}"],
        exclude: ["tests/e2e/**", "node_modules/**", "dist/**", ".next/**"],
        globals: true
      },
      coverage: {
        provider: "v8",
        reportsDirectory: "./coverage",
        reporter: ["text", "json-summary", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.d.ts", "src/**/types/**", "**/node_modules/**", ".next/**"]
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        // Storybook coverage = storied UI primitives only (not full `src/`).
        coverage: {
          provider: 'v8',
          enabled: true,
          all: false,
          reportsDirectory: './coverage/storybook',
          reporter: ['text', 'json-summary'],
          include: [
            'src/app/components/ui/alert.tsx',
            'src/app/components/ui/badge.tsx',
            'src/app/components/ui/button.tsx',
            'src/app/components/ui/confidence-chip.tsx',
            'src/app/components/ui/empty-state.tsx',
            'src/app/components/ui/icon-box.tsx',
            'src/app/components/ui/option-card.tsx',
            'src/app/components/ui/suppr-card.tsx',
            'src/app/components/ui/trust-chip.tsx',
            'src/app/components/ui/utils.ts',
          ],
          exclude: ['**/*.stories.*', '**/*.test.*'],
          thresholds: {
            lines: 100,
            branches: 90,
            functions: 100,
            statements: 100,
          },
        },
        browser: {
          enabled: true,
          headless: true,
          provider: 'playwright',
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});